using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.SessionTemplates.GetSessionTemplate;
using FitnessPlatform.Application.Features.SessionTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.AspNetCore.Http;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.SessionTemplates.SaveSessionTemplateFromPlan;

/// <summary>
/// Saves a new session template from an existing training plan's session. The caller must own
/// the source plan; the copied session's standalone exercises, workouts, exercises, sets,
/// formats and format configs are taken verbatim from the plan.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="timeProvider">Injected system clock.</param>
/// <param name="linkAuthorizationService">Resolves link capabilities — authorship identifies the
/// source plan, the caller's live link to its client decides access.</param>
internal sealed class SaveSessionTemplateFromPlanEndpoint(
    IMongoContext mongo,
    TimeProvider timeProvider,
    IClientLinkAuthorizationService linkAuthorizationService)
    : Endpoint<SaveSessionTemplateFromPlanRequest, SessionTemplateDetailResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/training/session-templates/from-plan");
        Roles(AppRoles.Trainer);
        DontCatchExceptions();
        Description(b => b.WithName(nameof(SaveSessionTemplateFromPlanEndpoint)));
        Summary(s =>
        {
            s.Summary = "Save session template from plan";
            s.Description = "Copies the addressed TrainingSession's standalone exercises, workouts, exercises, sets, formats and format configs into a new session template owned by the caller. The plan and week/day/session must all resolve and the plan must belong to the caller.";
            s.Responses[StatusCodes.Status201Created] = "Session template created from the plan session";
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid request body";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or invalid credentials";
            s.Responses[StatusCodes.Status404NotFound] = "Plan not found/not owned by the caller, or the week/day/session is not present";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SaveSessionTemplateFromPlanRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);

        var sourceSession = await LoadSourceSessionOrRespondAsync(req, trainerId, ct);

        if (sourceSession is null)
        {
            return;
        }

        // TrainingSession.Format is nullable and its own doc comment says "Null when Format is
        // null or Standard" — an invariant the plan write path's own guard does not actually
        // enforce (UpdateTrainingPlanValidator's Null()/NotNull() rules both skip via When() when
        // Format is null), so a plan session with a null Format and a non-null FormatConfig is a
        // reachable, plan-valid state. Coalescing that null to Standard while copying FormatConfig
        // verbatim would persist a template SessionTemplateRuleSet rejects (OUT_OF_RANGE:
        // FormatConfig must be null for Standard) on every subsequent UpdateSessionTemplate call —
        // a permanent lockout on a template this same POST just returned 201 for (#892 review).
        // Deriving FormatConfig from the coalesced format, not the source session, closes it.
        var format = sourceSession.Format ?? WorkoutFormat.Standard;

        var template = new SessionTemplate
        {
            ExternalId = Guid.NewGuid(),
            OwnerId = trainerId,
            Name = req.Name,
            Description = req.Description,
            // TrainingSession carries no difficulty concept of its own — default to the enum's
            // CLR default (Beginner) rather than guess a value the source data doesn't have.
            // The trainer can edit it afterwards via UpdateSessionTemplate.
            Difficulty = default,
            Format = format,
            FormatConfig = format == WorkoutFormat.Standard ? null : sourceSession.FormatConfig,
            Workouts = sourceSession.Workouts,
            StandaloneExercises = sourceSession.StandaloneExercises,
            Visibility = req.Visibility,
            DateCreated = timeProvider.GetUtcNow().UtcDateTime,
            Version = 1
        };

        await mongo.SessionTemplates.InsertOneAsync(template, cancellationToken: ct);

        await Send.CreatedAtAsync<GetSessionTemplateEndpoint>(
            new { TemplateId = template.ExternalId },
            SessionTemplateDetailResponse.FromDocument(template, trainerId),
            cancellation: ct);
    }

    /// <summary>
    /// Resolves the source <see cref="TrainingSession"/> addressed by <paramref name="req"/>,
    /// checking plan ownership and week/day/session presence. Every failure — missing plan,
    /// unowned plan, denied collaboration, or an absent week/day/session — writes the identical
    /// shaped 404 via <see cref="SessionTemplateErrors.Denial"/> (#939), matching the
    /// <c>MealTemplates</c> sibling (<c>SaveMealTemplateFromPlanEndpoint</c>), which collapses its
    /// own equivalent chain onto one shared code the same way. <see cref="TrainingPlan"/> is not an
    /// <c>ILibraryDocument</c>, so <see cref="Domain.Extensions.LibraryDenialExtensions.SendLibraryNotFoundAsync"/>
    /// is used directly with this feature's own <see cref="LibraryDenial"/> rather than via the
    /// <c>Load*OrRespondAsync</c> helpers, which require one.
    /// </summary>
    private async Task<TrainingSession?> LoadSourceSessionOrRespondAsync(
        SaveSessionTemplateFromPlanRequest req, Guid trainerId, CancellationToken ct)
    {
        using var cursor = await mongo.TrainingPlans.FindAsync(
            Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, req.PlanId), cancellationToken: ct);
        var plan = await cursor.FirstOrDefaultAsync(ct);

        if (plan is null || plan.TrainerId != trainerId)
        {
            await this.SendLibraryNotFoundAsync(SessionTemplateErrors.Denial, ct);
            return null;
        }

        // Authorship is permanent; the collaboration is not. Require the caller's link to the
        // plan's client to still grant training access, routed through the same shaped 404 as an
        // unowned plan so a denial stays indistinguishable from a miss.
        // plan.ClientId is ApplicationUser.Id (#840) — the UserId-addressed overload.
        var capabilities = await linkAuthorizationService.GetCapabilitiesByClientUserIdAsync(
            trainerId, plan.ClientId, ct);

        if (capabilities is not { CanViewTrainingPlans: true })
        {
            await this.SendLibraryNotFoundAsync(SessionTemplateErrors.Denial, ct);
            return null;
        }

        var week = plan.Weeks.FirstOrDefault(w => w.WeekNumber == req.WeekNumber);
        var day = week?.Days.FirstOrDefault(d => d.DayOfWeek == req.DayOfWeek);
        var session = day?.Sessions.FirstOrDefault(s => s.SessionId == req.SessionId);

        if (session is null)
        {
            // #939: moved onto the same shared denial as the plan-resolution legs above, rather
            // than keeping the distinct TrainingSessionNotFound code — matching the MealTemplates
            // sibling, which does not distinguish "meal not found within an owned plan" from the
            // plan-resolution failures either.
            await this.SendLibraryNotFoundAsync(SessionTemplateErrors.Denial, ct);
            return null;
        }

        return session;
    }
}
