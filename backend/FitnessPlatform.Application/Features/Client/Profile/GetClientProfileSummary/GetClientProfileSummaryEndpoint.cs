using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Client.Profile.GetClientProfileSummary;

/// <summary>
/// Returns the caller's own profile headline numbers. Missing data is never an error.
/// </summary>
/// <param name="db">Relational database context.</param>
/// <param name="mongo">MongoDB context.</param>
internal sealed class GetClientProfileSummaryEndpoint(IApplicationDbContext db, IMongoContext mongo)
    : EndpointWithoutRequest<GetClientProfileSummaryResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/client/profile/summary");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get the client's profile summary";
            s.Description = "Goal, member-since date, weight change and plan, workout, photo and check-in counts for the authenticated client.";
            s.Responses[StatusCodes.Status200OK] = "Profile summary; counts are 0 and nullable fields null when the client has no data";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null || !Guid.TryParse(userId, out var clientId))
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var memberSince = await db.Users
            .AsNoTracking()
            .Where(user => user.Id == clientId)
            .Select(user => user.DateCreated)
            .FirstOrDefaultAsync(ct);

        var profile = await db.ClientProfiles
            .AsNoTracking()
            .Where(clientProfile => clientProfile.UserId == clientId)
            .Select(clientProfile => new
            {
                clientProfile.Id,
                Goal = clientProfile.OnboardingData == null ? (PrimaryGoal?)null : clientProfile.OnboardingData.PrimaryGoal,
            })
            .FirstOrDefaultAsync(ct);

        var response = new GetClientProfileSummaryResponse
        {
            Goal = profile?.Goal,
            MemberSince = memberSince,
            CheckInCount = await db.WeeklyCheckIns
                .AsNoTracking()
                .CountAsync(checkIn => checkIn.ClientUserId == clientId, ct),
            PlanCount = await CountVisiblePlansAsync(clientId, ct),
            CompletedWorkoutCount = await CountCompletedWorkoutsAsync(clientId, ct),
        };

        if (profile is not null)
        {
            response.ProgressPhotoCount = await db.PlanPhotos
                .AsNoTracking()
                .CountAsync(photo => photo.ClientProfileId == profile.Id
                                     && (photo.Category == PlanPhotoCategory.Body || photo.Category == PlanPhotoCategory.FreeForm), ct);

            var weights = await db.BodyMeasurements
                .AsNoTracking()
                .Where(measurement => measurement.ClientProfileId == profile.Id && measurement.WeightKg != null)
                .OrderBy(measurement => measurement.MeasuredAt)
                .Select(measurement => measurement.WeightKg!.Value)
                .ToListAsync(ct);

            if (weights.Count > 0)
            {
                response.LatestWeightKg = weights[^1];
                response.WeightChangeSinceStartKg = weights[^1] - weights[0];
            }
        }

        await Send.OkAsync(response, ct);
    }

    /// <summary>
    /// Counts plans with the same visibility rule as <c>GET /client/plans</c>: not draft and at
    /// least one published week.
    /// </summary>
    private async Task<int> CountVisiblePlansAsync(Guid clientId, CancellationToken ct)
    {
        var nutritionFilter = Builders<NutritionPlan>.Filter.Eq(plan => plan.ClientId, clientId)
            & Builders<NutritionPlan>.Filter.Ne(plan => plan.Status, NutritionPlanStatus.Draft)
            & Builders<NutritionPlan>.Filter.ElemMatch(plan => plan.Weeks, week => week.Status == WeekStatus.Published);

        var trainingFilter = Builders<TrainingPlan>.Filter.Eq(plan => plan.ClientId, clientId)
            & Builders<TrainingPlan>.Filter.Ne(plan => plan.Status, TrainingPlanStatus.Draft)
            & Builders<TrainingPlan>.Filter.ElemMatch(plan => plan.Weeks, week => week.Status == WeekStatus.Published);

        var nutritionCount = await mongo.NutritionPlans.CountDocumentsAsync(nutritionFilter, cancellationToken: ct);
        var trainingCount = await mongo.TrainingPlans.CountDocumentsAsync(trainingFilter, cancellationToken: ct);

        return (int)(nutritionCount + trainingCount);
    }

    /// <summary>
    /// Counts executions that are complete. Checkbox completion never sets the Completed status,
    /// so a plan session is judged by its exercises; an execution whose session is in no plan any
    /// more counts only when its status is Completed.
    /// </summary>
    private async Task<int> CountCompletedWorkoutsAsync(Guid clientId, CancellationToken ct)
    {
        using var executionCursor = await mongo.SessionExecutions.FindAsync(
            Builders<SessionExecution>.Filter.Eq(execution => execution.ClientId, clientId), cancellationToken: ct);
        var executions = await executionCursor.ToListAsync(ct);

        if (executions.Count == 0)
        {
            return 0;
        }

        using var planCursor = await mongo.TrainingPlans.FindAsync(
            Builders<TrainingPlan>.Filter.Eq(plan => plan.ClientId, clientId), cancellationToken: ct);
        var plans = await planCursor.ToListAsync(ct);

        var sessionsById = plans
            .SelectMany(plan => plan.Weeks)
            .SelectMany(week => week.Days)
            .SelectMany(day => day.Sessions)
            .GroupBy(session => session.SessionId)
            .ToDictionary(group => group.Key, group => group.First());

        return executions.Count(execution =>
            execution.SessionId is { } sessionId && sessionsById.TryGetValue(sessionId, out var session)
                ? execution.IsSessionComplete(session)
                : execution.Status == SessionExecutionStatus.Completed);
    }
}
