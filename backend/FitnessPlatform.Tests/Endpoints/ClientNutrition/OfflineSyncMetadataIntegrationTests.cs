using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.ClientMeasurements.AddMeasurement;
using FitnessPlatform.Application.Features.ClientMeasurements.Shared;
using FitnessPlatform.Application.Features.ClientNutrition.AddOffPlanFood;
using FitnessPlatform.Application.Features.ClientNutrition.LogMealEaten;
using FitnessPlatform.Application.Features.ClientNutrition.SetShoppingListItemTicked;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.NutritionPlans;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;

namespace FitnessPlatform.Tests.Endpoints.ClientNutrition;

/// <summary>
/// Integration tests (real MongoDB and PostgreSQL) for the optional offline-sync fields
/// (<c>OccurredAt</c>, <c>ClientRequestId</c>, <c>BasedOnPlanVersion</c>, client <c>EntryId</c>)
/// on the client nutrition write endpoints and <c>POST /client/measurements</c>.
/// </summary>
[Collection(TestCollection.Name)]
public class OfflineSyncMetadataIntegrationTests(FitnessApiFactory factory)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    private static DateTime Today => DateTime.UtcNow.Date;

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    /// <summary>Noon UTC, <paramref name="daysAgo"/> days before today.</summary>
    private static DateTimeOffset NoonDaysAgo(int daysAgo) => new(Today.AddDays(-daysAgo).AddHours(12), TimeSpan.Zero);

    private static string Query(DateTimeOffset? occurredAt = null, Guid? clientRequestId = null)
    {
        var parts = new List<string>();

        if (occurredAt is not null)
        {
            parts.Add($"occurredAt={Uri.EscapeDataString(occurredAt.Value.ToString("o"))}");
        }

        if (clientRequestId is not null)
        {
            parts.Add($"clientRequestId={clientRequestId}");
        }

        return parts.Count == 0 ? string.Empty : "?" + string.Join("&", parts);
    }

    private static PlanMeal NewMeal() =>
        ClientNutritionFixtures.MealWithFoods(MealKind.Lunch, PlanTestHelpers.CreateMealFood(foodName: "Rice"));

    /// <summary>Active plan whose single published week started <paramref name="startedDaysAgo"/> days ago.</summary>
    private Task<NutritionPlan> InsertPlanAsync(Actor client, PlanMeal meal, int startedDaysAgo = 5) =>
        ClientNutritionFixtures.InsertPlanAsync(factory, client.UserId, NutritionPlanStatus.Active,
            Today.AddDays(-startedDaysAgo), null, null,
            ClientNutritionFixtures.Week(1, WeekStatus.Published, meal));

    private static Task<HttpResponseMessage> LogAsync(Actor client, Guid mealId, DateTimeOffset? occurredAt = null,
        Guid? clientRequestId = null, int? basedOnPlanVersion = null) =>
        client.Http.PostAsJsonAsync($"/client/nutrition/log/meals/{mealId}/eaten",
            new LogMealEatenRequest
            {
                MealId = mealId,
                OccurredAt = occurredAt,
                ClientRequestId = clientRequestId,
                BasedOnPlanVersion = basedOnPlanVersion,
            }, Ct);

    private static Task<HttpResponseMessage> AddOffPlanAsync(Actor client, Guid foodId, DateTimeOffset? occurredAt = null,
        Guid? clientRequestId = null, Guid? entryId = null) =>
        client.Http.PostAsJsonAsync("/client/nutrition/log/off-plan-foods",
            new AddOffPlanFoodRequest
            {
                FoodExternalId = foodId,
                AmountGrams = 100,
                OccurredAt = occurredAt,
                ClientRequestId = clientRequestId,
                EntryId = entryId,
                BasedOnPlanVersion = 4,
            }, Ct);

    private static Task<HttpResponseMessage> RemoveOffPlanAsync(Actor client, Guid entryId, DateTimeOffset? occurredAt = null,
        Guid? clientRequestId = null) =>
        client.Http.DeleteAsync($"/client/nutrition/log/off-plan-foods/{entryId}{Query(occurredAt, clientRequestId)}", Ct);

    private static Task<HttpResponseMessage> TickAsync(Actor client, Guid foodId, DateTimeOffset? occurredAt = null) =>
        client.Http.PutAsJsonAsync("/client/nutrition/plan/shopping-list/ticks",
            new SetShoppingListItemTickedRequest
            {
                WeekNumber = 1,
                FoodExternalId = foodId,
                IsTicked = true,
                OccurredAt = occurredAt,
            }, Ct);

    private async Task<List<MealLog>> LoadMealLogsAsync(Guid clientId)
    {
        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        return await mongo.MealLogs.Find(l => l.ClientId == clientId).ToListAsync(Ct);
    }

    private async Task<List<DayLog>> LoadDayLogsAsync(Guid clientId)
    {
        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        return await mongo.DayLogs.Find(l => l.ClientId == clientId).ToListAsync(Ct);
    }

    private static async Task<AddOffPlanFoodResponse> ReadEntryAsync(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<AddOffPlanFoodResponse>(Json, Ct))!;

    // ── LogMealEaten ────────────────────────────────────────────────────

    [Fact]
    public async Task Log_BackDatedOccurredAt_LandsOnThatLocalDay_AndStoresPlanVersion()
    {
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        var meal = NewMeal();
        await InsertPlanAsync(client, meal);
        var occurred = NoonDaysAgo(2);

        // A +02:00 offset must be converted to UTC before the day is resolved.
        var response = await LogAsync(client, meal.MealId, occurred.ToOffset(TimeSpan.FromHours(2)), basedOnPlanVersion: 7);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var log = (await LoadMealLogsAsync(client.UserId)).Should().ContainSingle().Subject;
        log.LogDate.Should().Be(Today.AddDays(-2));
        log.EatenAt.Should().BeCloseTo(occurred.UtcDateTime, TimeSpan.FromSeconds(1));
        log.BasedOnPlanVersion.Should().Be(7);
    }

    [Fact]
    public async Task Log_DuplicateClientRequestId_AppliedOnce_AndLaterUnlogIsNotUndone()
    {
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        var meal = NewMeal();
        await InsertPlanAsync(client, meal);
        var requestId = Guid.NewGuid();

        (await LogAsync(client, meal.MealId, clientRequestId: requestId)).StatusCode.Should().Be(HttpStatusCode.Created);
        (await LogAsync(client, meal.MealId, clientRequestId: requestId)).StatusCode.Should().Be(HttpStatusCode.Created);
        (await LoadMealLogsAsync(client.UserId)).Should().ContainSingle();

        (await client.Http.DeleteAsync($"/client/nutrition/log/meals/{meal.MealId}/eaten", Ct))
            .StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await LogAsync(client, meal.MealId, clientRequestId: requestId)).StatusCode.Should().Be(HttpStatusCode.Created);

        (await LoadMealLogsAsync(client.UserId)).Should().BeEmpty();
    }

    [Fact]
    public async Task Log_FirstAttemptNotFound_IsNotRecorded_SoRetryApplies()
    {
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        var meal = NewMeal();
        var requestId = Guid.NewGuid();

        (await LogAsync(client, meal.MealId, clientRequestId: requestId)).StatusCode.Should().Be(HttpStatusCode.NotFound);

        await InsertPlanAsync(client, meal);
        (await LogAsync(client, meal.MealId, clientRequestId: requestId)).StatusCode.Should().Be(HttpStatusCode.Created);

        (await LoadMealLogsAsync(client.UserId)).Should().ContainSingle();
    }

    [Fact]
    public async Task Log_OccurredAtTooOld_Returns400()
    {
        var client = await TestActors.Client(factory).CreateAsync(Ct);

        var response = await LogAsync(client, Guid.NewGuid(), DateTimeOffset.UtcNow.AddDays(-8));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync(Ct)).Should().Contain("OCCURRED_AT_TOO_OLD");
    }

    [Fact]
    public async Task Log_WithoutNewFields_BehavesAsBefore()
    {
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        var meal = NewMeal();
        await InsertPlanAsync(client, meal);

        (await LogAsync(client, meal.MealId)).StatusCode.Should().Be(HttpStatusCode.Created);

        var log = (await LoadMealLogsAsync(client.UserId)).Should().ContainSingle().Subject;
        log.LogDate.Should().Be(Today);
        log.EatenAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromMinutes(1));
        log.BasedOnPlanVersion.Should().BeNull();
    }

    // ── UnlogMealEaten ──────────────────────────────────────────────────

    [Fact]
    public async Task Unlog_OccurredAtInFuture_Returns400()
    {
        var client = await TestActors.Client(factory).CreateAsync(Ct);

        var response = await client.Http.DeleteAsync(
            $"/client/nutrition/log/meals/{Guid.NewGuid()}/eaten{Query(DateTimeOffset.UtcNow.AddMinutes(30))}", Ct);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync(Ct)).Should().Contain("OCCURRED_AT_IN_FUTURE");
    }

    [Fact]
    public async Task Unlog_BackDatedOccurredAt_RemovesTheLogOfThatDay()
    {
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        var meal = NewMeal();
        await InsertPlanAsync(client, meal);
        (await LogAsync(client, meal.MealId, NoonDaysAgo(2))).StatusCode.Should().Be(HttpStatusCode.Created);

        var response = await client.Http.DeleteAsync(
            $"/client/nutrition/log/meals/{meal.MealId}/eaten{Query(NoonDaysAgo(2), Guid.NewGuid())}", Ct);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await LoadMealLogsAsync(client.UserId)).Should().BeEmpty();
    }

    // ── AddOffPlanFood / RemoveOffPlanFood ──────────────────────────────

    [Fact]
    public async Task AddOffPlan_ClientEntryId_IsUsed_AndRemovableByThatId()
    {
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        await InsertPlanAsync(client, NewMeal());
        var food = await ClientNutritionFixtures.InsertFoodAsync(factory);
        var entryId = Guid.NewGuid();

        var added = await ReadEntryAsync(await AddOffPlanAsync(client, food.ExternalId, entryId: entryId));

        added.EntryId.Should().Be(entryId);
        (await LoadDayLogsAsync(client.UserId)).Single().OffPlanFoods.Single().BasedOnPlanVersion.Should().Be(4);

        (await RemoveOffPlanAsync(client, entryId)).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await LoadDayLogsAsync(client.UserId)).Single().OffPlanFoods.Should().BeEmpty();
    }

    [Fact]
    public async Task AddOffPlan_ReplayedClientRequestId_ReturnsTheSameEntry_WithoutASecondOne()
    {
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        await InsertPlanAsync(client, NewMeal());
        var food = await ClientNutritionFixtures.InsertFoodAsync(factory);
        var requestId = Guid.NewGuid();

        var first = await AddOffPlanAsync(client, food.ExternalId, clientRequestId: requestId);
        var second = await AddOffPlanAsync(client, food.ExternalId, clientRequestId: requestId);

        first.StatusCode.Should().Be(HttpStatusCode.OK);
        second.StatusCode.Should().Be(HttpStatusCode.OK);
        (await ReadEntryAsync(second)).EntryId.Should().Be((await ReadEntryAsync(first)).EntryId);
        (await LoadDayLogsAsync(client.UserId)).Single().OffPlanFoods.Should().ContainSingle();
    }

    [Fact]
    public async Task AddOffPlan_EntryIdAlreadyInTheDayLog_IsAReplay()
    {
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        await InsertPlanAsync(client, NewMeal());
        var food = await ClientNutritionFixtures.InsertFoodAsync(factory);
        var entryId = Guid.NewGuid();

        (await AddOffPlanAsync(client, food.ExternalId, entryId: entryId)).StatusCode.Should().Be(HttpStatusCode.OK);
        var replay = await AddOffPlanAsync(client, food.ExternalId, entryId: entryId);

        replay.StatusCode.Should().Be(HttpStatusCode.OK);
        (await ReadEntryAsync(replay)).EntryId.Should().Be(entryId);
        (await LoadDayLogsAsync(client.UserId)).Single().OffPlanFoods.Should().ContainSingle();
    }

    [Fact]
    public async Task AddOffPlan_BackDated_FilesTheEntryUnderThatDay()
    {
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        await InsertPlanAsync(client, NewMeal());
        var food = await ClientNutritionFixtures.InsertFoodAsync(factory);

        (await AddOffPlanAsync(client, food.ExternalId, NoonDaysAgo(2))).StatusCode.Should().Be(HttpStatusCode.OK);

        var log = (await LoadDayLogsAsync(client.UserId)).Should().ContainSingle().Subject;
        log.LogDate.Should().Be(Today.AddDays(-2));
        log.OffPlanFoods.Single().LoggedAt.Should().BeCloseTo(NoonDaysAgo(2).UtcDateTime, TimeSpan.FromSeconds(1));
    }

    [Fact]
    public async Task AddOffPlan_OccurredAtTooOld_Returns400()
    {
        var client = await TestActors.Client(factory).CreateAsync(Ct);

        var response = await AddOffPlanAsync(client, Guid.NewGuid(), DateTimeOffset.UtcNow.AddDays(-8));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task AddOffPlan_EmptyEntryId_Returns400()
    {
        var client = await TestActors.Client(factory).CreateAsync(Ct);

        var response = await AddOffPlanAsync(client, Guid.NewGuid(), entryId: Guid.Empty);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task AddOffPlan_FirstAttemptWithoutPlan_IsNotRecorded_SoRetryApplies()
    {
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        var food = await ClientNutritionFixtures.InsertFoodAsync(factory);
        var requestId = Guid.NewGuid();

        (await AddOffPlanAsync(client, food.ExternalId, clientRequestId: requestId)).StatusCode.Should().Be(HttpStatusCode.NotFound);

        await InsertPlanAsync(client, NewMeal());
        (await AddOffPlanAsync(client, food.ExternalId, clientRequestId: requestId)).StatusCode.Should().Be(HttpStatusCode.OK);

        (await LoadDayLogsAsync(client.UserId)).Single().OffPlanFoods.Should().ContainSingle();
    }

    [Fact]
    public async Task Remove_ReplayedClientRequestId_Returns204_InsteadOfNotFound()
    {
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        await InsertPlanAsync(client, NewMeal());
        var food = await ClientNutritionFixtures.InsertFoodAsync(factory);
        var entryId = (await ReadEntryAsync(await AddOffPlanAsync(client, food.ExternalId))).EntryId;
        var requestId = Guid.NewGuid();

        (await RemoveOffPlanAsync(client, entryId, clientRequestId: requestId)).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await RemoveOffPlanAsync(client, entryId, clientRequestId: requestId)).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await RemoveOffPlanAsync(client, entryId)).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Remove_BackDatedOccurredAt_FindsTheEntryOfThatDay()
    {
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        await InsertPlanAsync(client, NewMeal());
        var food = await ClientNutritionFixtures.InsertFoodAsync(factory);
        var entryId = (await ReadEntryAsync(await AddOffPlanAsync(client, food.ExternalId, NoonDaysAgo(2)))).EntryId;

        (await RemoveOffPlanAsync(client, entryId)).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await RemoveOffPlanAsync(client, entryId, NoonDaysAgo(2))).StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task Remove_OccurredAtInFuture_Returns400()
    {
        var client = await TestActors.Client(factory).CreateAsync(Ct);

        var response = await RemoveOffPlanAsync(client, Guid.NewGuid(), DateTimeOffset.UtcNow.AddMinutes(30));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ── SetShoppingListItemTicked ───────────────────────────────────────

    [Fact]
    public async Task Tick_BackDatedOccurredAt_ResolvesThePlanOfThatDay()
    {
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        var oldFood = PlanTestHelpers.CreateMealFood(foodName: "Old plan food");
        var currentFood = PlanTestHelpers.CreateMealFood(foodName: "Current plan food");
        var oldPlan = await ClientNutritionFixtures.InsertPlanAsync(factory, client.UserId, NutritionPlanStatus.Active,
            Today.AddDays(-12), null, null,
            ClientNutritionFixtures.Week(1, WeekStatus.Published, ClientNutritionFixtures.MealWithFoods(MealKind.Lunch, oldFood)));
        await ClientNutritionFixtures.InsertPlanAsync(factory, client.UserId, NutritionPlanStatus.Active,
            Today.AddDays(-5), null, null,
            ClientNutritionFixtures.Week(1, WeekStatus.Published, ClientNutritionFixtures.MealWithFoods(MealKind.Lunch, currentFood)));

        (await TickAsync(client, oldFood.FoodExternalId)).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await TickAsync(client, oldFood.FoodExternalId, NoonDaysAgo(6))).StatusCode.Should().Be(HttpStatusCode.NoContent);

        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        var tick = (await mongo.ShoppingListTicks.Find(t => t.ClientId == client.UserId).ToListAsync(Ct)).Should().ContainSingle().Subject;
        tick.PlanId.Should().Be(oldPlan.ExternalId);
    }

    [Fact]
    public async Task Tick_OccurredAtTooOld_Returns400()
    {
        var client = await TestActors.Client(factory).CreateAsync(Ct);

        var response = await TickAsync(client, Guid.NewGuid(), DateTimeOffset.UtcNow.AddDays(-8));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ── AddMeasurement ──────────────────────────────────────────────────

    [Fact]
    public async Task AddMeasurement_ReplayedClientRequestId_ReturnsTheOriginalMeasurement_WithOneRow()
    {
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        var request = new AddMeasurementRequest
        {
            MeasuredAt = DateTime.UtcNow.AddDays(-1),
            WeightKg = 81.2m,
            ClientRequestId = Guid.NewGuid(),
            BasedOnPlanVersion = 3,
        };

        var first = await client.Http.PostAsJsonAsync("/client/measurements", request, Ct);
        var second = await client.Http.PostAsJsonAsync("/client/measurements", request, Ct);

        first.StatusCode.Should().Be(HttpStatusCode.Created);
        second.StatusCode.Should().Be(HttpStatusCode.Created);
        var original = (await first.Content.ReadFromJsonAsync<MeasurementDto>(Json, Ct))!;
        var replayed = (await second.Content.ReadFromJsonAsync<MeasurementDto>(Json, Ct))!;
        replayed.MeasurementId.Should().Be(original.MeasurementId);
        replayed.WeightKg.Should().Be(81.2m);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
        (await db.BodyMeasurements.CountAsync(m => m.ClientProfileId == client.ProfileId, Ct)).Should().Be(1);
    }

    [Fact]
    public async Task AddMeasurement_OccurredAtTooOld_Returns400()
    {
        var client = await TestActors.Client(factory).CreateAsync(Ct);

        var response = await client.Http.PostAsJsonAsync("/client/measurements",
            new AddMeasurementRequest
            {
                MeasuredAt = DateTime.UtcNow,
                WeightKg = 80,
                OccurredAt = DateTimeOffset.UtcNow.AddDays(-8),
            }, Ct);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
