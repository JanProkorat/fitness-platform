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

namespace FitnessPlatform.Application.Features.ClientTraining.MarkSessionComplete;

/// <summary>
/// Marks an entire training session as complete by marking all exercises in the session complete.
/// Fans out to a single completion document for (clientId, date, sessionId).
/// Idempotent: re-completing an already-complete session returns success.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
public class MarkSessionCompleteEndpoint(IMongoContext mongo, IApplicationDbContext db)
    : Endpoint<MarkSessionCompleteRequest, MarkSessionCompleteResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/training/sessions/{SessionId}/complete");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Mark a training session complete";
            s.Description = "Marks all exercises in a training session as complete for the specified date. Idempotent.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(MarkSessionCompleteRequest req, CancellationToken ct)
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

        // Validate session ownership via the active training plan
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

        var allExerciseIds = session.Exercises.Select(e => e.ExerciseExternalId).ToList();

        // Load or create the completion document
        var completionFilter = Builders<TrainingCompletion>.Filter.Eq(c => c.ClientId, clientId)
                               & Builders<TrainingCompletion>.Filter.Eq(c => c.Date, targetDate)
                               & Builders<TrainingCompletion>.Filter.Eq(c => c.SessionId, req.SessionId);

        using var completionCursor = await mongo.TrainingCompletions.FindAsync(completionFilter, cancellationToken: ct);
        var existing = await completionCursor.FirstOrDefaultAsync(ct);

        if (existing is not null)
        {
            // Idempotency: all already complete
            if (allExerciseIds.All(id => existing.CompletedExerciseIds.Contains(id)))
            {
                await Send.OkAsync(BuildResponse(req.SessionId, targetDate, existing, allExerciseIds.Count), ct);
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
                .Set(c => c.CompletedExerciseIds, allExerciseIds)
                .Set(c => c.DateUpdated, DateTime.UtcNow)
                .Set(c => c.Version, newVersion);

            var updateResult = await mongo.TrainingCompletions.UpdateOneAsync(versionedFilter, update, cancellationToken: ct);

            if (updateResult.ModifiedCount == 0)
            {
                await this.SendProblemAsync(409, ErrorCodes.TrainingCompletionVersionConflict,
                    "Version conflict. The completion record was modified by another request.", ct);
                return;
            }

            existing.CompletedExerciseIds = allExerciseIds;
            existing.Version = newVersion;

            // TODO #6: publish trainingprogressupdated to trainer via IRealtimeNotifier

            await Send.OkAsync(BuildResponse(req.SessionId, targetDate, existing, allExerciseIds.Count), ct);
        }
        else
        {
            var completion = new TrainingCompletion
            {
                ExternalId = Guid.NewGuid(),
                ClientId = clientId,
                Date = targetDate,
                SessionId = req.SessionId,
                CompletedExerciseIds = allExerciseIds,
                DateCreated = DateTime.UtcNow,
                Version = 1
            };

            try
            {
                await mongo.TrainingCompletions.InsertOneAsync(completion, cancellationToken: ct);
            }
            catch (MongoDB.Driver.MongoWriteException ex) when (ex.WriteError?.Code == 11000)
            {
                // Duplicate-key: a concurrent request inserted the document first.
                // Re-read and retry the update path once.
                using var retryCursor = await mongo.TrainingCompletions.FindAsync(completionFilter, cancellationToken: ct);
                existing = await retryCursor.FirstOrDefaultAsync(ct);

                if (existing is null)
                {
                    // Genuinely unexpected — let the global exception handler return 500.
                    throw;
                }

                if (allExerciseIds.All(id => existing.CompletedExerciseIds.Contains(id)))
                {
                    await Send.OkAsync(BuildResponse(req.SessionId, targetDate, existing, allExerciseIds.Count), ct);
                    return;
                }

                var retryVersion = existing.Version + 1;
                var retryVersionedFilter = completionFilter
                    & Builders<TrainingCompletion>.Filter.Eq(c => c.Version, existing.Version);
                var retryUpdate = Builders<TrainingCompletion>.Update
                    .Set(c => c.CompletedExerciseIds, allExerciseIds)
                    .Set(c => c.DateUpdated, DateTime.UtcNow)
                    .Set(c => c.Version, retryVersion);
                var retryResult = await mongo.TrainingCompletions.UpdateOneAsync(retryVersionedFilter, retryUpdate, cancellationToken: ct);

                if (retryResult.ModifiedCount == 0)
                {
                    await this.SendProblemAsync(409, ErrorCodes.TrainingCompletionVersionConflict,
                        "Version conflict. The completion record was modified by another request.", ct);
                    return;
                }

                existing.CompletedExerciseIds = allExerciseIds;
                existing.Version = retryVersion;
                await Send.OkAsync(BuildResponse(req.SessionId, targetDate, existing, allExerciseIds.Count), ct);
                return;
            }

            // TODO #6: publish trainingprogressupdated to trainer via IRealtimeNotifier

            await Send.OkAsync(BuildResponse(req.SessionId, targetDate, completion, allExerciseIds.Count), ct);
        }
    }

    private static MarkSessionCompleteResponse BuildResponse(
        Guid sessionId, DateTime date, TrainingCompletion completion, int totalExercises)
    {
        return new MarkSessionCompleteResponse
        {
            SessionId = sessionId,
            Date = DateOnly.FromDateTime(date),
            CompletedExerciseCount = completion.CompletedExerciseIds.Count,
            TotalExerciseCount = totalExercises,
            Version = completion.Version
        };
    }
}
