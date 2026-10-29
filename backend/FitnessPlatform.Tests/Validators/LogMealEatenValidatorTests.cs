using FluentAssertions;
using FluentValidation.TestHelper;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.ClientNutrition.LogMealEaten;

namespace FitnessPlatform.Tests.Validators;

/// <summary>
/// Tests for <see cref="LogMealEatenValidator"/>.
/// </summary>
public class LogMealEatenValidatorTests
{
    private readonly LogMealEatenValidator _validator = new();

    private static LogMealEatenRequest ValidRequest() => new()
    {
        MealId = Guid.NewGuid()
    };

    [Fact]
    public void ValidRequest_NoOptionals_PassesValidation()
    {
        var result = _validator.TestValidate(ValidRequest());
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void ValidRequest_WithPhotosAndNote_PassesValidation()
    {
        var req = ValidRequest();
        req.PhotoBlobUrls = ["https://minio.local/bucket/photo1.jpg"];
        req.Note = "Tasty lunch!";

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void MealId_Empty_FailsValidation()
    {
        var req = ValidRequest();
        req.MealId = Guid.Empty;
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.MealId);
    }

    [Fact]
    public void Note_ExactlyFiveHundredChars_PassesValidation()
    {
        var req = ValidRequest();
        req.Note = new string('a', 500);

        var result = _validator.TestValidate(req);
        result.ShouldNotHaveValidationErrorFor(x => x.Note);
    }

    [Fact]
    public void Note_FiveHundredAndOneChars_FailsValidation()
    {
        var req = ValidRequest();
        req.Note = new string('a', 501);

        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.Note);
    }

    [Fact]
    public void Note_Null_PassesValidation()
    {
        var req = ValidRequest();
        req.Note = null;

        var result = _validator.TestValidate(req);
        result.ShouldNotHaveValidationErrorFor(x => x.Note);
    }

    [Fact]
    public void PhotoBlobUrls_EmptyString_FailsValidation()
    {
        var req = ValidRequest();
        req.PhotoBlobUrls = [string.Empty];

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void PhotoBlobUrls_NonHttpUrl_FailsValidation()
    {
        var req = ValidRequest();
        req.PhotoBlobUrls = ["ftp://some-server/photo.jpg"];

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void PhotoBlobUrls_ValidHttpsUrl_PassesValidation()
    {
        var req = ValidRequest();
        req.PhotoBlobUrls = ["https://minio.local/bucket/photo.jpg"];

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeTrue();
    }

    private static SeenMealItemRequest ValidItem() => new()
    {
        Kind = SeenMealItemKind.Food,
        RefId = Guid.NewGuid(),
        Name = "Rice",
        Amount = 100m,
        Kcal = 130m,
    };

    [Theory]
    [InlineData(0, true)]
    [InlineData(40, true)]
    [InlineData(41, false)]
    public void SeenMealItems_Count_ChecksUpperBound(int count, bool valid)
    {
        var req = ValidRequest();
        req.SeenMealItems = Enumerable.Range(0, count).Select(_ => ValidItem()).ToList();

        _validator.TestValidate(req).IsValid.Should().Be(valid);
    }

    [Fact]
    public void SeenMealItems_NullList_Passes()
    {
        var req = ValidRequest();
        req.SeenMealItems = null;

        _validator.TestValidate(req).IsValid.Should().BeTrue();
    }

    [Fact]
    public void SeenMealItems_NullItem_FailsValidation()
    {
        var req = ValidRequest();
        req.SeenMealItems = [null!];

        _validator.TestValidate(req).IsValid.Should().BeFalse();
    }

    [Fact]
    public void SeenMealItems_BoundaryValues_Pass()
    {
        var item = ValidItem();
        item.Name = new string('a', 200);
        item.Amount = 10000m;
        item.Kcal = 20000m;
        var lower = ValidItem();
        lower.Amount = 0m;
        lower.Kcal = 0m;
        var req = ValidRequest();
        req.SeenMealItems = [item, lower];

        _validator.TestValidate(req).IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("kind")]
    [InlineData("refId")]
    [InlineData("emptyName")]
    [InlineData("longName")]
    [InlineData("negativeAmount")]
    [InlineData("hugeAmount")]
    [InlineData("negativeKcal")]
    [InlineData("hugeKcal")]
    public void SeenMealItems_InvalidItem_FailsValidation(string defect)
    {
        var item = ValidItem();
        switch (defect)
        {
            case "kind": item.Kind = (SeenMealItemKind)99; break;
            case "refId": item.RefId = Guid.Empty; break;
            case "emptyName": item.Name = string.Empty; break;
            case "longName": item.Name = new string('a', 201); break;
            case "negativeAmount": item.Amount = -0.01m; break;
            case "hugeAmount": item.Amount = 10000.01m; break;
            case "negativeKcal": item.Kcal = -1m; break;
            case "hugeKcal": item.Kcal = 20000.01m; break;
        }

        var req = ValidRequest();
        req.SeenMealItems = [item];

        _validator.TestValidate(req).IsValid.Should().BeFalse();
    }

    [Fact]
    public void PhotoBlobUrls_Null_PassesValidation()
    {
        var req = ValidRequest();
        req.PhotoBlobUrls = null;

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeTrue();
    }
}
