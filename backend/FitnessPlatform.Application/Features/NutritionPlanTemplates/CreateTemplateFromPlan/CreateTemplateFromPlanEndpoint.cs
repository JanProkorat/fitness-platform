using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Features.NutritionPlanTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.NutritionPlanTemplates.CreateTemplateFromPlan;

/// <summary>
/// Saves an existing nutrition plan as a new template owned by the caller, stripping every
/// client-only field (<c>ClientId</c>, <c>Status</c>, <c>StartDate</c>, publish/complete dates,
/// <c>QuestionnaireResponseId</c>, <c>TargetWeightKg</c>).
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="timeProvider">Injected time source for audit timestamps.</param>
public class CreateTemplateFromPlanEndpoint(IMongoContext mongo, TimeProvider timeProvider)
    : Endpoint<CreateNutritionPlanTemplateFromPlanRequest, NutritionPlanTemplateSummaryDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/nutrition/plan-templates/from-plan");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Save a nutrition plan as a template";
            s.Description = "Copies an existing plan's content into a new template, dropping client-only fields.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreateNutritionPlanTemplateFromPlanRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var ownerId = Guid.Parse(userId);

        // NutritionPlan is not an ILibraryDocument, so ownership is checked directly against
        // NutritionistId in the fetch filter — a missing plan and an unowned plan are
        // indistinguishable, both routed through the same shaped 404 this library uses.
        var filter = Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                     & Builders<NutritionPlan>.Filter.Eq(p => p.NutritionistId, ownerId);

        using var cursor = await mongo.NutritionPlans.FindAsync(filter, cancellationToken: ct);
        var plan = await cursor.FirstOrDefaultAsync(ct);

        if (plan is null)
        {
            await this.SendLibraryNotFoundAsync(NutritionPlanTemplateLibrary.Denial, ct);
            return;
        }

        var template = new NutritionPlanTemplate
        {
            ExternalId = Guid.NewGuid(),
            OwnerId = ownerId,
            Name = req.Name,
            Description = req.Description,
            Goal = plan.Goal,
            GlobalSettings = plan.GlobalSettings,
            Supplements = TemplateContentCloner.CloneSupplements(plan.Supplements, mintFreshExternalIds: true),
            Weeks = TemplateContentCloner.CloneWeeksFromPlan(plan.Weeks),
            WeekCount = plan.Weeks.Count,
            Visibility = req.Visibility,
            Version = 1,
            DateCreated = timeProvider.GetUtcNow().UtcDateTime
        };

        await mongo.NutritionPlanTemplates.InsertOneAsync(template, cancellationToken: ct);

        await HttpContext.Response.SendAsync(
            NutritionPlanTemplateSummaryDto.FromDocument(template, ownerId), 201, cancellation: ct);
    }
}
