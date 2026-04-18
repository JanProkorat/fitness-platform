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

namespace FitnessPlatform.Application.Features.ClientTraining.MarkSessionIncomplete;

/// <summary>
/// Clears all completion records for an entire training session on the specified date.
/// Idempotent: if the session has no completion document, returns success.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
public class MarkSessionIncompleteEndpoint(IMongoContext mongo, IApplicationDbContext db)
    : Endpoint<MarkSessionIncompleteRequest, MarkSessionIncompleteResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("/client/training/sessions/{SessionId}/complete");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Un-mark a training session as complete";
            s.Description = "Removes all exercise completion marks for a training session on the specified date. Idempotent.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(MarkSessionIncompleteRequest req, CancellationToken ct)
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

        var clientId = clientProfile.PublicId;
        var targetDate = (req.CompletedOn ?? DateOnly.FromDateTime(DateTime.UtcNow)).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        // Validate session ownership
        var planFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ClientId, clientId)
                         & Builders<TrainingPlan>.Filter.Eq(p => p.Status, TrainingPlanStatus.Active);

        using var planCursor = await mongo.TrainingPlans.FindAsync(planFilter, cancellationToken: ct);
        var plan = await planCursor.FirstOrDefaultAsync(ct);

        if (plan is null)
        {
            await this.SendProblemAsync(404, ErrorCodes.NoActiveTrainingPlan, "No active training plan found.", ct);
            return;
        }

        var session = plan.Weeks
            .SelectMany(w => w.Sessions)
            .FirstOrDefault(s => s.SessionId == req.SessionId);

        if (session is null)
        {
            await this.SendProblemAsync(404, ErrorCodes.TrainingSessionNotFound, "The session was not found in the active training plan.", ct);
            return;
        }

        var completionFilter = Builders<TrainingCompletion>.Filter.Eq(c => c.ClientId, clientId)
                               & Builders<TrainingCompletion>.Filter.Eq(c => c.Date, targetDate)
                               & Builders<TrainingCompletion>.Filter.Eq(c => c.SessionId, req.SessionId);

        using var completionCursor = await mongo.TrainingCompletions.FindAsync(completionFilter, cancellationToken: ct);
        var existing = await completionCursor.FirstOrDefaultAsync(ct);

        if (existing is null)
        {
            // Idempotent: no completion document exists
            await Send.OkAsync(new MarkSessionIncompleteResponse
            {
                SessionId = req.SessionId,
                Date = DateOnly.FromDateTime(targetDate),
                CompletedExerciseCount = 0,
                TotalExerciseCount = session.Exercises.Count,
                Version = 1
            }, ct);
            return;
        }

        // Optimistic concurrency check
        if (req.Version.HasValue && existing.Version != req.Version.Value)
        {
            await this.SendProblemAsync(409, ErrorCodes.TrainingCompletionVersionConflict,
                "Version conflict. The completion record was modified by another request.", ct);
            return;
        }

        var newVersion = existing.Version + 1;
        var versionedFilter = completionFilter
                              & Builders<TrainingCompletion>.Filter.Eq(c => c.Version, existing.Version);

        var update = Builders<TrainingCompletion>.Update
            .Set(c => c.CompletedExerciseIds, new List<Guid>())
            .Set(c => c.DateUpdated, DateTime.UtcNow)
            .Set(c => c.Version, newVersion);

        var updateResult = await mongo.TrainingCompletions.UpdateOneAsync(versionedFilter, update, cancellationToken: ct);

        if (updateResult.ModifiedCount == 0)
        {
            await this.SendProblemAsync(409, ErrorCodes.TrainingCompletionVersionConflict,
                "Version conflict. The completion record was modified by another request.", ct);
            return;
        }

        // TODO #6: publish trainingprogressupdated to trainer via IRealtimeNotifier

        await Send.OkAsync(new MarkSessionIncompleteResponse
        {
            SessionId = req.SessionId,
            Date = DateOnly.FromDateTime(targetDate),
            CompletedExerciseCount = 0,
            TotalExerciseCount = session.Exercises.Count,
            Version = newVersion
        }, ct);
    }
}
