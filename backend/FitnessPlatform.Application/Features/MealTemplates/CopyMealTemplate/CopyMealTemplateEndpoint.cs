using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Features.MealTemplates.GetMealTemplate;
using FitnessPlatform.Application.Features.MealTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.AspNetCore.Http;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.MealTemplates.CopyMealTemplate;

/// <summary>
/// Clones any readable meal template (the caller's own, or another owner's public template)
/// into a fresh <see cref="LibraryVisibility.Private"/> template owned by the caller.
/// </summary>
/// <remarks>
/// This is a <b>read-guarded write</b>, not a write-guarded one: <c>copy</c> creates a new
/// document but is gated on read access, because another nutritionist's public template must
/// remain copyable — wiring the write guard here would wrongly 403 on a public template and
/// break copy-to-own.
/// </remarks>
/// <param name="mongo">MongoDB context.</param>
/// <param name="timeProvider">Injected system clock.</param>
internal sealed class CopyMealTemplateEndpoint(IMongoContext mongo, TimeProvider timeProvider)
    : Endpoint<CopyMealTemplateRequest, MealTemplateDetailResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/nutrition/meal-templates/{TemplateId}/copy");
        Roles(AppRoles.Nutritionist);
        DontCatchExceptions();
        Description(b => b.WithName(nameof(CopyMealTemplateEndpoint)));
        Summary(s =>
        {
            s.Summary = "Copy meal template";
            s.Description = "Clones any readable meal template (own, or another owner's public template) into a new Private template owned by the caller, with a fresh identifier. Leaves the source untouched.";
            s.Responses[StatusCodes.Status201Created] = "Copy created";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or invalid credentials";
            s.Responses[StatusCodes.Status404NotFound] = "Source template not found, or another owner's private template";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CopyMealTemplateRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var nutritionistId = Guid.Parse(userId);

        var source = await this.LoadLibraryEntryForReadOrRespondAsync(
            mongo.MealTemplates, req.TemplateId, nutritionistId, MealTemplateErrors.Denial, ct);

        if (source is null)
        {
            return;
        }

        var copy = new MealTemplate
        {
            ExternalId = Guid.NewGuid(),
            OwnerId = nutritionistId,
            Name = source.Name,
            Description = source.Description,
            Kind = source.Kind,
            Foods = source.Foods,
            Recipes = source.Recipes,
            TotalNutrients = source.TotalNutrients,
            Visibility = LibraryVisibility.Private,
            DateCreated = timeProvider.GetUtcNow().UtcDateTime,
            Version = 1
        };

        await mongo.MealTemplates.InsertOneAsync(copy, cancellationToken: ct);

        await Send.CreatedAtAsync<GetMealTemplateEndpoint>(
            new { TemplateId = copy.ExternalId },
            MealTemplateDetailResponse.FromDocument(copy, nutritionistId),
            cancellation: ct);
    }
}
