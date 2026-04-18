using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientTraining.MarkExerciseComplete;

/// <summary>
/// Marks a single exercise within a session as complete for the client on the specified date.
/// Idempotent: re-completing an already-complete exercise returns success without side effects.
/// Uses optimistic concurrency on the <see cref="TrainingCompletion"/> document.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
public class MarkExerciseCompleteEndpoint(IMongoContext mongo, IApplicationDbContext db)
    : Endpoint<MarkExerciseCompleteRequest, MarkExerciseCompleteResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/training/sessions/{SessionId}/exercises/{ExerciseExternalId}/complete");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Mark an exercise complete";
            s.Description = "Marks a single exercise within a training session as complete for the specified date. Idempotent.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(MarkExerciseCompleteRequest req, CancellationToken ct)
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

        // Resolve the client's active training plan and validate session/exercise ownership
        var planFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ClientId, clientId)
                         & Builders<TrainingPlan>.Filter.Eq(p => p.Status, TrainingPlanStatus.Active);

        using var planCursor = await mongo.TrainingPlans.FindAsync(planFilter, cancellationToken: ct);
        var plan = await planCursor.FirstOrDefaultAsync(ct);

        if (plan is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var session = plan.Weeks
            .SelectMany(w => w.Sessions)
            .FirstOrDefault(s => s.SessionId == req.SessionId);

        if (session is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var exerciseExists = session.Exercises.Any(e => e.ExerciseExternalId == req.ExerciseExternalId);
        if (!exerciseExists)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Load or create the completion document for (clientId, date, sessionId)
        var completionFilter = Builders<TrainingCompletion>.Filter.Eq(c => c.ClientId, clientId)
                               & Builders<TrainingCompletion>.Filter.Eq(c => c.Date, targetDate)
                               & Builders<TrainingCompletion>.Filter.Eq(c => c.SessionId, req.SessionId);

        using var completionCursor = await mongo.TrainingCompletions.FindAsync(completionFilter, cancellationToken: ct);
        var existing = await completionCursor.FirstOrDefaultAsync(ct);

        if (existing is not null)
        {
            // Idempotency: already complete — return success immediately
            if (existing.CompletedExerciseIds.Contains(req.ExerciseExternalId))
            {
                await Send.OkAsync(BuildResponse(req.SessionId, targetDate, existing, session.Exercises.Count), ct);
                return;
            }

            // Optimistic concurrency check when updating an existing document
            if (req.Version.HasValue && existing.Version != req.Version.Value)
            {
                await HttpContext.Response.SendAsync(
                    new { Error = "Version conflict. The completion record was modified by another request." },
                    409, cancellation: ct);
                return;
            }

            var newIds = new List<Guid>(existing.CompletedExerciseIds) { req.ExerciseExternalId };
            var newVersion = existing.Version + 1;

            var versionedFilter = completionFilter
                                  & Builders<TrainingCompletion>.Filter.Eq(c => c.Version, existing.Version);

            var update = Builders<TrainingCompletion>.Update
                .Set(c => c.CompletedExerciseIds, newIds)
                .Set(c => c.DateUpdated, DateTime.UtcNow)
                .Set(c => c.Version, newVersion);

            var updateResult = await mongo.TrainingCompletions.UpdateOneAsync(versionedFilter, update, cancellationToken: ct);

            if (updateResult.ModifiedCount == 0)
            {
                await HttpContext.Response.SendAsync(
                    new { Error = "Version conflict. The completion record was modified by another request." },
                    409, cancellation: ct);
                return;
            }

            existing.CompletedExerciseIds = newIds;
            existing.Version = newVersion;

            // TODO #6: publish trainingprogressupdated to trainer via IRealtimeNotifier

            await Send.OkAsync(BuildResponse(req.SessionId, targetDate, existing, session.Exercises.Count), ct);
        }
        else
        {
            // Create a new completion document
            var completion = new TrainingCompletion
            {
                ExternalId = Guid.NewGuid(),
                ClientId = clientId,
                Date = targetDate,
                SessionId = req.SessionId,
                CompletedExerciseIds = [req.ExerciseExternalId],
                DateCreated = DateTime.UtcNow,
                Version = 1
            };

            await mongo.TrainingCompletions.InsertOneAsync(completion, cancellationToken: ct);

            // TODO #6: publish trainingprogressupdated to trainer via IRealtimeNotifier

            await Send.OkAsync(BuildResponse(req.SessionId, targetDate, completion, session.Exercises.Count), ct);
        }
    }

    private static MarkExerciseCompleteResponse BuildResponse(
        Guid sessionId, DateTime date, TrainingCompletion completion, int totalExercises)
    {
        var completed = completion.CompletedExerciseIds.Count;
        return new MarkExerciseCompleteResponse
        {
            SessionId = sessionId,
            Date = DateOnly.FromDateTime(date),
            CompletedExerciseCount = completed,
            TotalExerciseCount = totalExercises,
            SessionComplete = completed >= totalExercises,
            Version = completion.Version
        };
    }
}
