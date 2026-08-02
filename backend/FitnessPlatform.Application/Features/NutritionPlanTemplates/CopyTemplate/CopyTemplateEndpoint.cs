using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Features.NutritionPlanTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;

namespace FitnessPlatform.Application.Features.NutritionPlanTemplates.CopyTemplate;

/// <summary>
/// Clones any readable nutrition plan template (the caller's own, or any nutritionist's
/// <c>Public</c> entry) into a new <c>Private</c> template owned by the caller, with a fresh
/// <c>ExternalId</c>. Read-guarded, not write-guarded — another owner's <c>Public</c> template
/// must stay copyable even though this endpoint writes a new document.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="timeProvider">Injected time source for audit timestamps.</param>
public class CopyTemplateEndpoint(IMongoContext mongo, TimeProvider timeProvider) : EndpointWithoutRequest
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/nutrition/plan-templates/{TemplateId}/copy");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Copy a nutrition plan template";
            s.Description = "Clones any readable template into a new Private template owned by the caller.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var callerId = Guid.Parse(userId);
        var templateId = Route<Guid>("TemplateId");

        var source = await this.LoadLibraryEntryForReadOrRespondAsync(
            mongo.NutritionPlanTemplates, templateId, callerId, NutritionPlanTemplateLibrary.Denial, ct);

        if (source is null)
        {
            return;
        }

        var copy = new NutritionPlanTemplate
        {
            ExternalId = Guid.NewGuid(),
            OwnerId = callerId,
            Name = source.Name,
            Description = source.Description,
            Goal = source.Goal,
            DietaryStyle = source.DietaryStyle,
            GlobalSettings = source.GlobalSettings,
            Supplements = TemplateContentCloner.CloneSupplements(source.Supplements, mintFreshExternalIds: false),
            Weeks = TemplateContentCloner.CloneWeeksAsTemplate(source.Weeks),
            WeekCount = source.WeekCount,
            Visibility = LibraryVisibility.Private,
            Version = 1,
            DateCreated = timeProvider.GetUtcNow().UtcDateTime
        };

        await mongo.NutritionPlanTemplates.InsertOneAsync(copy, cancellationToken: ct);

        await HttpContext.Response.SendAsync(
            NutritionPlanTemplateSummaryDto.FromDocument(copy), 201, cancellation: ct);
    }
}
