using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientTraining.MarkWholeDayComplete;

/// <summary>
/// Marks every training session scheduled for a given calendar day complete.
/// Resolves which sessions apply to the date by mapping the date to a plan week/day-of-week,
/// then upserts a <see cref="TrainingCompletion"/> document for each session.
/// Idempotent: sessions that are already fully complete are skipped.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
public class MarkWholeDayCompleteEndpoint(IMongoContext mongo, IApplicationDbContext db)
    : Endpoint<MarkWholeDayCompleteRequest, MarkWholeDayCompleteResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/training/day/complete");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Mark all training sessions for a day complete";
            s.Description = "Marks every session scheduled on the specified date complete. Resolves the plan week and day-of-week mapping. Idempotent.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(MarkWholeDayCompleteRequest req, CancellationToken ct)
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
        var targetDateOnly = req.Date ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var targetDate = targetDateOnly.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        // Find the active training plan
        var planFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ClientId, clientId)
                         & Builders<TrainingPlan>.Filter.Eq(p => p.Status, TrainingPlanStatus.Active);

        using var planCursor = await mongo.TrainingPlans.FindAsync(planFilter, cancellationToken: ct);
        var plan = await planCursor.FirstOrDefaultAsync(ct);

        if (plan is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Resolve which sessions are scheduled for the target date
        var sessionsForDay = ResolveSessions(plan, targetDateOnly);

        var summaries = new List<SessionCompletionSummary>();

        foreach (var session in sessionsForDay)
        {
            var allExerciseIds = session.Exercises.Select(e => e.ExerciseExternalId).ToList();

            var completionFilter = Builders<TrainingCompletion>.Filter.Eq(c => c.ClientId, clientId)
                                   & Builders<TrainingCompletion>.Filter.Eq(c => c.Date, targetDate)
                                   & Builders<TrainingCompletion>.Filter.Eq(c => c.SessionId, session.SessionId);

            using var completionCursor = await mongo.TrainingCompletions.FindAsync(completionFilter, cancellationToken: ct);
            var existing = await completionCursor.FirstOrDefaultAsync(ct);

            int version;

            if (existing is not null)
            {
                // Already fully complete — idempotent
                if (allExerciseIds.All(id => existing.CompletedExerciseIds.Contains(id)))
                {
                    summaries.Add(new SessionCompletionSummary
                    {
                        SessionId = session.SessionId,
                        CompletedExerciseCount = existing.CompletedExerciseIds.Count,
                        TotalExerciseCount = allExerciseIds.Count,
                        Version = existing.Version
                    });
                    continue;
                }

                var newVersion = existing.Version + 1;
                var versionedFilter = completionFilter
                                      & Builders<TrainingCompletion>.Filter.Eq(c => c.Version, existing.Version);

                var update = Builders<TrainingCompletion>.Update
                    .Set(c => c.CompletedExerciseIds, allExerciseIds)
                    .Set(c => c.DateUpdated, DateTime.UtcNow)
                    .Set(c => c.Version, newVersion);

                var updateResult = await mongo.TrainingCompletions.UpdateOneAsync(versionedFilter, update, cancellationToken: ct);

                // If version conflict on fan-out, skip this session — don't fail the whole batch
                version = updateResult.ModifiedCount > 0 ? newVersion : existing.Version;
            }
            else
            {
                var completion = new TrainingCompletion
                {
                    ExternalId = Guid.NewGuid(),
                    ClientId = clientId,
                    Date = targetDate,
                    SessionId = session.SessionId,
                    CompletedExerciseIds = allExerciseIds,
                    DateCreated = DateTime.UtcNow,
                    Version = 1
                };

                await mongo.TrainingCompletions.InsertOneAsync(completion, cancellationToken: ct);
                version = 1;
            }

            summaries.Add(new SessionCompletionSummary
            {
                SessionId = session.SessionId,
                CompletedExerciseCount = allExerciseIds.Count,
                TotalExerciseCount = allExerciseIds.Count,
                Version = version
            });

            // TODO #6: publish trainingprogressupdated to trainer via IRealtimeNotifier
        }

        await Send.OkAsync(new MarkWholeDayCompleteResponse
        {
            Date = targetDateOnly,
            Sessions = summaries
        }, ct);
    }

    /// <summary>
    /// Maps a calendar date to the sessions in the plan scheduled for that date,
    /// using the same week-resolution logic as <c>GetTodaySession</c>.
    /// Returns an empty list if the plan hasn't started, the target week isn't published,
    /// or there are no sessions for that day of week.
    /// </summary>
    private static IReadOnlyList<TrainingSession> ResolveSessions(TrainingPlan plan, DateOnly targetDate)
    {
        if (!plan.StartDate.HasValue || plan.Weeks.Count == 0)
            return [];

        var publishedWeeks = plan.Weeks
            .Where(w => w.Status == WeekStatus.Published)
            .OrderBy(w => w.WeekNumber)
            .ToList();

        if (publishedWeeks.Count == 0)
            return [];

        var resolvedWeek = PlanWeekCalculator.ResolveCurrentWeekNumber(
            plan.StartDate,
            publishedWeeks.Select(w => w.WeekNumber).ToList(),
            plan.Weeks.Count,
            publishedWeeks.First().DatePublished,
            plan.DateCreated,
            targetDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc));

        if (resolvedWeek is null)
            return [];

        var currentWeek = plan.Weeks.FirstOrDefault(w => w.WeekNumber == resolvedWeek.Value);
        if (currentWeek is null || currentWeek.Status != WeekStatus.Published)
        {
            currentWeek = publishedWeeks.Last();
        }

        // Map DateOnly DayOfWeek (0=Sunday) to ISO 1=Monday…7=Sunday
        var dow = (int)targetDate.DayOfWeek;
        dow = dow == 0 ? 7 : dow;

        return currentWeek.Sessions
            .Where(s => s.DayOfWeek == dow)
            .OrderBy(s => s.Order)
            .ToList();
    }
}
