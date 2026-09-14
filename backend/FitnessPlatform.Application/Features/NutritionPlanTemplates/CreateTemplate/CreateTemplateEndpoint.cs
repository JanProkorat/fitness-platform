using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Features.NutritionPlanTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;

namespace FitnessPlatform.Application.Features.NutritionPlanTemplates.CreateTemplate;

/// <summary>
/// Creates a new nutrition plan template for the authenticated nutritionist, either empty
/// (materialized from a week count) or with a full week tree supplied directly.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="timeProvider">Injected time source for audit timestamps.</param>
public class CreateTemplateEndpoint(IMongoContext mongo, TimeProvider timeProvider)
    : Endpoint<CreateNutritionPlanTemplateRequest, NutritionPlanTemplateSummaryDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/nutrition/plan-templates");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Create a nutrition plan template";
            s.Description = "Creates a template owned by the caller, either empty or with a supplied week tree.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreateNutritionPlanTemplateRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var ownerId = Guid.Parse(userId);

        var weeks = req.Weeks is { Count: > 0 }
            ? TemplateRequestMapper.ToWeeks(req.Weeks)
            : TemplateRequestMapper.ToEmptyWeeks(req.WeekCount!.Value);

        var template = new NutritionPlanTemplate
        {
            ExternalId = Guid.NewGuid(),
            OwnerId = ownerId,
            Name = req.Name,
            Description = req.Description,
            Goal = req.Goal,
            DietaryStyle = req.DietaryStyle,
            GlobalSettings = req.GlobalSettings,
            Supplements = TemplateRequestMapper.ToSupplements(req.Supplements),
            Weeks = weeks,
            WeekCount = weeks.Count,
            Visibility = req.Visibility,
            Version = 1,
            DateCreated = timeProvider.GetUtcNow().UtcDateTime
        };

        await mongo.NutritionPlanTemplates.InsertOneAsync(template, cancellationToken: ct);

        await HttpContext.Response.SendAsync(
            NutritionPlanTemplateSummaryDto.FromDocument(template, ownerId), 201, cancellation: ct);
    }
}
