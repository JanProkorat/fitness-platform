using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Features.TrainingPlans.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.TrainingPlans.GetTrainingPlans;

/// <summary>
/// Lists training plans for the authenticated trainer with optional filtering and pagination.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class GetTrainingPlansEndpoint(IMongoContext mongo) : Endpoint<GetTrainingPlansRequest, GetTrainingPlansResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/training/plans");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "List training plans";
            s.Description = "Returns a paginated list of training plans owned by the authenticated trainer.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetTrainingPlansRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);

        var filterBuilder = Builders<TrainingPlan>.Filter;
        var filter = filterBuilder.Eq(p => p.TrainerId, trainerId);

        if (req.ClientId.HasValue)
        {
            filter &= filterBuilder.Eq(p => p.ClientId, req.ClientId.Value);
        }

        if (req.Status.HasValue)
        {
            filter &= filterBuilder.Eq(p => p.Status, req.Status.Value);
        }

        var totalCount = await mongo.TrainingPlans.CountDocumentsAsync(filter, cancellationToken: ct);

        var sort = Builders<TrainingPlan>.Sort.Descending(p => p.DateCreated);
        var options = new FindOptions<TrainingPlan>
        {
            Sort = sort,
            Skip = (req.Page - 1) * req.PageSize,
            Limit = req.PageSize
        };

        var cursor = await mongo.TrainingPlans.FindAsync(filter, options, ct);
        var plans = await cursor.ToListAsync(ct);

        await Send.OkAsync(new GetTrainingPlansResponse
        {
            Plans = plans.Select(TrainingPlanSummaryDto.FromDocument).ToList(),
            TotalCount = totalCount,
            Page = req.Page,
            PageSize = req.PageSize
        }, ct);
    }
}
