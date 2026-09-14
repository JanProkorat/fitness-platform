using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.MealTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;

namespace FitnessPlatform.Tests.Endpoints.MealTemplates;

/// <summary>
/// Integration test for <c>POST /nutrition/meal-templates</c>
/// (<see cref="Application.Features.MealTemplates.CreateMealTemplate.CreateMealTemplateEndpoint"/>).
/// Uses <see cref="FitnessApiFactory"/> (Testcontainers-backed PostgreSQL + MongoDB) rather than
/// the lightweight <c>Factory.Create&lt;T&gt;()</c> host used by
/// <see cref="MealTemplateEndpointTests"/> — the endpoint's success path calls
/// <c>Send.CreatedAtAsync</c>, which requires a real <c>LinkGenerator</c>, unavailable in that
/// lightweight host (same precedent as <c>SendClientRequestEndpointTests</c>).
/// </summary>
[Collection(TestCollection.Name)]
public class CreateMealTemplateEndpointTests(FitnessApiFactory factory)
{
    // The API serializes enums as strings (JsonStringEnumConverter globally), so use matching
    // options when deserializing the test response — see the same pattern in
    // GetFullTrainingPlanIntegrationTests / QaSeedRunnerTests.
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private static string UniqueEmail() => $"{Guid.NewGuid():N}@create-meal-template-test.com";

    private async Task<(HttpClient Client, Guid NutritionistId)> RegisterNutritionistAsync()
    {
        var client = factory.CreateClient();
        var email = UniqueEmail();
        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Create", "MealTemplateTest", "Nutritionist");
        var (accessToken, _) = await TestHelpers.LoginAsync(client, email, "TestPass1!");
        TestHelpers.SetBearerToken(client, accessToken);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.FirstAsync(
            u => u.Email == email, TestContext.Current.CancellationToken);

        return (client, user.Id);
    }

    [Fact]
    public async Task CreateMealTemplate_ValidRequest_RecomputesTotalsServerSide()
    {
        var (client, nutritionistId) = await RegisterNutritionistAsync();
        var foods = new[]
        {
            new
            {
                FoodExternalId = Guid.NewGuid(),
                FoodName = "Chicken",
                NutrientValuePer100Grams = new { Kcal = 165, Protein = 31, Carbs = 0, Fat = 3.6m },
                AmountGrams = 200
            }
        };

        var response = await client.PostAsJsonAsync(
            "/nutrition/meal-templates",
            new { Name = "Chicken Bowl", Foods = foods },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var body = await response.Content.ReadFromJsonAsync<MealTemplateDetailResponse>(
            JsonOptions, TestContext.Current.CancellationToken);
        body!.TotalNutrients.Kcal.Should().Be(330m);
        body.TotalNutrients.Protein.Should().Be(62m);

        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        var persisted = await mongo.MealTemplates
            .Find(t => t.ExternalId == body.TemplateId)
            .FirstOrDefaultAsync(TestContext.Current.CancellationToken);

        persisted.Should().NotBeNull();
        persisted!.OwnerId.Should().Be(nutritionistId);
        persisted.Visibility.Should().Be(LibraryVisibility.Private);
        persisted.Version.Should().Be(1);
    }
}
