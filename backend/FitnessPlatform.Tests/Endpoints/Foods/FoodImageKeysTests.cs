using FitnessPlatform.Application.Features.Foods.Shared;
using FluentAssertions;

namespace FitnessPlatform.Tests.Endpoints.Foods;

/// <summary>
/// Tests for <see cref="FoodImageKeys"/>.
/// </summary>
public class FoodImageKeysTests
{
    [Theory]
    [InlineData("main", "jpg")]
    [InlineData("gallery", "webp")]
    public void NewSubPath_RoundTripsThroughTryParse(string slot, string extension)
    {
        var foodId = Guid.NewGuid();

        var subPath = FoodImageKeys.NewSubPath(foodId, slot, extension);

        subPath.Should().StartWith($"{foodId}/{slot}-").And.EndWith($".{extension}");
        FoodImageKeys.TryParse($"foods/{subPath}", slot, out var keyId).Should().BeTrue();
        keyId.Should().NotBe(Guid.Empty);
    }

    [Fact]
    public void NewSubPath_CalledTwice_ReturnsDistinctKeys()
    {
        var foodId = Guid.NewGuid();

        FoodImageKeys.NewSubPath(foodId, "gallery", "jpg")
            .Should().NotBe(FoodImageKeys.NewSubPath(foodId, "gallery", "jpg"));
    }

    [Theory]
    [InlineData("foods/abc/gallery-0.jpg")]
    [InlineData("foods/abc.jpg")]
    [InlineData("foods/abc/main-notahexguid.jpg")]
    [InlineData("https://evil.example/x.png")]
    public void TryParse_LegacyOrMalformedKey_ReturnsFalse(string blobUrl)
    {
        FoodImageKeys.TryParse(blobUrl, "gallery", out _).Should().BeFalse();
        FoodImageKeys.TryParse(blobUrl, "main", out _).Should().BeFalse();
    }

    [Fact]
    public void TryParse_SlotMismatch_ReturnsFalse()
    {
        var url = $"foods/{FoodImageKeys.NewSubPath(Guid.NewGuid(), "main", "jpg")}";

        FoodImageKeys.TryParse(url, "gallery", out _).Should().BeFalse();
    }
}
