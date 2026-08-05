using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FitnessPlatform.Application.Domain.Documents;
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
/// Integration tests for <c>POST /nutrition/meal-templates/{TemplateId}/copy</c>
/// (<see cref="Application.Features.MealTemplates.CopyMealTemplate.CopyMealTemplateEndpoint"/>) —
/// only the success paths, which call <c>Send.CreatedAtAsync</c> and therefore need the real
/// <c>LinkGenerator</c> that <see cref="FitnessApiFactory"/> provides (unavailable in the
/// lightweight <c>Factory.Create&lt;T&gt;()</c> host used by <see cref="MealTemplateEndpointTests"/>
/// for the 404 guard-branch case). Same precedent as <c>SendClientRequestEndpointTests</c>.
/// </summary>
[Collection(TestCollection.Name)]
public class CopyMealTemplateEndpointTests(FitnessApiFactory factory)
{
    // The API serializes enums as strings (JsonStringEnumConverter globally), so use matching
    // options when deserializing the test response — see the same pattern in
    // GetFullTrainingPlanIntegrationTests / QaSeedRunnerTests.
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private static string UniqueEmail(string tag) => $"{Guid.NewGuid():N}@{tag}-copy-meal-template-test.com";

    private async Task<(HttpClient Client, Guid NutritionistId)> RegisterNutritionistAsync(string tag)
    {
        var client = factory.CreateClient();
        var email = UniqueEmail(tag);
        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Copy", "MealTemplateTest", "Nutritionist");
        var (accessToken, _) = await TestHelpers.LoginAsync(client, email, "TestPass1!");
        TestHelpers.SetBearerToken(client, accessToken);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.FirstAsync(
            u => u.Email == email, TestContext.Current.CancellationToken);

        return (client, user.Id);
    }

    private async Task<MealTemplate> InsertTemplateAsync(Guid ownerId, LibraryVisibility visibility, string name)
    {
        var template = new MealTemplate
        {
            ExternalId = Guid.NewGuid(),
            OwnerId = ownerId,
            Name = name,
            Foods =
            [
                new MealFood
                {
                    FoodExternalId = Guid.NewGuid(),
                    FoodName = "Test Food",
                    NutrientValuePer100Grams = new NutrientValue { Kcal = 300, Protein = 10, Carbs = 10, Fat = 5 },
                    AmountGrams = 100
                }
            ],
            Visibility = visibility,
            DateCreated = DateTime.UtcNow,
            Version = 1
        };

        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        await mongo.MealTemplates.InsertOneAsync(template, cancellationToken: TestContext.Current.CancellationToken);
        return template;
    }

    private async Task<MealTemplate?> FindByExternalIdAsync(Guid externalId)
    {
        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        return await mongo.MealTemplates
            .Find(Builders<MealTemplate>.Filter.Eq(t => t.ExternalId, externalId))
            .FirstOrDefaultAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task CopyMealTemplate_OtherOwnersPublic_Succeeds_NotForbidden()
    {
        // The property the AC pins: copy is read-guarded, not write-guarded — another owner's
        // Public template must remain copyable. Wiring the write guard here would wrongly 403.
        var (_, ownerId) = await RegisterNutritionistAsync("owner");
        var (callerClient, callerId) = await RegisterNutritionistAsync("caller");
        var source = await InsertTemplateAsync(ownerId, LibraryVisibility.Public, "Shared Bowl");

        var response = await callerClient.PostAsJsonAsync(
            $"/nutrition/meal-templates/{source.ExternalId}/copy",
            new { },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var body = await response.Content.ReadFromJsonAsync<MealTemplateDetailResponse>(
            JsonOptions, TestContext.Current.CancellationToken);
        body!.TemplateId.Should().NotBe(source.ExternalId);

        var copy = await FindByExternalIdAsync(body.TemplateId);
        copy.Should().NotBeNull();
        copy!.OwnerId.Should().Be(callerId);
        copy.Visibility.Should().Be(LibraryVisibility.Private);

        var untouchedSource = await FindByExternalIdAsync(source.ExternalId);
        untouchedSource!.OwnerId.Should().Be(ownerId);
    }

    [Fact]
    public async Task CopyMealTemplate_OwnPrivate_Succeeds()
    {
        var (client, ownerId) = await RegisterNutritionistAsync("owner");
        var source = await InsertTemplateAsync(ownerId, LibraryVisibility.Private, "My Bowl");

        var response = await client.PostAsJsonAsync(
            $"/nutrition/meal-templates/{source.ExternalId}/copy",
            new { },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }
}
