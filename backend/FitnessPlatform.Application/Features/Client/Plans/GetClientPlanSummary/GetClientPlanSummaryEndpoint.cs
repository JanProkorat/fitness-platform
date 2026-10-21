using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Client.Plans.GetClientPlanSummary;

/// <summary>
/// Returns the authenticated client's progress summary for one of their published plans.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
/// <param name="blobStorage">Mints short-lived read URLs for the progress photos.</param>
/// <param name="timeProvider">Clock, resolved to the client's local day.</param>
internal sealed class GetClientPlanSummaryEndpoint(
    IMongoContext mongo,
    IApplicationDbContext db,
    IBlobStorageService blobStorage,
    TimeProvider timeProvider)
    : Endpoint<GetClientPlanSummaryRequest, GetClientPlanSummaryResponse>
{
    /// <summary>
    /// How far outside the plan window a measurement may fall and still stand in for the plan's start or end.
    /// </summary>
    internal static readonly TimeSpan MeasurementTolerance = TimeSpan.FromDays(14);

    /// <inheritdoc />
    public override void Configure()
    {
        Get("/client/plans/{PlanId}/summary");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get a plan summary";
            s.Description =
                "Returns sessions done, body measurements near the plan's start and end, and the first and last progress photo of the plan window.";
            s.Responses[StatusCodes.Status200OK] = "Plan summary";
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid plan id";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status404NotFound] =
                "Plan not found, not the caller's, a draft, or without a published week";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetClientPlanSummaryRequest req, CancellationToken ct)
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

        var clientId = clientProfile.UserId;

        var nutritionPlan = await FindNutritionPlanAsync(req.PlanId, clientId, ct);
        var trainingPlan = nutritionPlan is null ? await FindTrainingPlanAsync(req.PlanId, clientId, ct) : null;

        if (nutritionPlan is null && trainingPlan is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var startDate = nutritionPlan is not null ? nutritionPlan.StartDate : trainingPlan!.StartDate;
        var totalWeeks = nutritionPlan is not null ? nutritionPlan.Weeks.Count : trainingPlan!.Weeks.Count;
        var dateCompleted = nutritionPlan is not null ? nutritionPlan.DateCompleted : trainingPlan!.DateCompleted;
        var coachId = nutritionPlan is not null ? nutritionPlan.NutritionistId : trainingPlan!.TrainerId;

        var coachName = await db.Users
            .AsNoTracking()
            .Where(user => user.Id == coachId)
            .Select(user => user.FirstName + " " + user.LastName)
            .FirstOrDefaultAsync(ct);

        var response = new GetClientPlanSummaryResponse
        {
            PlanId = req.PlanId,
            PlanName = nutritionPlan?.Name ?? trainingPlan!.Name,
            Type = nutritionPlan is not null ? "nutrition" : "training",
            Status = nutritionPlan?.Status.ToString() ?? trainingPlan!.Status.ToString(),
            CoachName = coachName,
            StartDate = startDate,
        };

        if (startDate.HasValue)
        {
            var windowStart = startDate.Value.Date;
            var plannedEnd = PlanProgressCalculator.ResolveEndDate(startDate, totalWeeks)!.Value;
            var endDate = dateCompleted.HasValue && dateCompleted.Value.Date < plannedEnd
                ? dateCompleted.Value.Date
                : plannedEnd;
            response.EndDate = endDate;

            if (trainingPlan is not null)
            {
                await ApplySessionCountsAsync(response, trainingPlan, clientId, ct);
            }

            await ApplyMeasurementsAsync(response, clientProfile.Id, windowStart, endDate, ct);
            await ApplyPhotosAsync(response, clientProfile.Id, windowStart, endDate, ct);
        }

        await Send.OkAsync(response, ct);
    }

    private async Task<NutritionPlan?> FindNutritionPlanAsync(Guid planId, Guid clientId, CancellationToken ct)
    {
        var filter = Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, planId)
            & Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientId)
            & Builders<NutritionPlan>.Filter.Ne(p => p.Status, NutritionPlanStatus.Draft)
            & Builders<NutritionPlan>.Filter.ElemMatch(p => p.Weeks, w => w.Status == WeekStatus.Published);

        using var cursor = await mongo.NutritionPlans.FindAsync(filter, cancellationToken: ct);
        return await cursor.FirstOrDefaultAsync(ct);
    }

    private async Task<TrainingPlan?> FindTrainingPlanAsync(Guid planId, Guid clientId, CancellationToken ct)
    {
        var filter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, planId)
            & Builders<TrainingPlan>.Filter.Eq(p => p.ClientId, clientId)
            & Builders<TrainingPlan>.Filter.Ne(p => p.Status, TrainingPlanStatus.Draft)
            & Builders<TrainingPlan>.Filter.ElemMatch(p => p.Weeks, w => w.Status == WeekStatus.Published);

        using var cursor = await mongo.TrainingPlans.FindAsync(filter, cancellationToken: ct);
        return await cursor.FirstOrDefaultAsync(ct);
    }

    /// <summary>
    /// Counts sessions exactly as <c>GET /client/plans</c> does: over the plan's start to the client's local today.
    /// </summary>
    private async Task ApplySessionCountsAsync(
        GetClientPlanSummaryResponse response,
        TrainingPlan plan,
        Guid clientId,
        CancellationToken ct)
    {
        var today = await db.ResolveClientLocalDateUtcAsync(clientId, timeProvider.GetUtcNow().UtcDateTime, ct);
        var window = PlanProgressCalculator.ResolveProgressWindow(plan.StartDate, plan.Weeks.Count, today);
        if (!window.HasValue)
        {
            return;
        }

        var filter = Builders<SessionExecution>.Filter.Eq(e => e.ClientId, clientId)
            & Builders<SessionExecution>.Filter.Eq(e => e.PlanId, (Guid?)plan.ExternalId);

        using var cursor = await mongo.SessionExecutions.FindAsync(filter, cancellationToken: ct);
        var executions = await cursor.ToListAsync(ct);

        var (total, done) = PlanProgressCalculator.CountSessions(plan, window.Value, executions);
        if (total > 0)
        {
            response.SessionsTotal = total;
            response.SessionsDone = done;
        }
    }

    /// <summary>
    /// Picks, per metric, the measurement closest to the window's start and end within the tolerance.
    /// </summary>
    private async Task ApplyMeasurementsAsync(
        GetClientPlanSummaryResponse response,
        long clientProfileId,
        DateTime windowStart,
        DateTime endDate,
        CancellationToken ct)
    {
        var startInstant = DateTime.SpecifyKind(windowStart, DateTimeKind.Utc);
        var endInstant = DateTime.SpecifyKind(endDate.AddDays(1), DateTimeKind.Utc);
        var from = startInstant - MeasurementTolerance;
        var to = endInstant + MeasurementTolerance;

        var rows = await db.BodyMeasurements
            .AsNoTracking()
            .Where(m => m.ClientProfileId == clientProfileId
                && m.MeasuredAt >= from
                && m.MeasuredAt < to
                && (m.WeightKg != null || m.WaistCm != null))
            .Select(m => new { m.MeasuredAt, m.WeightKg, m.WaistCm })
            .ToListAsync(ct);

        // Start: nearest the window start, from the tolerance before it up to the window end.
        // End: nearest the window end, from the window start up to the tolerance after it.
        response.WeightStartKg = NearestMetric(rows.Select(r => (r.MeasuredAt, r.WeightKg)), from, endInstant, startInstant);
        response.WeightEndKg = NearestMetric(rows.Select(r => (r.MeasuredAt, r.WeightKg)), startInstant, to, endInstant);
        response.WaistStartCm = NearestMetric(rows.Select(r => (r.MeasuredAt, r.WaistCm)), from, endInstant, startInstant);
        response.WaistEndCm = NearestMetric(rows.Select(r => (r.MeasuredAt, r.WaistCm)), startInstant, to, endInstant);
    }

    private static decimal? NearestMetric(
        IEnumerable<(DateTime MeasuredAt, decimal? Value)> samples,
        DateTime rangeFrom,
        DateTime rangeToExclusive,
        DateTime target) =>
        samples
            .Where(s => s.Value is not null && s.MeasuredAt >= rangeFrom && s.MeasuredAt < rangeToExclusive)
            .OrderBy(s => (s.MeasuredAt - target).Duration())
            .Select(s => s.Value)
            .FirstOrDefault();

    /// <summary>
    /// Takes the earliest and latest Body or FreeForm photo taken inside the window, whatever plan it is linked to.
    /// </summary>
    private async Task ApplyPhotosAsync(
        GetClientPlanSummaryResponse response,
        long clientProfileId,
        DateTime windowStart,
        DateTime endDate,
        CancellationToken ct)
    {
        var from = DateTime.SpecifyKind(windowStart, DateTimeKind.Utc);
        var to = DateTime.SpecifyKind(endDate.AddDays(1), DateTimeKind.Utc);

        var photos = db.PlanPhotos
            .AsNoTracking()
            .Where(p => p.ClientProfileId == clientProfileId
                && (p.Category == PlanPhotoCategory.Body || p.Category == PlanPhotoCategory.FreeForm)
                && p.TakenAt >= from
                && p.TakenAt < to);

        var first = await photos.OrderBy(p => p.TakenAt)
            .Select(p => new { p.PublicId, p.BlobUrl, p.TakenAt })
            .FirstOrDefaultAsync(ct);

        if (first is null)
        {
            return;
        }

        var last = await photos.OrderByDescending(p => p.TakenAt)
            .Select(p => new { p.PublicId, p.BlobUrl, p.TakenAt })
            .FirstAsync(ct);

        response.FirstPhoto = await ToSummaryPhotoAsync(first.PublicId, first.BlobUrl, first.TakenAt, ct);
        response.LastPhoto = last.PublicId == first.PublicId
            ? response.FirstPhoto
            : await ToSummaryPhotoAsync(last.PublicId, last.BlobUrl, last.TakenAt, ct);
    }

    private async Task<ClientPlanSummaryPhoto> ToSummaryPhotoAsync(
        Guid publicId, string blobUrl, DateTime takenAt, CancellationToken ct) => new()
    {
        Id = publicId,
        DisplayUrl = await blobStorage.GenerateReadUrlAsync(blobUrl, ct) ?? string.Empty,
        TakenAt = takenAt,
    };
}
