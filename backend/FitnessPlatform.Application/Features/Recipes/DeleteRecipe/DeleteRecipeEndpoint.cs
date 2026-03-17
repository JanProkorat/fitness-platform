using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Recipes.DeleteRecipe;

/// <summary>
/// Deletes a recipe owned by the current nutritionist.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class DeleteRecipeEndpoint(IMongoContext mongo)
    : Endpoint<DeleteRecipeRequest, object>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("/recipes/{RecipeId}");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Delete recipe";
            s.Description = "Permanently deletes a recipe owned by the current nutritionist.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DeleteRecipeRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var nutritionistId = Guid.Parse(userId);

        var filter = Builders<Recipe>.Filter.Eq(r => r.ExternalId, req.RecipeId)
            & Builders<Recipe>.Filter.Eq(r => r.NutritionistId, nutritionistId);

        var result = await mongo.Recipes.DeleteOneAsync(filter, ct);

        if (result.DeletedCount == 0)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.NoContentAsync(ct);
    }
}
