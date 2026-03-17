using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Features.Foods.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;

namespace FitnessPlatform.Application.Features.Foods.CreateFood;

/// <summary>
/// Creates a custom food item owned by the authenticated nutritionist.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class CreateFoodEndpoint(IMongoContext mongo) : Endpoint<CreateFoodRequest, FoodSummary>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/foods");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Create custom food";
            s.Description = "Creates a new custom food item. Only nutritionists can create custom foods.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreateFoodRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var food = new Food
        {
            ExternalId = Guid.NewGuid(),
            Name = req.Name.Trim(),
            Source = "custom",
            Barcode = req.Barcode?.Trim(),
            NutrientValue = new NutrientValue
            {
                Kcal = req.NutrientValue.Kcal,
                Protein = req.NutrientValue.Protein,
                Carbs = req.NutrientValue.Carbs,
                Fat = req.NutrientValue.Fat,
                Fiber = req.NutrientValue.Fiber,
                Sugar = req.NutrientValue.Sugar,
                SaturatedFat = req.NutrientValue.SaturatedFat,
                Salt = req.NutrientValue.Salt
            },
            Allergens = req.Allergens,
            CommonServings = req.CommonServings
                .Select(s => new ServingSize { Label = s.Label, WeightGrams = s.WeightGrams })
                .ToList(),
            IsVerified = false,
            NutritionistId = Guid.Parse(userId),
            DateCreated = DateTime.UtcNow
        };

        await mongo.Foods.InsertOneAsync(food, cancellationToken: ct);

        await HttpContext.Response.SendAsync(FoodSummary.FromDocument(food), 201, cancellation: ct);
    }
}
