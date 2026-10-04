using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using FitnessPlatform.Tests.Infrastructure;

namespace FitnessPlatform.Tests.Endpoints.Foods.DeleteFoodImage;

/// <summary>
/// Integration tests for <c>DELETE /foods/{foodId}/image</c> (DeleteFoodImageEndpoint).
/// Uses a real HTTP stack (FitnessApiFactory with Testcontainers) so the authentication/
/// authorisation middleware and the full DI pipeline are exercised.
/// </summary>
[Collection(TestCollection.Name)]
public class DeleteFoodImageEndpointTests(FitnessApiFactory factory)
{
    // ── Helpers ────────────────────────────────────────────────────────────────

    private static string UniqueEmail(string tag) => $"{Guid.NewGuid():N}@delete-food-img-{tag}.test";

    /// <summary>
    /// Registers a nutritionist and returns a bearer token.
    /// </summary>
    private static async Task<string> SeedNutritionistAsync(HttpClient client, string tag = "")
    {
        var email = UniqueEmail(tag.Length > 0 ? tag : "nutritionist");
        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Test", "User", "Nutritionist");
        var (accessToken, _) = await TestHelpers.LoginAsync(client, email, "TestPass1!");
        return accessToken;
    }

    /// <summary>
    /// Confirms a main-slot image on <paramref name="foodId"/> via a real upload-url + confirm
    /// round trip, as <paramref name="ownerToken"/>, and returns the confirmed blobUrl.
    /// </summary>
    private static async Task<string> ConfirmMainImageAsync(HttpClient client, string ownerToken, Guid foodId)
    {
        TestHelpers.SetBearerToken(client, ownerToken);

        var uploadUrlResponse = await client.PostAsJsonAsync(
            $"/foods/{foodId}/image/upload-url?slot=main",
            new { ContentType = "image/jpeg", SizeBytes = 102400L },
            TestContext.Current.CancellationToken);

        uploadUrlResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var uploadUrlBody = await uploadUrlResponse.Content.ReadFromJsonAsync<UploadUrlResponse>(
            cancellationToken: TestContext.Current.CancellationToken);

        var confirmResponse = await client.PutAsJsonAsync(
            $"/foods/{foodId}/image?slot=main",
            new { BlobUrl = uploadUrlBody!.BlobUrl },
            TestContext.Current.CancellationToken);

        confirmResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        return uploadUrlBody.BlobUrl;
    }

    // ── Happy path: remove an existing image ──────────────────────────────────

    /// <summary>
    /// The owning nutritionist removes a previously-confirmed main image.
    /// Expects 204, and a subsequent GET must reflect <c>imageUrl: null</c> while the
    /// gallery is left untouched.
    /// </summary>
    [Fact]
    public async Task Delete_OwnerWithExistingImage_Returns204_AndGetReflectsNullImageUrlWithGalleryIntact()
    {
        var client = factory.CreateClient();
        var token = await SeedNutritionistAsync(client, "remove-happy");
        var foodId = await TestHelpers.CreateFoodAsync(client, token, TestContext.Current.CancellationToken);

        await ConfirmMainImageAsync(client, token, foodId);

        // Add a gallery entry too, to prove it survives the main-image removal.
        TestHelpers.SetBearerToken(client, token);
        var galleryUploadUrlResponse = await client.PostAsJsonAsync(
            $"/foods/{foodId}/image/upload-url?slot=gallery",
            new { ContentType = "image/jpeg", SizeBytes = 102400L },
            TestContext.Current.CancellationToken);
        var galleryUploadUrlBody = await galleryUploadUrlResponse.Content.ReadFromJsonAsync<UploadUrlResponse>(
            cancellationToken: TestContext.Current.CancellationToken);
        var galleryConfirmResponse = await client.PutAsJsonAsync(
            $"/foods/{foodId}/image?slot=gallery",
            new { BlobUrl = galleryUploadUrlBody!.BlobUrl },
            TestContext.Current.CancellationToken);
        galleryConfirmResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        TestHelpers.SetBearerToken(client, token);
        var deleteResponse = await client.DeleteAsync(
            $"/foods/{foodId}/image",
            TestContext.Current.CancellationToken);

        deleteResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var getResponse = await client.GetAsync($"/foods/{foodId}", TestContext.Current.CancellationToken);
        getResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var food = await getResponse.Content.ReadFromJsonAsync<FoodResponse>(
            cancellationToken: TestContext.Current.CancellationToken);

        food.Should().NotBeNull();
        food!.ImageUrl.Should().BeNull();
        food.GalleryImageUrls.Should().ContainSingle(u => u == galleryUploadUrlBody.BlobUrl,
            "removing the main image must not touch the gallery");
    }

    // ── Idempotency: already-null image ───────────────────────────────────────

    /// <summary>
    /// The owning nutritionist removes an image that was never set.
    /// Expects 204 — the endpoint is idempotent.
    /// </summary>
    [Fact]
    public async Task Delete_OwnerWithNoExistingImage_Returns204()
    {
        var client = factory.CreateClient();
        var token = await SeedNutritionistAsync(client, "remove-already-null");
        var foodId = await TestHelpers.CreateFoodAsync(client, token, TestContext.Current.CancellationToken);

        TestHelpers.SetBearerToken(client, token);
        var deleteResponse = await client.DeleteAsync(
            $"/foods/{foodId}/image",
            TestContext.Current.CancellationToken);

        deleteResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var getResponse = await client.GetAsync($"/foods/{foodId}", TestContext.Current.CancellationToken);
        var food = await getResponse.Content.ReadFromJsonAsync<FoodResponse>(
            cancellationToken: TestContext.Current.CancellationToken);

        food!.ImageUrl.Should().BeNull();
    }

    // ── Ownership check ────────────────────────────────────────────────────────

    /// <summary>
    /// Nutritionist B tries to remove the image on a food owned by nutritionist A.
    /// Expects 400 with error code FOOD_NOT_OWNED in the Problem Details payload.
    /// </summary>
    [Fact]
    public async Task Delete_NonOwner_Returns400WithFoodNotOwnedError()
    {
        var client = factory.CreateClient();

        var tokenA = await SeedNutritionistAsync(client, "owner-a");
        var foodId = await TestHelpers.CreateFoodAsync(client, tokenA, TestContext.Current.CancellationToken);
        await ConfirmMainImageAsync(client, tokenA, foodId);

        var tokenB = await SeedNutritionistAsync(client, "owner-b");
        TestHelpers.SetBearerToken(client, tokenB);

        var response = await client.DeleteAsync(
            $"/foods/{foodId}/image",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var raw = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        raw.Should().Contain("FOOD_NOT_OWNED",
            "the Problem Details payload must carry the FOOD_NOT_OWNED error code");
    }

    // ── Unknown food ───────────────────────────────────────────────────────────

    /// <summary>
    /// Removing the image on a food id that never existed returns a bare 404.
    /// </summary>
    [Fact]
    public async Task Delete_UnknownFoodId_Returns404()
    {
        var client = factory.CreateClient();
        var token = await SeedNutritionistAsync(client, "unknown-food");
        TestHelpers.SetBearerToken(client, token);

        var response = await client.DeleteAsync(
            $"/foods/{Guid.NewGuid()}/image",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Soft-deleted food ──────────────────────────────────────────────────────

    /// <summary>
    /// Removing the image on a food the owner has already soft-deleted returns a bare 404 —
    /// the same denial shape as an unknown food, so existence of the soft-deleted row is not
    /// leaked.
    /// </summary>
    [Fact]
    public async Task Delete_SoftDeletedFood_Returns404()
    {
        var client = factory.CreateClient();
        var token = await SeedNutritionistAsync(client, "soft-deleted");
        var foodId = await TestHelpers.CreateFoodAsync(client, token, TestContext.Current.CancellationToken);

        TestHelpers.SetBearerToken(client, token);
        var softDeleteResponse = await client.DeleteAsync(
            $"/foods/{foodId}",
            TestContext.Current.CancellationToken);
        softDeleteResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var response = await client.DeleteAsync(
            $"/foods/{foodId}/image",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Local response DTOs (per slice rules — no cross-feature imports) ────────

    private record UploadUrlResponse(string UploadUrl, string BlobUrl);

    private record FoodResponse(Guid FoodId, string Name, string? ImageUrl, List<string> GalleryImageUrls);
}
