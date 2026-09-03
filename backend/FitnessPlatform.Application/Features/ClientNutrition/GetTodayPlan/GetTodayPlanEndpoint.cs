using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientNutrition.GetTodayPlan;

/// <summary>
/// Endpoint that returns the client's active nutrition plan for the current day.
/// Cycles through plan weeks when the plan duration is exceeded.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
/// <remarks>
/// Active-plan resolution is a two-phase read (ADR-0001 Tier 2a / #838):
/// <list type="number">
/// <item>A lightweight Mongo projection fetches every candidate Active plan with per-week
/// <b>metadata</b> only (<c>weekNumber</c>, <c>status</c>, <c>datePublished</c>) — excluding the
/// heavy <c>weeks[].days</c> sub-tree. This is enough for
/// <see cref="PlanWindowResolver.ResolveCurrentPlan{T}"/>, which only needs week counts and
/// metadata, never day/meal content.</item>
/// <item>Once the current week is resolved, a second targeted Mongo query hydrates just that
/// one week's <c>days</c> via the positional <c>$</c> projection operator.</item>
/// </list>
/// The plan's <c>weeks</c> array itself must never be projected away entirely — doing so would
/// collapse <see cref="PlanWindowResolver"/>'s week-count selector to zero for every plan.
/// </remarks>
public class GetTodayPlanEndpoint(IMongoContext mongo, IApplicationDbContext db) : EndpointWithoutRequest<GetTodayPlanResponse>
{
    /// <summary>
    /// Phase-1 projection: plan-level fields plus per-week metadata only (weekNumber, status,
    /// datePublished). Deliberately excludes <c>weeks[].days</c> — the heavy content this
    /// endpoint doesn't need until the current week is resolved.
    /// </summary>
    /// <remarks>
    /// <c>internal</c> (not <c>private</c>) so Testcontainers integration tests
    /// (<c>GetTodayPlanProjectionIntegrationTests</c>) can execute this EXACT production
    /// projection against a real MongoDB instance and assert the metadata-retained /
    /// content-excluded shape directly — proving the projection itself, not a re-derived copy
    /// of it. See <c>InternalsVisibleTo("FitnessPlatform.Tests")</c> in
    /// <c>Domain/Services/ClientVerdictService.cs</c>.
    /// </remarks>
    internal static readonly ProjectionDefinition<Domain.Documents.NutritionPlan> LightPlanProjection =
        Builders<Domain.Documents.NutritionPlan>.Projection.Combine(
            Builders<Domain.Documents.NutritionPlan>.Projection.Include(p => p.ExternalId),
            Builders<Domain.Documents.NutritionPlan>.Projection.Include(p => p.ClientId),
            Builders<Domain.Documents.NutritionPlan>.Projection.Include(p => p.Name),
            Builders<Domain.Documents.NutritionPlan>.Projection.Include(p => p.Status),
            Builders<Domain.Documents.NutritionPlan>.Projection.Include(p => p.StartDate),
            Builders<Domain.Documents.NutritionPlan>.Projection.Include(p => p.DateCreated),
            Builders<Domain.Documents.NutritionPlan>.Projection.Include(p => p.DatePublished),
            Builders<Domain.Documents.NutritionPlan>.Projection.Include(p => p.GlobalSettings),
            Builders<Domain.Documents.NutritionPlan>.Projection.Include("weeks.weekNumber"),
            Builders<Domain.Documents.NutritionPlan>.Projection.Include("weeks.status"),
            Builders<Domain.Documents.NutritionPlan>.Projection.Include("weeks.datePublished"));

    /// <inheritdoc />
    public override void Configure()
    {
        Get("/client/nutrition/plan/today");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get today's nutrition plan";
            s.Description = "Returns the meals and nutrition targets for the current day from the client's active plan.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.UserId == Guid.Parse(userId), ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Canonical client id on Mongo docs is ApplicationUser.Id (#840).
        var clientId = clientProfile.UserId;

        // Resolve the client's local calendar day (#935) — anchors plan-window resolution and
        // the day-index calculation below on the client's local "today" rather than the
        // server's UTC day.
        var todayLocalUtc = await db.ResolveClientLocalDateUtcAsync(clientId, ct);

        // Find the Active plan whose date window contains today — a client may hold several
        // sequential, non-overlapping Active plans (#780).
        // Phase 1: lightweight projection — plan metadata + per-week metadata only, no day/meal content.
        var filter = Builders<Domain.Documents.NutritionPlan>.Filter.And(
            Builders<Domain.Documents.NutritionPlan>.Filter.Eq(p => p.ClientId, clientId),
            Builders<Domain.Documents.NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active));

        var cursor = await mongo.NutritionPlans.FindAsync(
            filter,
            new FindOptions<Domain.Documents.NutritionPlan, Domain.Documents.NutritionPlan> { Projection = LightPlanProjection },
            ct);
        var activePlans = await cursor.ToListAsync(ct);
        var plan = PlanWindowResolver.ResolveCurrentPlan(activePlans, p => p.StartDate, p => p.Weeks.Count, todayLocalUtc);

        if (plan is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var publishedWeeks = plan.Weeks.Where(w => w.Status == WeekStatus.Published).ToList();

        if (publishedWeeks.Count == 0)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        Domain.Documents.PlanWeek week;
        int dayIndex;

        if (plan.StartDate.HasValue)
        {
            var daysSinceStart = (int)(todayLocalUtc - plan.StartDate.Value.Date).TotalDays;

            if (daysSinceStart < 0)
            {
                await Send.NotFoundAsync(ct);
                return;
            }

            var weekNum = daysSinceStart / 7 + 1;
            dayIndex = daysSinceStart % 7;

            var matchedWeek = publishedWeeks.FirstOrDefault(w => w.WeekNumber == weekNum);
            if (matchedWeek is null)
            {
                await Send.NotFoundAsync(ct);
                return;
            }

            week = matchedWeek;
        }
        else
        {
            var daysSincePublish = (int)(todayLocalUtc - plan.DatePublished!.Value.Date).TotalDays;

            if (daysSincePublish < 0)
            {
                await Send.NotFoundAsync(ct);
                return;
            }

            // Dedupe by WeekNumber, keeping the FIRST document-order occurrence of each — this
            // matches the element MongoDB's positional `weeks.$` projection returns for a given
            // weekNumber in FetchHydratedWeekAsync below, PROVIDED the first document-order
            // occurrence of that weekNumber is itself the Published one being selected here.
            // That does not hold if an earlier, non-Published duplicate shares the same
            // weekNumber (e.g. a Draft wn=1 before a Published wn=1) — FetchHydratedWeekAsync's
            // filter has no Status predicate, so Mongo's positional match would resolve the
            // Draft duplicate instead. That gap is tracked separately, not fixed here. Selecting
            // by array POSITION here (as before #850) diverges from the weekNumber key whenever
            // a legacy plan holds duplicate weekNumber values, since publishedWeeks re-indexes
            // after the Status filter and has no absolute-index equivalent for the positional
            // match. Document order is preserved deliberately — do NOT sort by weekNumber, that
            // would silently change which week a legacy plan resolves to.
            var distinctPublishedWeeks = publishedWeeks.DistinctBy(w => w.WeekNumber).ToList();

            var totalDays = distinctPublishedWeeks.Count * 7;
            var currentDayIndex = daysSincePublish % totalDays;
            var weekIndex = currentDayIndex / 7;
            dayIndex = currentDayIndex % 7;

            week = distinctPublishedWeeks[weekIndex];
        }

        // Phase 2: hydrate just the resolved week's day content. `week` up to this point only
        // carries metadata (weekNumber/status/datePublished) from the phase-1 fetch.
        var hydratedWeek = await FetchHydratedWeekAsync(plan.ExternalId, week.WeekNumber, ct);
        if (hydratedWeek is null)
        {
            // Plan/week vanished between phase 1 and phase 2 (rare race) — same as "no plan".
            await Send.NotFoundAsync(ct);
            return;
        }

        if (dayIndex >= hydratedWeek.Days.Count)
        {
            // Legacy week hydrated with fewer than 7 days — treat as "no plan for today"
            // rather than throwing ArgumentOutOfRangeException (matches GetTodayLogEndpoint's
            // bounds-guarded day lookup).
            await Send.NotFoundAsync(ct);
            return;
        }

        var day = hydratedWeek.Days[dayIndex];

        await Send.OkAsync(new GetTodayPlanResponse
        {
            PlanId = plan.ExternalId,
            PlanName = plan.Name,
            WeekNumber = hydratedWeek.WeekNumber,
            DayOfWeek = day.DayOfWeek,
            Meals = day.Meals,
            DayTotals = day.DayTotals,
            GlobalSettings = plan.GlobalSettings,
            DayNote = day.Note,
        }, ct);
    }

    /// <summary>
    /// Phase-2 fetch: hydrates the full day content for exactly one week of one plan, using the
    /// positional <c>$</c> projection operator so Mongo returns only the matched array element
    /// instead of the whole <c>weeks</c> tree.
    /// </summary>
    private async Task<Domain.Documents.PlanWeek?> FetchHydratedWeekAsync(Guid planExternalId, int weekNumber, CancellationToken ct)
    {
        var weekFilter = Builders<Domain.Documents.NutritionPlan>.Filter.And(
            Builders<Domain.Documents.NutritionPlan>.Filter.Eq(p => p.ExternalId, planExternalId),
            Builders<Domain.Documents.NutritionPlan>.Filter.Eq("weeks.weekNumber", weekNumber));

        // CRITICAL: an inclusion-only projection like "weeks.$" returns ONLY `_id` and `weeks` —
        // every other field (including `externalId`) is excluded and deserializes to its C#
        // default (Guid.Empty). Without explicitly re-including ExternalId here, the defensive
        // ExternalId match below always fails against real MongoDB, silently making this method
        // return null on every call in production (#838 fresh-eyes catch — the mocked unit tests
        // never exercise real Mongo's field-inclusion semantics, so this was invisible there).
        var weekProjection = Builders<Domain.Documents.NutritionPlan>.Projection.Combine(
            Builders<Domain.Documents.NutritionPlan>.Projection.Include(p => p.ExternalId),
            Builders<Domain.Documents.NutritionPlan>.Projection.Include("weeks.$"));

        using var cursor = await mongo.NutritionPlans.FindAsync(
            weekFilter,
            new FindOptions<Domain.Documents.NutritionPlan, Domain.Documents.NutritionPlan> { Projection = weekProjection },
            ct);
        var hydratedPlans = await cursor.ToListAsync(ct);

        // Match on ExternalId explicitly rather than trusting the query to have filtered
        // server-side — this keeps the method correct even against a test double that ignores
        // the filter argument (see GetTodayPlanEndpointTests / PlanTestHelpers mocks).
        return hydratedPlans
            .FirstOrDefault(p => p.ExternalId == planExternalId)?
            .Weeks
            .FirstOrDefault(w => w.WeekNumber == weekNumber);
    }
}
