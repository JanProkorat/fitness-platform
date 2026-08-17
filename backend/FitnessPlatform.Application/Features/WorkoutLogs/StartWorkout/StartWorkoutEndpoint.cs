using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.WorkoutLogs.StartWorkout;

/// <summary>
/// Starts a new workout session for the authenticated client.
/// Creates (or resumes) a draft <see cref="SessionExecution"/> and returns its ID for
/// progressive logging.
/// Does NOT acquire a Live lock — the client must call POST .../go-live after pressing Start
/// to transition the session to Live state.
/// Ad-hoc workouts (null PlanId or null SessionId) skip plan/ownership validation entirely and
/// always create a fresh execution — the unified partial-unique index only applies when both
/// SessionId and Date are present.
/// </summary>
/// <remarks>
/// #841: for plan-bound workouts, the unified (clientId, sessionId, date) uniqueness constraint
/// means there is at most ONE <see cref="SessionExecution"/> for this session today, whether it
/// originated from a Today-card checkbox (no <see cref="SessionExecution.Performance"/> yet) or
/// a prior Start call. This endpoint therefore find-or-creates: if a checkbox-only execution
/// already exists for today, it attaches <see cref="SessionExecutionPerformance"/> to that SAME
/// document rather than inserting a second one (which would violate the unique index).
/// </remarks>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context — resolves the caller's persisted time zone
/// (#935) so the execution's calendar-day key lands on the CLIENT's local day, not the UTC day.</param>
/// <param name="timeProvider">Clock abstraction (#935) — lets tests pin the start instant
/// deterministically instead of reading <see cref="DateTime.UtcNow"/> directly.</param>
public class StartWorkoutEndpoint(
    IMongoContext mongo,
    IApplicationDbContext db,
    TimeProvider timeProvider) : Endpoint<StartWorkoutRequest, StartWorkoutResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/training/logs");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Start a workout (create draft log)";
            s.Description = "Creates or resumes a draft session execution and returns its ID for progressive logging. " +
                            "Does NOT acquire a Live lock — call POST .../go-live when the client presses Start.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(StartWorkoutRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        // clientUserIdGuid is the ApplicationUser.Id (what JWT AppClaims.UserId stores).
        // SessionExecution.ClientId is set to this value.
        var clientUserIdGuid = Guid.Parse(userId);
        var now = timeProvider.GetUtcNow().UtcDateTime;

        // Resolve the caller's local calendar day (#935) — the key EVERY SessionExecution.Date
        // must agree on, whether created here, by a Mark* checkbox, or by the trainer-driven
        // FinishSession endpoint.
        var clientTimeZone = await db.ResolveClientTimeZoneAsync(clientUserIdGuid, ct);

        // ── Ownership validation (plan-bound workouts only) ───────────────────────
        // Ad-hoc workouts (null PlanId or null SessionId) skip plan lookup entirely —
        // there is no session to gate and no trainer who could be editing.
        if (req.PlanId.HasValue && req.SessionId.HasValue)
        {
            // Load the plan to validate ownership.
            var planFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, req.PlanId.Value);
            using var planCursor = await mongo.TrainingPlans.FindAsync(planFilter, cancellationToken: ct);
            var plan = await planCursor.FirstOrDefaultAsync(ct);

            if (plan is null)
            {
                await Send.NotFoundAsync(ct);
                return;
            }

            // Ownership check: TrainingPlan.ClientId holds the ApplicationUser.Id since #840 —
            // compare directly against the caller's JWT-derived UserId (no ClientProfile lookup
            // required for this check).
            if (plan.ClientId != clientUserIdGuid)
            {
                await Send.ForbiddenAsync(ct);
                return;
            }

            var date = SessionExecution.ToCompletionDateUtc(now, clientTimeZone);
            var filter = Builders<SessionExecution>.Filter.Eq(e => e.ClientId, clientUserIdGuid)
                & Builders<SessionExecution>.Filter.Eq(e => e.SessionId, req.SessionId.Value)
                & Builders<SessionExecution>.Filter.Eq(e => e.Date, date);

            using var cursor = await mongo.SessionExecutions.FindAsync(filter, cancellationToken: ct);
            var existing = await cursor.FirstOrDefaultAsync(ct);

            if (existing is not null)
            {
                if (existing.Performance is not null)
                {
                    // Resume: hand back the same execution id (idempotent — a client re-pressing
                    // Start on an in-progress or already-finished session gets the same log).
                    await HttpContext.Response.SendAsync(new StartWorkoutResponse
                    {
                        LogId = existing.ExternalId,
                        StartedAt = existing.Performance.StartedAt
                    }, 201, cancellation: ct);
                    return;
                }

                // Checkbox-only execution exists for today — attach Performance to the SAME
                // document instead of inserting a second one for this (clientId, sessionId, date).
                var versionedFilter = filter & Builders<SessionExecution>.Filter.Eq(e => e.Version, existing.Version);
                var update = Builders<SessionExecution>.Update
                    .Set(e => e.PlanId, req.PlanId)
                    .Set(e => e.Performance, new SessionExecutionPerformance { StartedAt = now, Workouts = [] })
                    .Set(e => e.DateUpdated, now)
                    .Set(e => e.Version, existing.Version + 1);

                var updateResult = await mongo.SessionExecutions.UpdateOneAsync(versionedFilter, update, cancellationToken: ct);

                if (updateResult.ModifiedCount == 0)
                {
                    // Lost a concurrent race — re-read whatever the winner left behind rather
                    // than fail Start; the client still gets a usable LogId.
                    using var retryCursor = await mongo.SessionExecutions.FindAsync(filter, cancellationToken: ct);
                    existing = await retryCursor.FirstOrDefaultAsync(ct) ?? existing;
                }

                await HttpContext.Response.SendAsync(new StartWorkoutResponse
                {
                    LogId = existing.ExternalId,
                    StartedAt = now
                }, 201, cancellation: ct);
                return;
            }

            // No existing execution for this (session, date) — create fresh.
            var newExecution = new SessionExecution
            {
                ExternalId = Guid.NewGuid(),
                ClientId = clientUserIdGuid,
                PlanId = req.PlanId,
                SessionId = req.SessionId,
                Date = date,
                Performance = new SessionExecutionPerformance { StartedAt = now, Workouts = [] },
                DateCreated = now,
                Version = 1
            };

            try
            {
                await mongo.SessionExecutions.InsertOneAsync(newExecution, cancellationToken: ct);
            }
            catch (MongoWriteException ex) when (ex.WriteError?.Category == ServerErrorCategory.DuplicateKey)
            {
                // Concurrent Start/Mark-complete created the doc first — re-read and reuse it.
                using var retryCursor = await mongo.SessionExecutions.FindAsync(filter, cancellationToken: ct);
                var concurrent = await retryCursor.FirstOrDefaultAsync(ct);
                if (concurrent is null) throw;
                newExecution = concurrent;
            }

            await HttpContext.Response.SendAsync(new StartWorkoutResponse
            {
                LogId = newExecution.ExternalId,
                StartedAt = newExecution.Performance?.StartedAt ?? now
            }, 201, cancellation: ct);
            return;
        }

        // Ad-hoc workout — no session to key on, always create a fresh execution.
        var adHocExecution = new SessionExecution
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientUserIdGuid,
            PlanId = req.PlanId,
            SessionId = req.SessionId,
            Date = SessionExecution.ToCompletionDateUtc(now, clientTimeZone),
            Performance = new SessionExecutionPerformance { StartedAt = now, Workouts = [] },
            DateCreated = now,
            Version = 1
        };

        await mongo.SessionExecutions.InsertOneAsync(adHocExecution, cancellationToken: ct);

        await HttpContext.Response.SendAsync(new StartWorkoutResponse
        {
            LogId = adHocExecution.ExternalId,
            StartedAt = now
        }, 201, cancellation: ct);
    }
}
