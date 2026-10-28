using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;

namespace FitnessPlatform.Tests.Endpoints.ClientNutrition;

/// <summary>
/// Testcontainers integration tests (real MongoDB and PostgreSQL) proving that
/// <c>POST /client/nutrition/log/meals/{MealId}/photos</c> only accepts photo URLs under the
/// meal's own <c>diary/{mealId}/</c> folder, and that legacy photos already on the log still re-save.
/// </summary>
[Collection(TestCollection.Name)]
public class SaveMealPhotosIntegrationTests(FitnessApiFactory factory)
{
    private static DateTime TodayUtc => DateTime.UtcNow.Date;

    private async Task<(Actor Client, Guid PlanId, Guid MealId)> SeedClientWithMealAsync()
    {
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);

        // Pin the client's zone to UTC so the UTC-based "today" equals the endpoint's client-local today.
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await db.Users
                .Where(u => u.Id == client.UserId)
                .ExecuteUpdateAsync(s => s.SetProperty(u => u.TimeZone, "UTC"), TestContext.Current.CancellationToken);
        }

        var mealId = Guid.NewGuid();
        var meal = new PlanMeal
        {
            MealId = mealId,
            Kind = MealKind.Lunch,
            Order = 1,
            Foods =
            [
                new MealFood
                {
                    FoodExternalId = Guid.NewGuid(),
                    FoodName = "Rice",
                    NutrientValuePer100Grams = new NutrientValue { Kcal = 100, Protein = 10, Carbs = 10, Fat = 5 },
                    AmountGrams = 150,
                },
            ],
        };

        // A real author: the photo dual-write adds a viewer row with a FK to the users table.
        var author = await TestActors.Nutritionist(factory).CreateAsync(TestContext.Current.CancellationToken);
        var plan = await ClientNutritionFixtures.InsertPlanAsync(
            factory,
            client.UserId,
            NutritionPlanStatus.Active,
            ClientNutritionFixtures.CurrentWeekMondayUtc(),
            author.UserId,
            null,
            new PlanWeek
            {
                WeekNumber = 1,
                Status = WeekStatus.Published,
                DatePublished = DateTime.UtcNow,
                Days = Enumerable.Range(1, 7)
                    .Select(day => new PlanDay { DayOfWeek = day, Meals = [meal] })
                    .ToList(),
            });

        return (client, plan.ExternalId, mealId);
    }

    private static Task<HttpResponseMessage> SavePhotosAsync(Actor client, Guid mealId, params string[] photoUrls) =>
        client.Http.PostAsJsonAsync(
            $"/client/nutrition/log/meals/{mealId}/photos",
            new { Photos = photoUrls.Select(url => new { BlobUrl = url }).ToArray() },
            TestContext.Current.CancellationToken);

    private async Task<List<MealLog>> LoadLogsAsync(Guid clientUserId, Guid mealId)
    {
        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        return await mongo.MealLogs
            .Find(l => l.ClientId == clientUserId && l.MealId == mealId)
            .ToListAsync(TestContext.Current.CancellationToken);
    }

    private async Task<int> CountPlanPhotosAsync(Guid planId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
        return await db.PlanPhotos.AsNoTracking().CountAsync(p => p.PlanId == planId, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task SavePhotos_UrlUnderMealFolder_Returns204AndPersists()
    {
        var (client, planId, mealId) = await SeedClientWithMealAsync();
        var url = $"diary/{mealId}/{Guid.NewGuid():N}.jpg";

        var response = await SavePhotosAsync(client, mealId, url);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await LoadLogsAsync(client.UserId, mealId)).Should().ContainSingle()
            .Which.Photos.Should().ContainSingle().Which.BlobUrl.Should().Be(url);
        (await CountPlanPhotosAsync(planId)).Should().Be(1);
    }

    [Fact]
    public async Task SavePhotos_ForeignUrl_Returns400AndSavesNothing()
    {
        var (client, planId, mealId) = await SeedClientWithMealAsync();
        var foreignUrl = $"diary/{Guid.NewGuid()}/{Guid.NewGuid():N}.jpg";

        var response = await SavePhotosAsync(client, mealId, $"diary/{mealId}/{Guid.NewGuid():N}.jpg", foreignUrl);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        body.RootElement.GetProperty("errorCode").GetString().Should().Be("INVALID_BLOB_URL");
        (await LoadLogsAsync(client.UserId, mealId)).Should().BeEmpty();
        (await CountPlanPhotosAsync(planId)).Should().Be(0);
    }

    [Fact]
    public async Task SavePhotos_LegacyPhotoAlreadyOnLog_Returns204AndKeepsUploadedAt()
    {
        var (client, planId, mealId) = await SeedClientWithMealAsync();
        const string legacyUrl = "plan-photos/legacy-folder/legacy.jpg";
        var uploadedAt = DateTime.UtcNow.AddDays(-1);

        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            await mongo.MealLogs.InsertOneAsync(
                new MealLog
                {
                    ClientId = client.UserId,
                    PlanId = planId,
                    MealId = mealId,
                    LogDate = TodayUtc,
                    Photos = [new MealPhoto { BlobUrl = legacyUrl, UploadedAt = uploadedAt }],
                },
                cancellationToken: TestContext.Current.CancellationToken);
        }

        var response = await SavePhotosAsync(client, mealId, legacyUrl);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        var photo = (await LoadLogsAsync(client.UserId, mealId)).Should().ContainSingle()
            .Which.Photos.Should().ContainSingle().Subject;
        photo.BlobUrl.Should().Be(legacyUrl);
        photo.UploadedAt.Should().BeCloseTo(uploadedAt, TimeSpan.FromSeconds(1));
    }
}
