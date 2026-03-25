using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.NutritionPlans.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;

namespace FitnessPlatform.Application.Features.NutritionPlans.CreatePlan;

/// <summary>
/// Creates a new nutrition plan for a client in Draft status.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="authHelper">Validates nutritionist-client relationship.</param>
public class CreatePlanEndpoint(IMongoContext mongo, NutritionAuthHelper authHelper)
    : Endpoint<CreatePlanRequest, PlanSummaryDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/nutrition/plans");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Create a nutrition plan";
            s.Description = "Creates a new nutrition plan in Draft status for a client.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreatePlanRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var nutritionistId = Guid.Parse(userId);

        var hasLink = await authHelper.HasActiveLinkAsync(nutritionistId, req.ClientId, ct);

        if (!hasLink)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var now = DateTime.UtcNow;

        var plan = new NutritionPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = req.ClientId,
            NutritionistId = nutritionistId,
            Name = req.Name,
            Status = NutritionPlanStatus.Draft,
            GlobalSettings = req.GlobalSettings,
            Weeks = Enumerable.Range(1, req.WeekCount).Select(w => new PlanWeek
            {
                WeekNumber = w,
                Status = WeekStatus.Draft,
                Days = Enumerable.Range(1, 7).Select(d => new PlanDay
                {
                    DayOfWeek = d,
                    Meals = [],
                    DayTotals = null
                }).ToList()
            }).ToList(),
            Version = 1,
            DateCreated = now,
            StartDate = req.StartDate.HasValue ? DateTime.SpecifyKind(req.StartDate.Value.Date, DateTimeKind.Utc) : null
        };

        await mongo.NutritionPlans.InsertOneAsync(plan, cancellationToken: ct);

        var response = PlanSummaryDto.FromDocument(plan);
        await HttpContext.Response.SendAsync(response, 201, cancellation: ct);
    }
}
