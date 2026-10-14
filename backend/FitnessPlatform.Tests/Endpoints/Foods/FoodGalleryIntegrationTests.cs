using System.Net;
using System.Net.Http.Json;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;

namespace FitnessPlatform.Tests.Endpoints.Foods;

/// <summary>
/// Integration tests for the food gallery picture flow: unique upload keys, remove and promote.
/// </summary>
[Collection(TestCollection.Name)]
public class FoodGalleryIntegrationTests(FitnessApiFactory factory)
{
    private static async Task<string> SeedNutritionistAsync(HttpClient client, string tag)
    {
        var email = $"{Guid.NewGuid():N}@food-gallery-{tag}.test";
        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Test", "User", "Nutritionist");
        var (accessToken, _) = await TestHelpers.LoginAsync(client, email, "TestPass1!");
        return accessToken;
    }

    private static string NewKey(Guid foodId, string slot) =>
        $"foods/{foodId}/{slot}-{Guid.NewGuid():N}.jpg";

    private async Task<(HttpClient Client, string Token, Guid FoodId)> CreateOwnedFoodAsync(string tag)
    {
        var client = factory.CreateClient();
        var token = await SeedNutritionistAsync(client, tag);
        var foodId = await TestHelpers.CreateFoodAsync(client, token, TestContext.Current.CancellationToken);
        TestHelpers.SetBearerToken(client, token);
        return (client, token, foodId);
    }

    private static async Task ConfirmAsync(HttpClient client, Guid foodId, string slot, string blobUrl)
    {
        var response = await client.PutAsJsonAsync(
            $"/foods/{foodId}/image?slot={slot}", new { BlobUrl = blobUrl },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    private static Task<HttpResponseMessage> TryConfirmAsync(HttpClient client, Guid foodId, string slot, string blobUrl) =>
        client.PutAsJsonAsync($"/foods/{foodId}/image?slot={slot}", new { BlobUrl = blobUrl },
            TestContext.Current.CancellationToken);

    private static async Task<FoodDetail> GetAsync(HttpClient client, Guid foodId)
    {
        var response = await client.GetAsync($"/foods/{foodId}", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        return (await response.Content.ReadFromJsonAsync<FoodDetail>(
            cancellationToken: TestContext.Current.CancellationToken))!;
    }

    private static Task<HttpResponseMessage> PromoteAsync(HttpClient client, Guid foodId, string imageUrl) =>
        client.PostAsJsonAsync($"/foods/{foodId}/gallery/promote", new { ImageUrl = imageUrl },
            TestContext.Current.CancellationToken);

    private static Task<HttpResponseMessage> RemoveAsync(HttpClient client, Guid foodId, string imageUrl) =>
        client.DeleteAsync($"/foods/{foodId}/gallery?imageUrl={Uri.EscapeDataString(imageUrl)}",
            TestContext.Current.CancellationToken);

    private async Task SetLegacyImagesAsync(Guid foodId, string? mainUrl, params string[] galleryUrls)
    {
        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        await mongo.Foods.UpdateOneAsync(
            Builders<Food>.Filter.Eq(f => f.ExternalId, foodId),
            Builders<Food>.Update
                .Set(f => f.ImageUrl, mainUrl)
                .Set(f => f.GalleryImageUrls, galleryUrls.ToList()),
            cancellationToken: TestContext.Current.CancellationToken);
    }

    private static async Task DeleteFoodAsync(HttpClient client, Guid foodId)
    {
        var response = await client.DeleteAsync($"/foods/{foodId}", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    // ── Unique upload keys ─────────────────────────────────────────────────

    [Theory]
    [InlineData("main")]
    [InlineData("gallery")]
    public async Task UploadUrl_TwiceAndAfterMiddleRemoval_NeverReusesAKey(string slot)
    {
        var (client, _, foodId) = await CreateOwnedFoodAsync($"keys-{slot}");
        var issued = new List<string>();

        for (var i = 0; i < 2; i++)
        {
            var response = await client.PostAsJsonAsync(
                $"/foods/{foodId}/image/upload-url?slot={slot}",
                new { ContentType = "image/jpeg", SizeBytes = 1024L }, TestContext.Current.CancellationToken);
            response.StatusCode.Should().Be(HttpStatusCode.OK);
            issued.Add((await response.Content.ReadFromJsonAsync<UploadUrl>(
                cancellationToken: TestContext.Current.CancellationToken))!.BlobUrl);
        }

        issued.Distinct().Should().HaveCount(2);

        if (slot == "gallery")
        {
            var stored = new[] { NewKey(foodId, "gallery"), NewKey(foodId, "gallery"), NewKey(foodId, "gallery") };
            foreach (var url in stored)
            {
                await ConfirmAsync(client, foodId, "gallery", url);
            }

            (await RemoveAsync(client, foodId, stored[1])).StatusCode.Should().Be(HttpStatusCode.NoContent);

            var next = await client.PostAsJsonAsync(
                $"/foods/{foodId}/image/upload-url?slot=gallery",
                new { ContentType = "image/jpeg", SizeBytes = 1024L }, TestContext.Current.CancellationToken);
            var nextUrl = (await next.Content.ReadFromJsonAsync<UploadUrl>(
                cancellationToken: TestContext.Current.CancellationToken))!.BlobUrl;

            stored.Should().NotContain(nextUrl);
            issued.Should().NotContain(nextUrl);
        }
    }

    // ── Confirm ────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("main")]
    [InlineData("gallery")]
    public async Task ConfirmImage_LegacyPositionalUrl_Returns400InvalidBlobUrl(string slot)
    {
        var (client, _, foodId) = await CreateOwnedFoodAsync($"legacy-confirm-{slot}");
        var legacyUrl = slot == "main" ? $"foods/{foodId}.jpg" : $"foods/{foodId}/gallery-0.jpg";

        var response = await TryConfirmAsync(client, foodId, slot, legacyUrl);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).Should().Contain("INVALID_BLOB_URL");
        var food = await GetAsync(client, foodId);
        food.ImageUrl.Should().BeNull();
        food.GalleryImageUrls.Should().BeEmpty();
    }

    [Fact]
    public async Task ConfirmImage_SameGalleryUrlTwice_SecondIsRejected_NoDuplicate()
    {
        var (client, _, foodId) = await CreateOwnedFoodAsync("dup");
        var url = NewKey(foodId, "gallery");
        await ConfirmAsync(client, foodId, "gallery", url);

        var second = await TryConfirmAsync(client, foodId, "gallery", url);

        second.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await second.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).Should().Contain("INVALID_BLOB_URL");
        (await GetAsync(client, foodId)).GalleryImageUrls.Should().ContainSingle();
    }

    [Fact]
    public async Task ConfirmImage_MainKeyOnGallerySlot_Returns400InvalidBlobUrl()
    {
        var (client, _, foodId) = await CreateOwnedFoodAsync("main-as-gallery");
        var main = NewKey(foodId, "main");
        await ConfirmAsync(client, foodId, "main", main);

        var response = await TryConfirmAsync(client, foodId, "gallery", main);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).Should().Contain("INVALID_BLOB_URL");
    }

    [Fact]
    public async Task ConfirmImage_SeventhGalleryImage_Returns400FoodGalleryFull_AndKeepsSix()
    {
        var (client, _, foodId) = await CreateOwnedFoodAsync("cap");
        for (var i = 0; i < 6; i++)
        {
            await ConfirmAsync(client, foodId, "gallery", NewKey(foodId, "gallery"));
        }

        var response = await TryConfirmAsync(client, foodId, "gallery", NewKey(foodId, "gallery"));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).Should().Contain("FOOD_GALLERY_FULL");
        (await GetAsync(client, foodId)).GalleryImageUrls.Should().HaveCount(6);
    }

    [Fact]
    public async Task ConfirmImage_SoftDeletedFood_Returns404()
    {
        var (client, _, foodId) = await CreateOwnedFoodAsync("confirm-deleted");
        await DeleteFoodAsync(client, foodId);

        var response = await TryConfirmAsync(client, foodId, "gallery", NewKey(foodId, "gallery"));

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Remove ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task RemoveGalleryImage_Owner_RemovesOnlyThatUrl_KeepsOrder_IsIdempotent()
    {
        var (client, _, foodId) = await CreateOwnedFoodAsync("remove");
        var urls = new[] { NewKey(foodId, "gallery"), NewKey(foodId, "gallery"), NewKey(foodId, "gallery") };
        foreach (var url in urls)
        {
            await ConfirmAsync(client, foodId, "gallery", url);
        }

        for (var attempt = 0; attempt < 2; attempt++)
        {
            (await RemoveAsync(client, foodId, urls[1])).StatusCode.Should().Be(HttpStatusCode.NoContent);
        }

        (await GetAsync(client, foodId)).GalleryImageUrls.Should().Equal(urls[0], urls[2]);
    }

    [Fact]
    public async Task RemoveGalleryImage_UrlNotPresent_Returns204_AndChangesNothing()
    {
        var (client, _, foodId) = await CreateOwnedFoodAsync("remove-absent");
        var url = NewKey(foodId, "gallery");
        await ConfirmAsync(client, foodId, "gallery", url);

        (await RemoveAsync(client, foodId, NewKey(foodId, "gallery"))).StatusCode.Should().Be(HttpStatusCode.NoContent);

        (await GetAsync(client, foodId)).GalleryImageUrls.Should().Equal(url);
    }

    [Fact]
    public async Task RemoveGalleryImage_LegacyPositionalUrlStoredOnDocument_IsRemoved()
    {
        var (client, _, foodId) = await CreateOwnedFoodAsync("remove-legacy");
        var legacy = $"foods/{foodId}/gallery-0.jpg";
        var current = NewKey(foodId, "gallery");
        await SetLegacyImagesAsync(foodId, null, legacy, current);

        (await RemoveAsync(client, foodId, legacy)).StatusCode.Should().Be(HttpStatusCode.NoContent);

        (await GetAsync(client, foodId)).GalleryImageUrls.Should().Equal(current);
    }

    [Fact]
    public async Task RemoveGalleryImage_NonOwner_Returns400FoodNotOwned_AndKeepsGallery()
    {
        var (client, ownerToken, foodId) = await CreateOwnedFoodAsync("remove-owner");
        var url = NewKey(foodId, "gallery");
        await ConfirmAsync(client, foodId, "gallery", url);

        TestHelpers.SetBearerToken(client, await SeedNutritionistAsync(client, "remove-other"));
        var response = await RemoveAsync(client, foodId, url);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).Should().Contain("FOOD_NOT_OWNED");

        TestHelpers.SetBearerToken(client, ownerToken);
        (await GetAsync(client, foodId)).GalleryImageUrls.Should().Equal(url);
    }

    [Fact]
    public async Task RemoveGalleryImage_MissingFood_Returns404()
    {
        var (client, _, _) = await CreateOwnedFoodAsync("remove-missing");

        var response = await RemoveAsync(client, Guid.NewGuid(), "foods/x/gallery-a.jpg");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task RemoveGalleryImage_SoftDeletedFood_Returns404()
    {
        var (client, _, foodId) = await CreateOwnedFoodAsync("remove-deleted");
        var url = NewKey(foodId, "gallery");
        await ConfirmAsync(client, foodId, "gallery", url);
        await DeleteFoodAsync(client, foodId);

        (await RemoveAsync(client, foodId, url)).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task RemoveGalleryImage_EmptyImageUrl_Returns400()
    {
        var (client, _, foodId) = await CreateOwnedFoodAsync("remove-empty");

        var response = await client.DeleteAsync($"/foods/{foodId}/gallery", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ── Promote ────────────────────────────────────────────────────────────

    [Fact]
    public async Task Promote_WithMain_SwapsAtSameIndex()
    {
        var (client, _, foodId) = await CreateOwnedFoodAsync("promote-swap");
        var main = NewKey(foodId, "main");
        var gallery = new[] { NewKey(foodId, "gallery"), NewKey(foodId, "gallery"), NewKey(foodId, "gallery") };
        await ConfirmAsync(client, foodId, "main", main);
        foreach (var url in gallery)
        {
            await ConfirmAsync(client, foodId, "gallery", url);
        }

        (await PromoteAsync(client, foodId, gallery[1])).StatusCode.Should().Be(HttpStatusCode.NoContent);

        var after = await GetAsync(client, foodId);
        after.ImageUrl.Should().Be(gallery[1]);
        after.GalleryImageUrls.Should().Equal(gallery[0], main, gallery[2]);
    }

    [Fact]
    public async Task Promote_WithoutMain_MovesEntryOutOfGallery_KeepingOthersInPlace()
    {
        var (client, _, foodId) = await CreateOwnedFoodAsync("promote-nomain");
        var gallery = new[] { NewKey(foodId, "gallery"), NewKey(foodId, "gallery"), NewKey(foodId, "gallery") };
        foreach (var url in gallery)
        {
            await ConfirmAsync(client, foodId, "gallery", url);
        }

        (await PromoteAsync(client, foodId, gallery[1])).StatusCode.Should().Be(HttpStatusCode.NoContent);

        var after = await GetAsync(client, foodId);
        after.ImageUrl.Should().Be(gallery[1]);
        after.GalleryImageUrls.Should().Equal(gallery[0], gallery[2]);
    }

    [Fact]
    public async Task Promote_CurrentMain_IsNoOp204()
    {
        var (client, _, foodId) = await CreateOwnedFoodAsync("promote-main");
        var main = NewKey(foodId, "main");
        var galleryUrl = NewKey(foodId, "gallery");
        await ConfirmAsync(client, foodId, "main", main);
        await ConfirmAsync(client, foodId, "gallery", galleryUrl);

        (await PromoteAsync(client, foodId, main)).StatusCode.Should().Be(HttpStatusCode.NoContent);

        var after = await GetAsync(client, foodId);
        after.ImageUrl.Should().Be(main);
        after.GalleryImageUrls.Should().Equal(galleryUrl);
    }

    [Fact]
    public async Task Promote_LegacyPositionalUrlStoredOnDocument_IsPromoted()
    {
        var (client, _, foodId) = await CreateOwnedFoodAsync("promote-legacy");
        var legacyMain = $"foods/{foodId}.jpg";
        var legacyGallery = $"foods/{foodId}/gallery-0.jpg";
        await SetLegacyImagesAsync(foodId, legacyMain, legacyGallery);

        (await PromoteAsync(client, foodId, legacyGallery)).StatusCode.Should().Be(HttpStatusCode.NoContent);

        var after = await GetAsync(client, foodId);
        after.ImageUrl.Should().Be(legacyGallery);
        after.GalleryImageUrls.Should().Equal(legacyMain);
    }

    [Fact]
    public async Task Promote_UnknownUrl_Returns400GalleryImageNotFound()
    {
        var (client, _, foodId) = await CreateOwnedFoodAsync("promote-unknown");

        var response = await PromoteAsync(client, foodId, NewKey(foodId, "gallery"));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken))
            .Should().Contain("FOOD_GALLERY_IMAGE_NOT_FOUND");
    }

    [Fact]
    public async Task Promote_NonOwner_Returns400FoodNotOwned_AndKeepsImages()
    {
        var (client, ownerToken, foodId) = await CreateOwnedFoodAsync("promote-owner");
        var url = NewKey(foodId, "gallery");
        await ConfirmAsync(client, foodId, "gallery", url);

        TestHelpers.SetBearerToken(client, await SeedNutritionistAsync(client, "promote-other"));
        var response = await PromoteAsync(client, foodId, url);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).Should().Contain("FOOD_NOT_OWNED");

        TestHelpers.SetBearerToken(client, ownerToken);
        var after = await GetAsync(client, foodId);
        after.ImageUrl.Should().BeNull();
        after.GalleryImageUrls.Should().Equal(url);
    }

    [Fact]
    public async Task Promote_MissingFood_Returns404()
    {
        var (client, _, _) = await CreateOwnedFoodAsync("promote-missing");

        var response = await PromoteAsync(client, Guid.NewGuid(), "foods/x/gallery-a.jpg");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Promote_SoftDeletedFood_Returns404()
    {
        var (client, _, foodId) = await CreateOwnedFoodAsync("promote-deleted");
        var url = NewKey(foodId, "gallery");
        await ConfirmAsync(client, foodId, "gallery", url);
        await DeleteFoodAsync(client, foodId);

        (await PromoteAsync(client, foodId, url)).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Promote_EmptyImageUrl_Returns400()
    {
        var (client, _, foodId) = await CreateOwnedFoodAsync("promote-empty");

        var response = await PromoteAsync(client, foodId, string.Empty);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    private record UploadUrl(string BlobUrl);
    private record FoodDetail(Guid FoodId, string? ImageUrl, List<string> GalleryImageUrls);
}
