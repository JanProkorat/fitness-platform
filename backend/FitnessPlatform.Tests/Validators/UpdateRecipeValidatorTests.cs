using FitnessPlatform.Application.Features.Recipes.Shared;
using FitnessPlatform.Application.Features.Recipes.UpdateRecipe;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Validators;

/// <summary>
/// Tests for <see cref="UpdateRecipeValidator"/>, covering the <c>Version</c> rule added in
/// #1032's review round 2: an omitted <c>version</c> binds to 0 and, without this rule, surfaced
/// as a 409 concurrency conflict instead of a 400 shape error.
/// </summary>
public class UpdateRecipeValidatorTests
{
    private readonly UpdateRecipeValidator _validator = new();

    private static UpdateRecipeRequest ValidRequest() => new()
    {
        RecipeId = Guid.NewGuid(),
        Version = 1,
        Name = "Chicken Salad",
        Foods = [new RecipeFoodDto { FoodExternalId = Guid.NewGuid(), AmountGrams = 100 }]
    };

    [Fact]
    public void BaselineRequest_IsValid()
    {
        // Anti-100%-rejection guard: proves the fragment doesn't reject everything before the
        // mutation row below proves it doesn't silently accept an omitted Version either.
        _validator.TestValidate(ValidRequest()).IsValid.Should().BeTrue();
    }

    [Fact]
    public void Version_Zero_FailsValidation()
    {
        var req = ValidRequest();
        req.Version = 0;

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Version);
    }

    [Fact]
    public void Version_Negative_FailsValidation()
    {
        var req = ValidRequest();
        req.Version = -1;

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Version);
    }
}
