using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using FitnessPlatform.Tests.Infrastructure;

namespace FitnessPlatform.Tests.Endpoints.Foods.UploadImageUrl;

/// <summary>
/// Integration tests for the food image upload flow:
///   POST /foods/{foodId}/image/upload-url?slot=main|gallery  (UploadFoodImageUrlEndpoint)
///   PUT  /foods/{foodId}/image?slot=main|gallery             (ConfirmFoodImageEndpoint)
///   GET  /foods/{foodId}                                     (GetFoodEndpoint — image reflection)
///
/// These tests use a real HTTP stack (FitnessApiFactory with Testcontainers) so
/// the authentication/authorisation middleware and the full DI pipeline are
/// exercised.  NSubstitute unit tests in the sibling file cover logic-level
/// branches; this file fills the AC gap by proving the role gate actually fires.
/// </summary>
[Collection(TestCollection.Name)]
public class FoodImageIntegrationTests(FitnessApiFactory factory)
{
    // ── Helpers ────────────────────────────────────────────────────────────────

    private static string UniqueEmail(string tag) => $"{Guid.NewGuid():N}@food-img-{tag}.test";

    /// <summary>
    /// Registers a user with the given role and returns a bearer token.
    /// </summary>
    private static async Task<string> SeedUserAsync(
        HttpClient client, string role, string tag = "")
    {
        var email = UniqueEmail(tag.Length > 0 ? tag : role.ToLowerInvariant());
        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Test", "User", role);
        var (accessToken, _) = await TestHelpers.LoginAsync(client, email, "TestPass1!");
        return accessToken;
    }

    /// <summary>
    /// Creates a food owned by <paramref name="ownerToken"/> and returns its FoodId.
    /// </summary>
    private static async Task<Guid> CreateFoodAsync(HttpClient client, string ownerToken)
    {
        TestHelpers.SetBearerToken(client, ownerToken);
        // Kcal = Protein×4 + Carbs×4 + Fat×9 → 10×4 + 10×4 + 5×9 = 125 (exactly consistent)
        var response = await client.PostAsJsonAsync("/foods", new
        {
            Name = $"Test Food {Guid.NewGuid():N}",
            NutrientValue = new
            {
                Kcal = 125m,
                Protein = 10m,
                Carbs = 10m,
                Fat = 5m
            },
            Allergens = Array.Empty<string>(),
            CommonServings = Array.Empty<object>()
        }, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created,
            "food creation must succeed for the integration test to proceed");

        var body = await response.Content.ReadFromJsonAsync<FoodResponse>(
            cancellationToken: TestContext.Current.CancellationToken);

        return body!.FoodId;
    }

    // ── Happy path: upload-url (main slot) ────────────────────────────────────

    /// <summary>
    /// A nutritionist requests an upload URL for their own food (main slot).
    /// Expects 200 with both <c>uploadUrl</c> and <c>blobUrl</c>;
    /// <c>blobUrl</c> must equal <c>foods/{foodId}.jpg</c>.
    /// </summary>
    [Fact]
    public async Task UploadUrl_Nutritionist_MainSlot_HappyPath_Returns200WithBlobUrl()
    {
        var client = factory.CreateClient();
        var token = await SeedUserAsync(client, "Nutritionist");
        var foodId = await CreateFoodAsync(client, token);

        TestHelpers.SetBearerToken(client, token);
        var response = await client.PostAsJsonAsync(
            $"/foods/{foodId}/image/upload-url?slot=main",
            new { ContentType = "image/jpeg", SizeBytes = 102400L },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<UploadUrlResponse>(
            cancellationToken: TestContext.Current.CancellationToken);

        body.Should().NotBeNull();
        body!.UploadUrl.Should().NotBeNullOrEmpty();
        body.BlobUrl.Should().Be($"foods/{foodId}.jpg");
    }

    // ── Happy path: upload-url (gallery slot) ─────────────────────────────────

    /// <summary>
    /// A nutritionist requests an upload URL for their own food (gallery slot, empty gallery).
    /// Expects 200 with <c>blobUrl</c> equal to <c>foods/{foodId}/gallery-0.jpg</c>.
    /// </summary>
    [Fact]
    public async Task UploadUrl_Nutritionist_GallerySlot_EmptyGallery_Returns200WithGalleryBlobUrl()
    {
        var client = factory.CreateClient();
        var token = await SeedUserAsync(client, "Nutritionist", "gallery-upload");
        var foodId = await CreateFoodAsync(client, token);

        TestHelpers.SetBearerToken(client, token);
        var response = await client.PostAsJsonAsync(
            $"/foods/{foodId}/image/upload-url?slot=gallery",
            new { ContentType = "image/jpeg", SizeBytes = 102400L },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<UploadUrlResponse>(
            cancellationToken: TestContext.Current.CancellationToken);

        body.Should().NotBeNull();
        body!.BlobUrl.Should().Be($"foods/{foodId}/gallery-0.jpg");
    }

    // ── Role gate: upload-url ──────────────────────────────────────────────────

    /// <summary>Trainer token → 403 on POST /foods/{foodId}/image/upload-url.</summary>
    [Fact]
    public async Task UploadUrl_TrainerRole_Returns403()
    {
        var client = factory.CreateClient();

        // Create a nutritionist to own the food, then attempt with a trainer.
        var nutritionistToken = await SeedUserAsync(client, "Nutritionist", "owner-t403");
        var foodId = await CreateFoodAsync(client, nutritionistToken);

        var trainerToken = await SeedUserAsync(client, "Trainer", "trainer-t403");
        TestHelpers.SetBearerToken(client, trainerToken);

        var response = await client.PostAsJsonAsync(
            $"/foods/{foodId}/image/upload-url?slot=main",
            new { ContentType = "image/jpeg", SizeBytes = 102400L },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    /// <summary>Client token → 403 on POST /foods/{foodId}/image/upload-url.</summary>
    [Fact]
    public async Task UploadUrl_ClientRole_Returns403()
    {
        var client = factory.CreateClient();

        var nutritionistToken = await SeedUserAsync(client, "Nutritionist", "owner-c403");
        var foodId = await CreateFoodAsync(client, nutritionistToken);

        var clientToken = await SeedUserAsync(client, "Client", "client-c403");
        TestHelpers.SetBearerToken(client, clientToken);

        var response = await client.PostAsJsonAsync(
            $"/foods/{foodId}/image/upload-url?slot=main",
            new { ContentType = "image/jpeg", SizeBytes = 102400L },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    /// <summary>No token → 401 on POST /foods/{foodId}/image/upload-url.</summary>
    [Fact]
    public async Task UploadUrl_Unauthenticated_Returns401()
    {
        var client = factory.CreateClient();

        // Seed a food so the route resolves (401 must fire even for existing foods)
        var nutritionistToken = await SeedUserAsync(client, "Nutritionist", "owner-unauth");
        var foodId = await CreateFoodAsync(client, nutritionistToken);

        // Issue request with no Authorization header
        client.DefaultRequestHeaders.Authorization = null;

        var response = await client.PostAsJsonAsync(
            $"/foods/{foodId}/image/upload-url?slot=main",
            new { ContentType = "image/jpeg", SizeBytes = 102400L },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── Ownership check: upload-url ────────────────────────────────────────────

    /// <summary>
    /// Nutritionist B tries to get an upload URL for a food owned by nutritionist A.
    /// Expects 400 with error code FOOD_NOT_OWNED in the Problem Details payload.
    /// </summary>
    [Fact]
    public async Task UploadUrl_NonOwner_Returns400WithFoodNotOwnedError()
    {
        var client = factory.CreateClient();

        // Nutritionist A creates the food
        var tokenA = await SeedUserAsync(client, "Nutritionist", "upload-owner-a");
        var foodId = await CreateFoodAsync(client, tokenA);

        // Nutritionist B tries to get the upload URL
        var tokenB = await SeedUserAsync(client, "Nutritionist", "upload-owner-b");
        TestHelpers.SetBearerToken(client, tokenB);

        var response = await client.PostAsJsonAsync(
            $"/foods/{foodId}/image/upload-url?slot=main",
            new { ContentType = "image/jpeg", SizeBytes = 102400L },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var raw = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        raw.Should().Contain("FOOD_NOT_OWNED",
            "the Problem Details payload must carry the FOOD_NOT_OWNED error code");
    }

    // ── Happy path: confirm + GET reflection (main slot) ──────────────────────

    /// <summary>
    /// Nutritionist confirms a main image URL via PUT /foods/{foodId}/image?slot=main.
    /// Subsequent GET /foods/{foodId} must return the DTO with imageUrl set.
    /// </summary>
    [Fact]
    public async Task ConfirmImage_MainSlot_HappyPath_Returns204_AndGetReflectsImageUrl()
    {
        var client = factory.CreateClient();
        var token = await SeedUserAsync(client, "Nutritionist", "confirm-happy");
        var foodId = await CreateFoodAsync(client, token);

        var blobUrl = $"foods/{foodId}.jpg";

        TestHelpers.SetBearerToken(client, token);

        // PUT to confirm the main image
        var putResponse = await client.PutAsJsonAsync(
            $"/foods/{foodId}/image?slot=main",
            new { BlobUrl = blobUrl },
            TestContext.Current.CancellationToken);

        putResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // GET must now return the food with imageUrl set
        var getResponse = await client.GetAsync(
            $"/foods/{foodId}",
            TestContext.Current.CancellationToken);

        getResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var food = await getResponse.Content.ReadFromJsonAsync<FoodResponse>(
            cancellationToken: TestContext.Current.CancellationToken);

        food.Should().NotBeNull();
        food!.FoodId.Should().Be(foodId);
        food.ImageUrl.Should().Be(blobUrl);
    }

    // ── Happy path: confirm + GET reflection (gallery slot) ───────────────────

    /// <summary>
    /// Nutritionist confirms a gallery image via PUT /foods/{foodId}/image?slot=gallery.
    /// Subsequent GET /foods/{foodId} must return the DTO with galleryImageUrls containing the blob URL.
    /// </summary>
    [Fact]
    public async Task ConfirmImage_GallerySlot_HappyPath_Returns204_AndGetReflectsGalleryUrl()
    {
        var client = factory.CreateClient();
        var token = await SeedUserAsync(client, "Nutritionist", "confirm-gallery");
        var foodId = await CreateFoodAsync(client, token);

        var galleryUrl = $"foods/{foodId}/gallery-0.jpg";

        TestHelpers.SetBearerToken(client, token);

        // PUT to confirm the gallery image
        var putResponse = await client.PutAsJsonAsync(
            $"/foods/{foodId}/image?slot=gallery",
            new { BlobUrl = galleryUrl },
            TestContext.Current.CancellationToken);

        putResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // GET must now return the food with galleryImageUrls containing the blob URL
        var getResponse = await client.GetAsync(
            $"/foods/{foodId}",
            TestContext.Current.CancellationToken);

        getResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var food = await getResponse.Content.ReadFromJsonAsync<FoodResponseWithGallery>(
            cancellationToken: TestContext.Current.CancellationToken);

        food.Should().NotBeNull();
        food!.FoodId.Should().Be(foodId);
        food.GalleryImageUrls.Should().ContainSingle(u => u == galleryUrl,
            "the confirmed gallery blob URL must appear in galleryImageUrls");
    }

    // ── Role gate: confirm ─────────────────────────────────────────────────────

    /// <summary>Trainer token → 403 on PUT /foods/{foodId}/image.</summary>
    [Fact]
    public async Task ConfirmImage_TrainerRole_Returns403()
    {
        var client = factory.CreateClient();

        var nutritionistToken = await SeedUserAsync(client, "Nutritionist", "confirm-trainer");
        var foodId = await CreateFoodAsync(client, nutritionistToken);

        var trainerToken = await SeedUserAsync(client, "Trainer", "confirm-trainer-t");
        TestHelpers.SetBearerToken(client, trainerToken);

        var response = await client.PutAsJsonAsync(
            $"/foods/{foodId}/image?slot=main",
            new { BlobUrl = $"foods/{foodId}.jpg" },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    /// <summary>Client token → 403 on PUT /foods/{foodId}/image.</summary>
    [Fact]
    public async Task ConfirmImage_ClientRole_Returns403()
    {
        var client = factory.CreateClient();

        var nutritionistToken = await SeedUserAsync(client, "Nutritionist", "confirm-client");
        var foodId = await CreateFoodAsync(client, nutritionistToken);

        var clientToken = await SeedUserAsync(client, "Client", "confirm-client-c");
        TestHelpers.SetBearerToken(client, clientToken);

        var response = await client.PutAsJsonAsync(
            $"/foods/{foodId}/image?slot=main",
            new { BlobUrl = $"foods/{foodId}.jpg" },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ── Ownership check on confirm ─────────────────────────────────────────────

    /// <summary>
    /// Nutritionist B tries to confirm an image on a food owned by nutritionist A.
    /// Expects 400 with error code FOOD_NOT_OWNED in the Problem Details payload.
    /// </summary>
    [Fact]
    public async Task ConfirmImage_NonOwner_Returns400WithFoodNotOwnedError()
    {
        var client = factory.CreateClient();

        // Nutritionist A creates the food
        var tokenA = await SeedUserAsync(client, "Nutritionist", "owner-a");
        var foodId = await CreateFoodAsync(client, tokenA);

        // Nutritionist B tries to confirm an image on it
        var tokenB = await SeedUserAsync(client, "Nutritionist", "owner-b");
        TestHelpers.SetBearerToken(client, tokenB);

        var response = await client.PutAsJsonAsync(
            $"/foods/{foodId}/image?slot=main",
            new { BlobUrl = $"foods/{foodId}.jpg" },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var raw = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        raw.Should().Contain("FOOD_NOT_OWNED",
            "the Problem Details payload must carry the FOOD_NOT_OWNED error code");
    }

    // ── Local response DTOs (per slice rules — no cross-feature imports) ────────

    private record UploadUrlResponse(string UploadUrl, string BlobUrl);

    private record FoodResponse(Guid FoodId, string Name, string? ImageUrl);

    private record FoodResponseWithGallery(Guid FoodId, string Name, string? ImageUrl, List<string> GalleryImageUrls);
}
