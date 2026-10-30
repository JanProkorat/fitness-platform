using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.ClientNutrition.LogMealEaten;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;

namespace FitnessPlatform.Tests.Endpoints.NutritionPlans;

/// <summary>
/// Integration tests for <see cref="NutritionPlan.RemovedMeals"/>: a full-state plan update records
/// the meals it drops, so an offline "eaten" mark for one of them is answered with a MealRemoved
/// conflict instead of a 404.
/// </summary>
[Collection(TestCollection.Name)]
public class UpdatePlanRemovedMealRecordIntegrationTests(FitnessApiFactory factory)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private readonly MealFood _food = PlanTestHelpers.CreateMealFood(foodName: "Rice");

    private static DateTime ThisMonday()
    {
        var today = DateTime.UtcNow.Date;
        return today.AddDays(-(((int)today.DayOfWeek + 6) % 7));
    }

    private async Task<(Actor Coach, Actor Client, Guid PlanId, Guid KeptMealId, Guid RemovedMealId)> SeedAsync()
    {
        var coach = await TestActors.Nutritionist(factory).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        await TestActors.Link(factory, coach, client).AsRole(UserRole.Nutritionist).CreateAsync(Ct);

        var keptMealId = Guid.NewGuid();
        var removedMealId = Guid.NewGuid();
        var planId = Guid.NewGuid();
        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        await mongo.NutritionPlans.InsertOneAsync(new NutritionPlan
        {
            ExternalId = planId,
            ClientId = client.UserId,
            NutritionistId = coach.UserId,
            Name = "Removal plan",
            Status = NutritionPlanStatus.Active,
            StartDate = DateTime.SpecifyKind(ThisMonday(), DateTimeKind.Utc),
            Version = 1,
            DateCreated = DateTime.UtcNow.AddDays(-1),
            Weeks =
            [
                new PlanWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    Days =
                    [
                        new PlanDay
                        {
                            DayOfWeek = 1,
                            Meals =
                            [
                                new PlanMeal { MealId = keptMealId, Kind = MealKind.Breakfast, Order = 1, Foods = [_food] },
                                new PlanMeal { MealId = removedMealId, Kind = MealKind.Dinner, Order = 2, Foods = [_food] },
                            ],
                        },
                    ],
                },
            ],
        }, cancellationToken: Ct);

        return (coach, client, planId, keptMealId, removedMealId);
    }

    private object MealBody(Guid mealId, string kind, int order) => new
    {
        MealId = mealId,
        Kind = kind,
        Order = order,
        Foods = new[]
        {
            new { FoodExternalId = _food.FoodExternalId, FoodName = _food.FoodName, AmountGrams = _food.AmountGrams },
        },
    };

    private static Task<HttpResponseMessage> PutAsync(Actor coach, Guid planId, int version, params object[] meals) =>
        coach.Http.PutAsJsonAsync($"/nutrition/plans/{planId}", new
        {
            PlanId = planId,
            Name = "Removal plan",
            Version = version,
            StartDate = ThisMonday(),
            Weeks = new[] { new { WeekNumber = 1, Days = new[] { new { DayOfWeek = 1, Meals = meals } } } },
        }, Ct);

    private static Task<HttpResponseMessage> LogAsync(Actor client, Guid mealId, int? basedOnPlanVersion) =>
        client.Http.PostAsJsonAsync($"/client/nutrition/log/meals/{mealId}/eaten",
            new LogMealEatenRequest { MealId = mealId, BasedOnPlanVersion = basedOnPlanVersion }, Ct);

    private async Task<NutritionPlan> LoadPlanAsync(Guid planId)
    {
        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        return await mongo.NutritionPlans.Find(p => p.ExternalId == planId).FirstAsync(Ct);
    }

    [Fact]
    public async Task OfflineMark_ForMealRemovedByUpdatePlan_RecordsMealRemovedConflictAndNotifiesAuthor()
    {
        var (coach, client, planId, keptMealId, removedMealId) = await SeedAsync();
        (await PutAsync(coach, planId, 1, MealBody(keptMealId, "Breakfast", 1))).StatusCode.Should().Be(HttpStatusCode.OK);

        var response = await LogAsync(client, removedMealId, basedOnPlanVersion: 1);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = (await response.Content.ReadFromJsonAsync<LogMealEatenResponse>(Json, Ct))!;
        body.MealLogged.Should().BeFalse();
        body.SyncConflictKind.Should().Be(OfflineSyncConflictKind.MealRemoved);

        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        (await mongo.MealLogs.Find(l => l.ClientId == client.UserId).ToListAsync(Ct)).Should().BeEmpty();
        var conflict = (await mongo.OfflineSyncConflicts.Find(c => c.ClientId == client.UserId).ToListAsync(Ct))
            .Should().ContainSingle().Subject;
        conflict.PlanId.Should().Be(planId);
        conflict.PlanAuthorId.Should().Be(coach.UserId);
        conflict.Kind.Should().Be(OfflineSyncConflictKind.MealRemoved);
        conflict.MealKind.Should().Be(MealKind.Dinner);
        conflict.MealLogged.Should().BeFalse();

        var db = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
        (await db.Notifications
                .Where(n => n.RecipientUserId == coach.UserId && n.Type == NotificationType.OfflineSyncConflict)
                .ToListAsync(Ct))
            .Should().ContainSingle();
    }

    [Fact]
    public async Task OfflineMark_ForMealReAddedWithSameId_IsNotTreatedAsRemoved()
    {
        var (coach, client, planId, keptMealId, removedMealId) = await SeedAsync();
        (await PutAsync(coach, planId, 1, MealBody(keptMealId, "Breakfast", 1))).StatusCode.Should().Be(HttpStatusCode.OK);
        (await PutAsync(coach, planId, 2, MealBody(keptMealId, "Breakfast", 1), MealBody(removedMealId, "Dinner", 2)))
            .StatusCode.Should().Be(HttpStatusCode.OK);

        (await LoadPlanAsync(planId)).RemovedMeals.Should().BeEmpty();
        var response = await LogAsync(client, removedMealId, basedOnPlanVersion: 3);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = (await response.Content.ReadFromJsonAsync<LogMealEatenResponse>(Json, Ct))!;
        body.MealLogged.Should().BeTrue();
        body.SyncConflict.Should().BeFalse();
    }

    [Fact]
    public async Task OnlineMark_ForMealRemovedByUpdatePlan_StillReturns404()
    {
        var (coach, client, planId, keptMealId, removedMealId) = await SeedAsync();
        (await PutAsync(coach, planId, 1, MealBody(keptMealId, "Breakfast", 1))).StatusCode.Should().Be(HttpStatusCode.OK);

        (await LogAsync(client, removedMealId, basedOnPlanVersion: null)).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task OfflineMark_ForUnknownMealId_Returns404()
    {
        var (coach, client, planId, keptMealId, _) = await SeedAsync();
        (await PutAsync(coach, planId, 1, MealBody(keptMealId, "Breakfast", 1))).StatusCode.Should().Be(HttpStatusCode.OK);

        (await LogAsync(client, Guid.NewGuid(), basedOnPlanVersion: 1)).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task UpdatePlan_LegacyDocumentWithoutRemovedMeals_LoadsAndRecordsTheRemoval()
    {
        var (coach, _, planId, keptMealId, removedMealId) = await SeedAsync();
        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            await mongo.NutritionPlans.UpdateOneAsync(
                p => p.ExternalId == planId, Builders<NutritionPlan>.Update.Unset("removedMeals"), cancellationToken: Ct);
            var raw = await mongo.NutritionPlans.Find(p => p.ExternalId == planId)
                .As<MongoDB.Bson.BsonDocument>()
                .FirstAsync(Ct);
            raw.Contains("removedMeals").Should().BeFalse();
        }

        (await LoadPlanAsync(planId)).RemovedMeals.Should().BeEmpty();
        (await PutAsync(coach, planId, 1, MealBody(keptMealId, "Breakfast", 1))).StatusCode.Should().Be(HttpStatusCode.OK);

        var removed = (await LoadPlanAsync(planId)).RemovedMeals.Should().ContainSingle().Subject;
        removed.MealId.Should().Be(removedMealId);
        removed.Kind.Should().Be(MealKind.Dinner);
        removed.RemovedAtPlanVersion.Should().Be(2);
    }

    [Fact]
    public async Task UpdatePlan_PrunesRemovedMealRecordsOlderThanEightDays()
    {
        var (coach, _, planId, keptMealId, _) = await SeedAsync();
        var staleId = Guid.NewGuid();
        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            await mongo.NutritionPlans.UpdateOneAsync(
                p => p.ExternalId == planId,
                Builders<NutritionPlan>.Update.Set(p => p.RemovedMeals,
                [
                    new RemovedPlanMeal { MealId = staleId, Kind = MealKind.Lunch, RemovedAtPlanVersion = 1, RemovedAt = DateTime.UtcNow.AddDays(-9) },
                ]),
                cancellationToken: Ct);
        }

        (await PutAsync(coach, planId, 1, MealBody(keptMealId, "Breakfast", 1))).StatusCode.Should().Be(HttpStatusCode.OK);

        (await LoadPlanAsync(planId)).RemovedMeals.Should().NotContain(r => r.MealId == staleId);
    }
}
