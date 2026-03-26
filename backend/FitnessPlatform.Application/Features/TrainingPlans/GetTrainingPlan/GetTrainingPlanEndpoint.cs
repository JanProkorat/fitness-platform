using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
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

        await Send.OkAsync(GetTrainingPlanResponse.FromDocument(plan), ct);
    }
}
