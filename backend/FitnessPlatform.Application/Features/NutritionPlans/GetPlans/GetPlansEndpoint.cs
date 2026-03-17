using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Features.NutritionPlans.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.NutritionPlans.GetPlans;

/// <summary>
/// Lists nutrition plans for the authenticated nutritionist with optional filtering and pagination.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class GetPlansEndpoint(IMongoContext mongo) : Endpoint<GetPlansRequest, GetPlansResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/nutrition/plans");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "List nutrition plans";
            s.Description = "Returns a paginated list of nutrition plans owned by the authenticated nutritionist.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetPlansRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var nutritionistId = Guid.Parse(userId);

        var filterBuilder = Builders<NutritionPlan>.Filter;
        var filter = filterBuilder.Eq(p => p.NutritionistId, nutritionistId);

        if (req.ClientId.HasValue)
        {
            filter &= filterBuilder.Eq(p => p.ClientId, req.ClientId.Value);
        }

        if (req.Status.HasValue)
        {
            filter &= filterBuilder.Eq(p => p.Status, req.Status.Value);
        }

        var totalCount = await mongo.NutritionPlans.CountDocumentsAsync(filter, cancellationToken: ct);

        var sort = Builders<NutritionPlan>.Sort.Descending(p => p.DateCreated);
        var options = new FindOptions<NutritionPlan>
        {
            Sort = sort,
            Skip = (req.Page - 1) * req.PageSize,
            Limit = req.PageSize
        };

        var cursor = await mongo.NutritionPlans.FindAsync(filter, options, ct);
        var plans = await cursor.ToListAsync(ct);

        await Send.OkAsync(new GetPlansResponse
        {
            Plans = plans.Select(PlanSummaryDto.FromDocument).ToList(),
            TotalCount = totalCount,
            Page = req.Page,
            PageSize = req.PageSize
        }, ct);
    }
}
