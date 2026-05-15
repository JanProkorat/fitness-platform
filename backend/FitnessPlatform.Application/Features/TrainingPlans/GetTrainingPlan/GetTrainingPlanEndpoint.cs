using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Features.ClientTraining;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.TrainingPlans.GetTrainingPlan;

/// <summary>
/// Retrieves a single training plan with full detail (weeks, sessions, exercises, sets).
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class GetTrainingPlanEndpoint(IMongoContext mongo) : Endpoint<GetTrainingPlanRequest, GetTrainingPlanResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/training/plans/{PlanId}");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Get a training plan";
            s.Description = "Returns the full training plan with all weeks, sessions, exercises, and sets.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetTrainingPlanRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);

        var filter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, req.PlanId);
        var cursor = await mongo.TrainingPlans.FindAsync(filter, cancellationToken: ct);
        var plan = await cursor.FirstOrDefaultAsync(ct);

        if (plan is null || plan.TrainerId != trainerId)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var response = GetTrainingPlanResponse.FromDocument(plan);

        var completionFilter = Builders<TrainingCompletion>.Filter.Eq(c => c.ClientId, plan.ClientId);
        var completionSort = Builders<TrainingCompletion>.Sort
            .Ascending(c => c.Date)
            .Ascending(c => c.SessionId);
        var completionCursor = await mongo.TrainingCompletions.FindAsync(
            completionFilter,
            new FindOptions<TrainingCompletion> { Sort = completionSort },
            ct);
        var completions = await completionCursor.ToListAsync(ct);

        // Build a session lookup for read-time backfill of legacy completions.
        // Keys are SessionId; sessions are already backfilled by FromDocument().
        var sessionLookup = plan.Weeks
            .SelectMany(w => w.Sessions)
            .ToDictionary(s => s.SessionId);

        response.Completions = completions
            .Select(c =>
            {
                Dictionary<Guid, List<Guid>> bySection;
                if (sessionLookup.TryGetValue(c.SessionId, out var session))
                {
                    var effective = TrainingCompletionBackfill.GetEffectiveCompletedExerciseIdsBySection(c, session);
                    bySection = effective.ToDictionary(kvp => kvp.Key, kvp => kvp.Value.ToList());
                }
                else
                {
                    // Session no longer in plan — return whatever is in the dict, or empty.
                    // Keys are stored as lowercase Guid strings; parse back to Guid, skipping malformed entries.
                    bySection = c.CompletedExerciseIdsBySection?
                        .Where(kvp => Guid.TryParse(kvp.Key, out _))
                        .ToDictionary(kvp => Guid.Parse(kvp.Key), kvp => kvp.Value.ToList()) ?? new();
                }

                return new TrainingPlanCompletionDto
                {
                    Date = DateOnly.FromDateTime(c.Date),
                    SessionId = c.SessionId,
                    CompletedExerciseIds = c.CompletedExerciseIds,
                    CompletedExerciseIdsBySection = bySection,
                    CompletedSectionIds = c.CompletedSectionIds ?? [],
                    Version = c.Version
                };
            })
            .ToList();

        await Send.OkAsync(response, ct);
    }
}
