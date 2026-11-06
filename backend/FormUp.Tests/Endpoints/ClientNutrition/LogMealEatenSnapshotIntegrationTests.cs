using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FluentAssertions;
using FormUp.Application.Domain.Documents;
using FormUp.Application.Domain.Enums;
using FormUp.Application.Features.ClientNutrition.GetTodayLog;
using FormUp.Application.Features.ClientNutrition.LogMealEaten;
using FormUp.Application.Infrastructure.Data.MongoDb;
using FormUp.Tests.Builders;
using FormUp.Tests.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;

namespace FormUp.Tests.Endpoints.ClientNutrition;

/// <summary>
/// Testcontainers integration tests for the meal-log snapshot of what was eaten: written when a row
/// first gets an eaten item, kept by later ticks, cleared when nothing is eaten, and read first by the
/// log readers even when the live plan has moved on.
/// </summary>
[Collection(TestCollection.Name)]
public class LogMealEatenSnapshotIntegrationTests(FitnessApiFactory factory)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() },
    };

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static string ItemRoute(Guid mealId, Guid itemId) =>
        $"/client/nutrition/log/meals/{mealId}/items/{itemId}/eaten";

    private static string MealRoute(Guid mealId) => $"/client/nutrition/log/meals/{mealId}/eaten";

    private async Task<MealLog> LoadRowAsync(Actor client, SeededItemMeal seeded) =>
        (await MealItemPlanSeeder.LoadLogsAsync(factory, client.UserId, seeded.MealId)).Should().ContainSingle().Subject;

    private async Task OverwriteSnapshotKcalAsync(Actor client, SeededItemMeal seeded, decimal kcal)
    {
        var row = await LoadRowAsync(client, seeded);
        row.EatenSnapshot!.ForEach(item => item.Kcal = kcal);

        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        await mongo.MealLogs.UpdateOneAsync(
            l => l.Id == row.Id, Builders<MealLog>.Update.Set(l => l.EatenSnapshot, row.EatenSnapshot), cancellationToken: Ct);
    }

    private static async Task<GetTodayLogResponse> ReadTodayAsync(Actor client)
    {
        var response = await client.Http.GetAsync("/client/nutrition/log/today", Ct);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        return (await response.Content.ReadFromJsonAsync<GetTodayLogResponse>(JsonOptions, Ct))!;
    }

    [Fact]
    public async Task LogMeal_Online_SnapshotsEveryItemWithFoodAndRecipeNutrients()
    {
        var client = await TestActors.Client(factory).CreateAsync();
        var seeded = await MealItemPlanSeeder.SeedAsync(factory, client.UserId);

        var response = await client.Http.PostAsJsonAsync(MealRoute(seeded.MealId), new { }, Ct);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var row = await LoadRowAsync(client, seeded);
        row.EatenItemIds.Should().BeEquivalentTo([seeded.FoodAId, seeded.FoodBId, seeded.RecipeId]);
        row.EatenSnapshot!.Select(item => (item.ItemId, item.Kind, item.Kcal)).Should().BeEquivalentTo(
        [
            (seeded.FoodAId, SeenMealItemKind.Food, 100m),
            (seeded.FoodBId, SeenMealItemKind.Food, 200m),
            (seeded.RecipeId, SeenMealItemKind.Recipe, 300m),
        ]);
    }

    [Fact]
    public async Task LogMeal_OfflineAgainstNewerPlan_SnapshotsTheSeenItems()
    {
        var client = await TestActors.Client(factory).CreateAsync();
        var seeded = await MealItemPlanSeeder.SeedAsync(factory, client.UserId);
        // The coach has since replaced the recipe; the client's queued log only knew the two foods.
        await MealItemPlanSeeder.RemoveItemAsync(factory, seeded, seeded.RecipeId);
        var seen = new List<SeenMealItemRequest>
        {
            new() { ItemId = seeded.FoodAId, Kind = SeenMealItemKind.Food, RefId = Guid.NewGuid(), Name = "Rice", Amount = 100m, Kcal = 100m, Protein = 2m, Carbs = 22m, Fat = 0.4m, Fibre = 1m },
            new() { ItemId = seeded.RecipeId, Kind = SeenMealItemKind.Recipe, RefId = Guid.NewGuid(), Name = "Bowl", Amount = 1m, Kcal = 300m, Protein = 20m, Carbs = 30m, Fat = 10m, Fibre = 5m },
        };

        var response = await client.Http.PostAsJsonAsync(
            MealRoute(seeded.MealId),
            new LogMealEatenRequest { MealId = seeded.MealId, BasedOnPlanVersion = 1, SeenMealItems = seen },
            Ct);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var row = await LoadRowAsync(client, seeded);
        row.EatenItemIds.Should().BeEquivalentTo([seeded.FoodAId, seeded.RecipeId]);
        row.EatenSnapshot!.Select(item => item.ItemId).Should().BeEquivalentTo([seeded.FoodAId, seeded.RecipeId]);
        row.EatenSnapshot!.Sum(item => item.Protein).Should().Be(22m);

        var today = await ReadTodayAsync(client);
        var meal = today.MealsEaten.Should().ContainSingle().Subject;
        meal.EatenState.Should().Be(MealEatenState.Eaten, "every snapshot item is eaten, whatever the live plan holds");
        meal.Totals.Kcal.Should().Be(400m);
        meal.Totals.Protein.Should().Be(22m);
    }

    [Fact]
    public async Task TickItem_FirstTick_SnapshotsTheWholeMealButMarksOnlyThatItem()
    {
        var client = await TestActors.Client(factory).CreateAsync();
        var seeded = await MealItemPlanSeeder.SeedAsync(factory, client.UserId);

        await client.Http.PostAsJsonAsync(ItemRoute(seeded.MealId, seeded.RecipeId), new { }, Ct);

        var row = await LoadRowAsync(client, seeded);
        row.EatenItemIds.Should().BeEquivalentTo([seeded.RecipeId]);
        row.EatenSnapshot!.Select(item => item.ItemId)
            .Should().BeEquivalentTo([seeded.FoodAId, seeded.FoodBId, seeded.RecipeId]);
        row.EatenSnapshot!.Single(item => item.ItemId == seeded.RecipeId).Kcal.Should().Be(300m);
    }

    [Fact]
    public async Task TickItem_SecondTick_KeepsTheExistingSnapshot()
    {
        var client = await TestActors.Client(factory).CreateAsync();
        var seeded = await MealItemPlanSeeder.SeedAsync(factory, client.UserId);
        await client.Http.PostAsJsonAsync(ItemRoute(seeded.MealId, seeded.FoodAId), new { }, Ct);
        await OverwriteSnapshotKcalAsync(client, seeded, 999m);

        await client.Http.PostAsJsonAsync(ItemRoute(seeded.MealId, seeded.FoodBId), new { }, Ct);

        var row = await LoadRowAsync(client, seeded);
        row.EatenItemIds.Should().BeEquivalentTo([seeded.FoodAId, seeded.FoodBId]);
        row.EatenSnapshot!.Should().OnlyContain(item => item.Kcal == 999m);
    }

    [Fact]
    public async Task LogWholeMeal_AfterATick_KeepsTheExistingSnapshot()
    {
        var client = await TestActors.Client(factory).CreateAsync();
        var seeded = await MealItemPlanSeeder.SeedAsync(factory, client.UserId);
        await client.Http.PostAsJsonAsync(ItemRoute(seeded.MealId, seeded.FoodAId), new { }, Ct);
        await OverwriteSnapshotKcalAsync(client, seeded, 999m);

        await client.Http.PostAsJsonAsync(MealRoute(seeded.MealId), new { }, Ct);

        var row = await LoadRowAsync(client, seeded);
        row.EatenAt.Should().NotBeNull();
        row.EatenSnapshot!.Should().OnlyContain(item => item.Kcal == 999m);
    }

    [Fact]
    public async Task LogWholeMeal_OnPhotoOnlyRow_WritesTheSnapshot()
    {
        var client = await TestActors.Client(factory).CreateAsync();
        var seeded = await MealItemPlanSeeder.SeedAsync(factory, client.UserId);
        await MealItemPlanSeeder.InsertLogAsync(factory, client.UserId, seeded, eatenAt: null);

        await client.Http.PostAsJsonAsync(MealRoute(seeded.MealId), new { }, Ct);

        var row = await LoadRowAsync(client, seeded);
        row.EatenSnapshot.Should().HaveCount(3);
        row.EatenItemIds.Should().HaveCount(3);
    }

    [Fact]
    public async Task TickItem_ItemRemovedFromLivePlanAfterSnapshot_StillTicksAndCompletesTheMeal()
    {
        var client = await TestActors.Client(factory).CreateAsync();
        var seeded = await MealItemPlanSeeder.SeedAsync(factory, client.UserId);
        await client.Http.PostAsJsonAsync(ItemRoute(seeded.MealId, seeded.FoodAId), new { }, Ct);
        await MealItemPlanSeeder.RemoveItemAsync(factory, seeded, seeded.FoodBId);

        var removed = await client.Http.PostAsJsonAsync(ItemRoute(seeded.MealId, seeded.FoodBId), new { }, Ct);
        var last = await client.Http.PostAsJsonAsync(ItemRoute(seeded.MealId, seeded.RecipeId), new { }, Ct);

        removed.StatusCode.Should().Be(HttpStatusCode.OK, "the snapshot, not the live meal, decides membership");
        last.StatusCode.Should().Be(HttpStatusCode.OK);
        (await LoadRowAsync(client, seeded)).EatenAt.Should().NotBeNull("all three snapshot items are eaten");
    }

    [Fact]
    public async Task TickItem_UnknownItem_WritesNoSnapshot()
    {
        var client = await TestActors.Client(factory).CreateAsync();
        var seeded = await MealItemPlanSeeder.SeedAsync(factory, client.UserId);

        var response = await client.Http.PostAsJsonAsync(ItemRoute(seeded.MealId, Guid.NewGuid()), new { }, Ct);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await MealItemPlanSeeder.LoadLogsAsync(factory, client.UserId, seeded.MealId)).Should().BeEmpty();
    }

    [Fact]
    public async Task Untick_NotTheLastItem_KeepsTheSnapshot()
    {
        var client = await TestActors.Client(factory).CreateAsync();
        var seeded = await MealItemPlanSeeder.SeedAsync(factory, client.UserId);
        await client.Http.PostAsJsonAsync(MealRoute(seeded.MealId), new { }, Ct);

        await client.Http.DeleteAsync(ItemRoute(seeded.MealId, seeded.RecipeId), Ct);

        var row = await LoadRowAsync(client, seeded);
        row.EatenItemIds.Should().HaveCount(2);
        row.EatenSnapshot.Should().HaveCount(3);
    }

    [Fact]
    public async Task Untick_LastItemOfARowWithANote_ClearsTheSnapshot()
    {
        var client = await TestActors.Client(factory).CreateAsync();
        var seeded = await MealItemPlanSeeder.SeedAsync(factory, client.UserId);
        await client.Http.PostAsJsonAsync(ItemRoute(seeded.MealId, seeded.FoodAId), new { }, Ct);
        await SetNoteAsync(client, seeded);

        await client.Http.DeleteAsync(ItemRoute(seeded.MealId, seeded.FoodAId), Ct);

        var row = await LoadRowAsync(client, seeded);
        row.EatenItemIds.Should().BeEmpty();
        row.EatenSnapshot.Should().BeNull();
    }

    [Fact]
    public async Task UnlogWholeMeal_OnARowWithANote_ClearsTheSnapshot()
    {
        var client = await TestActors.Client(factory).CreateAsync();
        var seeded = await MealItemPlanSeeder.SeedAsync(factory, client.UserId);
        await client.Http.PostAsJsonAsync(MealRoute(seeded.MealId), new { }, Ct);
        await SetNoteAsync(client, seeded);

        await client.Http.DeleteAsync(MealRoute(seeded.MealId), Ct);

        var row = await LoadRowAsync(client, seeded);
        row.EatenItemIds.Should().BeEmpty();
        row.EatenSnapshot.Should().BeNull();
    }

    [Fact]
    public async Task GetTodayLog_SnapshotRowAfterLivePlanChanged_ReportsTheSnapshotTotals()
    {
        var client = await TestActors.Client(factory).CreateAsync();
        var seeded = await MealItemPlanSeeder.SeedAsync(factory, client.UserId);
        await client.Http.PostAsJsonAsync(MealRoute(seeded.MealId), new { }, Ct);
        await MealItemPlanSeeder.RemoveItemAsync(factory, seeded, seeded.RecipeId);

        var today = await ReadTodayAsync(client);

        var meal = today.MealsEaten.Should().ContainSingle().Subject;
        meal.EatenState.Should().Be(MealEatenState.Eaten);
        meal.Totals.Kcal.Should().Be(600m, "100 + 200 + the 300 kcal recipe the coach later removed");
        today.TotalConsumed.Kcal.Should().Be(600m);
    }

    [Fact]
    public async Task GetTodayLog_LegacyRowWithoutSnapshot_StillReadsTheLivePlanMeal()
    {
        var client = await TestActors.Client(factory).CreateAsync();
        var seeded = await MealItemPlanSeeder.SeedAsync(factory, client.UserId);
        await MealItemPlanSeeder.InsertLogAsync(factory, client.UserId, seeded, eatenAt: null, seeded.FoodBId, seeded.RecipeId);

        var today = await ReadTodayAsync(client);

        var meal = today.MealsEaten.Should().ContainSingle().Subject;
        meal.EatenState.Should().Be(MealEatenState.PartlyEaten);
        meal.Totals.Kcal.Should().Be(500m, "200 kcal of food B plus the 300 kcal recipe, from the live meal");
    }

    private async Task SetNoteAsync(Actor client, SeededItemMeal seeded)
    {
        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        await mongo.MealLogs.UpdateOneAsync(
            l => l.ClientId == client.UserId && l.MealId == seeded.MealId,
            Builders<MealLog>.Update.Set(l => l.Note, "kept"),
            cancellationToken: Ct);
    }
}
