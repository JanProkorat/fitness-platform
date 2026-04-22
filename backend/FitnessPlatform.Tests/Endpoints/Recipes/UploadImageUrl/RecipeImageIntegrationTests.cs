using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using FitnessPlatform.Tests.Infrastructure;

namespace FitnessPlatform.Tests.Endpoints.Recipes.UploadImageUrl;

/// <summary>
/// Integration tests for the recipe image upload flow:
///   POST /recipes/{recipeId}/image/upload-url?slot={main|gallery}  (UploadRecipeImageUrlEndpoint)
///   PUT  /recipes/{recipeId}/image?slot={main|gallery}             (ConfirmRecipeImageEndpoint)
///   GET  /recipes/{recipeId}                                       (GetRecipeEndpoint — image reflection)
///
/// These tests use a real HTTP stack (FitnessApiFactory with Testcontainers) so
/// the authentication/authorisation middleware and the full DI pipeline are
/// exercised.  NSubstitute unit tests in the sibling file cover logic-level
/// branches; this file fills the AC gap by proving the role gate actually fires.
/// </summary>
[Collection(TestCollection.Name)]
public class RecipeImageIntegrationTests(FitnessApiFactory factory)
{
    // ── Helpers ────────────────────────────────────────────────────────────────

    private static string UniqueEmail(string tag) => $"{Guid.NewGuid():N}@recipe-img-{tag}.test";

    private static async Task<string> SeedUserAsync(
        HttpClient client, string role, string tag = "")
    {
        var email = UniqueEmail(tag.Length > 0 ? tag : role.ToLowerInvariant());
        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Test", "User", role);
        var (accessToken, _) = await TestHelpers.LoginAsync(client, email, "TestPass1!");
        return accessToken;
    }

    private static async Task<Guid> CreateFoodAsync(HttpClient client, string ownerToken)
    {
        TestHelpers.SetBearerToken(client, ownerToken);
        var response = await client.PostAsJsonAsync("/foods", new
        {
            Name = $"Test Food {Guid.NewGuid():N}",
            NutrientValue = new { Kcal = 125m, Protein = 10m, Carbs = 10m, Fat = 5m },
            Allergens = Array.Empty<string>(),
            CommonServings = Array.Empty<object>()
        }, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created,
            "food creation must succeed so a recipe can reference it");

        var body = await response.Content.ReadFromJsonAsync<FoodRef>(
            cancellationToken: TestContext.Current.CancellationToken);
        return body!.FoodId;
    }

    private static async Task<Guid> CreateRecipeAsync(HttpClient client, string ownerToken, Guid foodId)
    {
        TestHelpers.SetBearerToken(client, ownerToken);
        var response = await client.PostAsJsonAsync("/recipes", new
        {
            Name = $"Test Recipe {Guid.NewGuid():N}",
            Foods = new[]
            {
                new { FoodExternalId = foodId, AmountGrams = 100m }
            }
        }, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created,
            "recipe creation must succeed for the integration test to proceed");

        var body = await response.Content.ReadFromJsonAsync<RecipeRef>(
            cancellationToken: TestContext.Current.CancellationToken);
        return body!.RecipeId;
    }

    // ── Happy path: upload-url — main slot ─────────────────────────────────────

    /// <summary>
    /// A nutritionist requests an upload URL for the main slot of their own recipe.
    /// Expects 200 with both <c>uploadUrl</c> and <c>blobUrl</c>;
    /// <c>blobUrl</c> must equal <c>recipes/{recipeId}/main.jpg</c>.
    /// </summary>
    [Fact]
    public async Task UploadUrl_Nutritionist_MainSlot_HappyPath_Returns200WithBlobUrl()
    {
        var client = factory.CreateClient();
        var token = await SeedUserAsync(client, "Nutritionist", "main-happy");
        var foodId = await CreateFoodAsync(client, token);
        var recipeId = await CreateRecipeAsync(client, token, foodId);

        TestHelpers.SetBearerToken(client, token);
        var response = await client.PostAsJsonAsync(
            $"/recipes/{recipeId}/image/upload-url?slot=main",
            new { ContentType = "image/jpeg", SizeBytes = 102400L },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<UploadUrlResponse>(
            cancellationToken: TestContext.Current.CancellationToken);

        body.Should().NotBeNull();
        body!.UploadUrl.Should().NotBeNullOrEmpty();
        body.BlobUrl.Should().Be($"recipes/{recipeId}/main.jpg");
    }

    // ── Happy path: upload-url — gallery slot (0th entry) ──────────────────────

    /// <summary>
    /// A nutritionist requests an upload URL for the 0th gallery slot.
    /// <c>blobUrl</c> must equal <c>recipes/{recipeId}/gallery-0.jpg</c>.
    /// </summary>
    [Fact]
    public async Task UploadUrl_Nutritionist_GallerySlot_FirstEntry_Returns200WithGallery0BlobUrl()
    {
        var client = factory.CreateClient();
        var token = await SeedUserAsync(client, "Nutritionist", "gallery-happy");
        var foodId = await CreateFoodAsync(client, token);
        var recipeId = await CreateRecipeAsync(client, token, foodId);

        TestHelpers.SetBearerToken(client, token);
        var response = await client.PostAsJsonAsync(
            $"/recipes/{recipeId}/image/upload-url?slot=gallery",
            new { ContentType = "image/jpeg", SizeBytes = 102400L },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<UploadUrlResponse>(
            cancellationToken: TestContext.Current.CancellationToken);

        body.Should().NotBeNull();
        body!.BlobUrl.Should().Be($"recipes/{recipeId}/gallery-0.jpg");
    }

    // ── Role gate: upload-url ──────────────────────────────────────────────────

    /// <summary>Trainer token → 403 on POST /recipes/{id}/image/upload-url.</summary>
    [Fact]
    public async Task UploadUrl_TrainerRole_Returns403()
    {
        var client = factory.CreateClient();

        var nutritionistToken = await SeedUserAsync(client, "Nutritionist", "upload-trainer-owner");
        var foodId = await CreateFoodAsync(client, nutritionistToken);
        var recipeId = await CreateRecipeAsync(client, nutritionistToken, foodId);

        var trainerToken = await SeedUserAsync(client, "Trainer", "upload-trainer");
        TestHelpers.SetBearerToken(client, trainerToken);

        var response = await client.PostAsJsonAsync(
            $"/recipes/{recipeId}/image/upload-url?slot=main",
            new { ContentType = "image/jpeg", SizeBytes = 102400L },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    /// <summary>Client token → 403 on POST /recipes/{id}/image/upload-url.</summary>
    [Fact]
    public async Task UploadUrl_ClientRole_Returns403()
    {
        var client = factory.CreateClient();

        var nutritionistToken = await SeedUserAsync(client, "Nutritionist", "upload-client-owner");
        var foodId = await CreateFoodAsync(client, nutritionistToken);
        var recipeId = await CreateRecipeAsync(client, nutritionistToken, foodId);

        var clientToken = await SeedUserAsync(client, "Client", "upload-client");
        TestHelpers.SetBearerToken(client, clientToken);

        var response = await client.PostAsJsonAsync(
            $"/recipes/{recipeId}/image/upload-url?slot=main",
            new { ContentType = "image/jpeg", SizeBytes = 102400L },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    /// <summary>No token → 401 on POST /recipes/{id}/image/upload-url.</summary>
    [Fact]
    public async Task UploadUrl_Unauthenticated_Returns401()
    {
        var client = factory.CreateClient();

        var nutritionistToken = await SeedUserAsync(client, "Nutritionist", "upload-unauth-owner");
        var foodId = await CreateFoodAsync(client, nutritionistToken);
        var recipeId = await CreateRecipeAsync(client, nutritionistToken, foodId);

        client.DefaultRequestHeaders.Authorization = null;

        var response = await client.PostAsJsonAsync(
            $"/recipes/{recipeId}/image/upload-url?slot=main",
            new { ContentType = "image/jpeg", SizeBytes = 102400L },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── Ownership gate: upload-url ─────────────────────────────────────────────

    /// <summary>
    /// Nutritionist B requests an upload URL for a recipe owned by nutritionist A.
    /// Expects 400 with RECIPE_NOT_OWNED.
    /// </summary>
    [Fact]
    public async Task UploadUrl_NonOwner_Returns400WithRecipeNotOwnedError()
    {
        var client = factory.CreateClient();

        var tokenA = await SeedUserAsync(client, "Nutritionist", "upload-owner-a");
        var foodId = await CreateFoodAsync(client, tokenA);
        var recipeId = await CreateRecipeAsync(client, tokenA, foodId);

        var tokenB = await SeedUserAsync(client, "Nutritionist", "upload-owner-b");
        TestHelpers.SetBearerToken(client, tokenB);

        var response = await client.PostAsJsonAsync(
            $"/recipes/{recipeId}/image/upload-url?slot=main",
            new { ContentType = "image/jpeg", SizeBytes = 102400L },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var raw = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        raw.Should().Contain("RECIPE_NOT_OWNED",
            "the Problem Details payload must carry the RECIPE_NOT_OWNED error code");
    }

    // ── Gallery cap: upload-url ────────────────────────────────────────────────

    /// <summary>
    /// Gallery is filled to 6 entries via confirm, then a 7th upload-url request returns 400 RECIPE_GALLERY_FULL.
    /// </summary>
    [Fact]
    public async Task UploadUrl_GalleryFull_Returns400WithRecipeGalleryFullError()
    {
        var client = factory.CreateClient();
        var token = await SeedUserAsync(client, "Nutritionist", "gallery-full-upload");
        var foodId = await CreateFoodAsync(client, token);
        var recipeId = await CreateRecipeAsync(client, token, foodId);

        TestHelpers.SetBearerToken(client, token);

        // Confirm 6 gallery entries
        for (var i = 0; i < 6; i++)
        {
            var confirmResponse = await client.PutAsJsonAsync(
                $"/recipes/{recipeId}/image?slot=gallery",
                new { BlobUrl = $"recipes/{recipeId}/gallery-{i}.jpg" },
                TestContext.Current.CancellationToken);

            confirmResponse.StatusCode.Should().Be(HttpStatusCode.NoContent,
                $"confirming gallery entry {i} should succeed");
        }

        // Now try to request a 7th upload URL
        var response = await client.PostAsJsonAsync(
            $"/recipes/{recipeId}/image/upload-url?slot=gallery",
            new { ContentType = "image/jpeg", SizeBytes = 102400L },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var raw = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        raw.Should().Contain("RECIPE_GALLERY_FULL",
            "the Problem Details payload must carry the RECIPE_GALLERY_FULL error code");
    }

    // ── Happy path: confirm + GET reflection — main slot ──────────────────────

    /// <summary>
    /// Nutritionist confirms a main image via PUT /recipes/{id}/image?slot=main.
    /// Subsequent GET /recipes/{id} must return the DTO with imageUrl set.
    /// </summary>
    [Fact]
    public async Task ConfirmImage_MainSlot_HappyPath_Returns204_AndGetReflectsImageUrl()
    {
        var client = factory.CreateClient();
        var token = await SeedUserAsync(client, "Nutritionist", "confirm-main-happy");
        var foodId = await CreateFoodAsync(client, token);
        var recipeId = await CreateRecipeAsync(client, token, foodId);

        var blobUrl = $"recipes/{recipeId}/main.jpg";

        TestHelpers.SetBearerToken(client, token);

        var putResponse = await client.PutAsJsonAsync(
            $"/recipes/{recipeId}/image?slot=main",
            new { BlobUrl = blobUrl },
            TestContext.Current.CancellationToken);

        putResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var getResponse = await client.GetAsync(
            $"/recipes/{recipeId}",
            TestContext.Current.CancellationToken);

        getResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var recipe = await getResponse.Content.ReadFromJsonAsync<RecipeDetailResponse>(
            cancellationToken: TestContext.Current.CancellationToken);

        recipe.Should().NotBeNull();
        recipe!.RecipeId.Should().Be(recipeId);
        recipe.ImageUrl.Should().Be(blobUrl);
    }

    // ── Happy path: confirm + GET reflection — gallery slot ───────────────────

    /// <summary>
    /// Nutritionist confirms a gallery image via PUT /recipes/{id}/image?slot=gallery.
    /// Subsequent GET /recipes/{id} must include the new entry in galleryImageUrls.
    /// </summary>
    [Fact]
    public async Task ConfirmImage_GallerySlot_HappyPath_Returns204_AndGetReflectsGalleryImageUrls()
    {
        var client = factory.CreateClient();
        var token = await SeedUserAsync(client, "Nutritionist", "confirm-gallery-happy");
        var foodId = await CreateFoodAsync(client, token);
        var recipeId = await CreateRecipeAsync(client, token, foodId);

        var galleryBlobUrl = $"recipes/{recipeId}/gallery-0.jpg";

        TestHelpers.SetBearerToken(client, token);

        var putResponse = await client.PutAsJsonAsync(
            $"/recipes/{recipeId}/image?slot=gallery",
            new { BlobUrl = galleryBlobUrl },
            TestContext.Current.CancellationToken);

        putResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var getResponse = await client.GetAsync(
            $"/recipes/{recipeId}",
            TestContext.Current.CancellationToken);

        getResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var recipe = await getResponse.Content.ReadFromJsonAsync<RecipeDetailResponse>(
            cancellationToken: TestContext.Current.CancellationToken);

        recipe.Should().NotBeNull();
        recipe!.GalleryImageUrls.Should().ContainSingle(u => u == galleryBlobUrl);
    }

    // ── Gallery cap: confirm ───────────────────────────────────────────────────

    /// <summary>
    /// Attempting to confirm a 7th gallery entry via PUT /recipes/{id}/image?slot=gallery
    /// when the gallery already has 6 entries returns 400 RECIPE_GALLERY_FULL.
    /// </summary>
    [Fact]
    public async Task ConfirmImage_GalleryOverflow_Returns400WithRecipeGalleryFullError()
    {
        var client = factory.CreateClient();
        var token = await SeedUserAsync(client, "Nutritionist", "gallery-full-confirm");
        var foodId = await CreateFoodAsync(client, token);
        var recipeId = await CreateRecipeAsync(client, token, foodId);

        TestHelpers.SetBearerToken(client, token);

        // Confirm 6 gallery entries
        for (var i = 0; i < 6; i++)
        {
            var confirmResponse = await client.PutAsJsonAsync(
                $"/recipes/{recipeId}/image?slot=gallery",
                new { BlobUrl = $"recipes/{recipeId}/gallery-{i}.jpg" },
                TestContext.Current.CancellationToken);

            confirmResponse.StatusCode.Should().Be(HttpStatusCode.NoContent,
                $"confirming gallery entry {i} should succeed");
        }

        // Attempt a 7th confirm — must fail with RECIPE_GALLERY_FULL
        var response = await client.PutAsJsonAsync(
            $"/recipes/{recipeId}/image?slot=gallery",
            new { BlobUrl = $"recipes/{recipeId}/gallery-6.jpg" },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var raw = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        raw.Should().Contain("RECIPE_GALLERY_FULL",
            "the Problem Details payload must carry the RECIPE_GALLERY_FULL error code");
    }

    // ── Role gate: confirm ─────────────────────────────────────────────────────

    /// <summary>Trainer token → 403 on PUT /recipes/{id}/image.</summary>
    [Fact]
    public async Task ConfirmImage_TrainerRole_Returns403()
    {
        var client = factory.CreateClient();

        var nutritionistToken = await SeedUserAsync(client, "Nutritionist", "confirm-trainer-owner");
        var foodId = await CreateFoodAsync(client, nutritionistToken);
        var recipeId = await CreateRecipeAsync(client, nutritionistToken, foodId);

        var trainerToken = await SeedUserAsync(client, "Trainer", "confirm-trainer");
        TestHelpers.SetBearerToken(client, trainerToken);

        var response = await client.PutAsJsonAsync(
            $"/recipes/{recipeId}/image?slot=main",
            new { BlobUrl = $"recipes/{recipeId}/main.jpg" },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    /// <summary>Client token → 403 on PUT /recipes/{id}/image.</summary>
    [Fact]
    public async Task ConfirmImage_ClientRole_Returns403()
    {
        var client = factory.CreateClient();

        var nutritionistToken = await SeedUserAsync(client, "Nutritionist", "confirm-client-owner");
        var foodId = await CreateFoodAsync(client, nutritionistToken);
        var recipeId = await CreateRecipeAsync(client, nutritionistToken, foodId);

        var clientToken = await SeedUserAsync(client, "Client", "confirm-client");
        TestHelpers.SetBearerToken(client, clientToken);

        var response = await client.PutAsJsonAsync(
            $"/recipes/{recipeId}/image?slot=main",
            new { BlobUrl = $"recipes/{recipeId}/main.jpg" },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ── Ownership check on confirm ─────────────────────────────────────────────

    /// <summary>
    /// Nutritionist B tries to confirm an image on a recipe owned by nutritionist A.
    /// Expects 400 with RECIPE_NOT_OWNED.
    /// </summary>
    [Fact]
    public async Task ConfirmImage_NonOwner_Returns400WithRecipeNotOwnedError()
    {
        var client = factory.CreateClient();

        var tokenA = await SeedUserAsync(client, "Nutritionist", "confirm-owner-a");
        var foodId = await CreateFoodAsync(client, tokenA);
        var recipeId = await CreateRecipeAsync(client, tokenA, foodId);

        var tokenB = await SeedUserAsync(client, "Nutritionist", "confirm-owner-b");
        TestHelpers.SetBearerToken(client, tokenB);

        var response = await client.PutAsJsonAsync(
            $"/recipes/{recipeId}/image?slot=main",
            new { BlobUrl = $"recipes/{recipeId}/main.jpg" },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var raw = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        raw.Should().Contain("RECIPE_NOT_OWNED",
            "the Problem Details payload must carry the RECIPE_NOT_OWNED error code");
    }

    // ── Local response DTOs (per slice rules — no cross-feature imports) ────────

    private record UploadUrlResponse(string UploadUrl, string BlobUrl);
    private record FoodRef(Guid FoodId);
    private record RecipeRef(Guid RecipeId);
    private record RecipeDetailResponse(Guid RecipeId, string Name, string? ImageUrl, List<string> GalleryImageUrls);
}
