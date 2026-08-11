using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Features.SessionTemplates.GetSessionTemplate;
using FitnessPlatform.Application.Features.SessionTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
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
/// <param name="authHelper">Link capability helper — authorship identifies the source plan, the
/// caller's live link to its client decides access.</param>
internal sealed class SaveSessionTemplateFromPlanEndpoint(
    IMongoContext mongo,
    TimeProvider timeProvider,
    ProfessionalAuthHelper authHelper)
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
            Format = sourceSession.Format ?? WorkoutFormat.Standard,
            FormatConfig = sourceSession.FormatConfig,
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
    /// checking plan ownership and week/day/session presence. Failure to resolve the plan itself
    /// (missing, or owned by another trainer) returns <see cref="ErrorCodes.PlanNotFound"/> —
    /// never a 403, per the existence-non-disclosure rule. Failure to resolve the addressed
    /// week/day/session returns <see cref="ErrorCodes.TrainingSessionNotFound"/>. These are
    /// distinct codes because <see cref="TrainingPlan"/> is not an <c>ILibraryDocument</c> and
    /// each failure leg names the resource that actually failed to resolve.
    /// </summary>
    private async Task<TrainingSession?> LoadSourceSessionOrRespondAsync(
        SaveSessionTemplateFromPlanRequest req, Guid trainerId, CancellationToken ct)
    {
        using var cursor = await mongo.TrainingPlans.FindAsync(
            Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, req.PlanId), cancellationToken: ct);
        var plan = await cursor.FirstOrDefaultAsync(ct);

        if (plan is null || plan.TrainerId != trainerId)
        {
            await this.SendProblemAsync(404, ErrorCodes.PlanNotFound, "Training plan not found.", ct);
            return null;
        }

        // Authorship is permanent; the collaboration is not. Require the caller's link to the
        // plan's client to still grant training access, routed through the same shaped 404 as an
        // unowned plan so a denial stays indistinguishable from a miss.
        var hasAccess = await authHelper.HasPlanAccessForClientUserAsync(
            trainerId, plan.ClientId, requireTrainingPlanAccess: true, ct);

        if (!hasAccess)
        {
            await this.SendProblemAsync(404, ErrorCodes.PlanNotFound, "Training plan not found.", ct);
            return null;
        }

        var week = plan.Weeks.FirstOrDefault(w => w.WeekNumber == req.WeekNumber);
        var day = week?.Days.FirstOrDefault(d => d.DayOfWeek == req.DayOfWeek);
        var session = day?.Sessions.FirstOrDefault(s => s.SessionId == req.SessionId);

        if (session is null)
        {
            await this.SendProblemAsync(404, ErrorCodes.TrainingSessionNotFound, "Training session not found.", ct);
            return null;
        }

        return session;
    }
}
