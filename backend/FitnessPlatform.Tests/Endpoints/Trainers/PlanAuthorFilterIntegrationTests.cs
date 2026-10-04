using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Messaging.GetConversationFilterCounts;
using FitnessPlatform.Application.Features.Trainers.GetClientDashboard;
using FitnessPlatform.Application.Features.Trainers.GetClients;
using FitnessPlatform.Application.Features.Trainers.GetClientTimeline;
using FitnessPlatform.Application.Features.Trainers.GetDashboardSummary;
using FitnessPlatform.Application.Features.Trainers.ListClientPlans;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Bson;

namespace FitnessPlatform.Tests.Endpoints.Trainers;

/// <summary>
/// A professional's plan-derived figures must only come from plans that professional wrote, and
/// an ended link reads no plan data at all. Runs against real PostgreSQL + MongoDB because the
/// mock Mongo harness ignores filters.
/// </summary>
[Collection(TestCollection.Name)]
public class PlanAuthorFilterIntegrationTests(FitnessApiFactory factory)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    private async Task<(Actor Trainer, Actor Client)> LinkedPairAsync(bool active = true)
    {
        var trainer = await TestActors.Trainer(factory).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        var link = TestActors.Link(factory, trainer, client);

        if (!active)
        {
            link.Inactive();
        }

        await link.CreateAsync(Ct);
        return (trainer, client);
    }

    private async Task<Guid> SeedNutritionPlanAsync(Guid clientUserId, Guid authorUserId, decimal? targetWeightKg = null)
    {
        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        var externalId = Guid.NewGuid();

        await mongo.NutritionPlans.InsertOneAsync(new NutritionPlan
        {
            Id = ObjectId.GenerateNewId(),
            ExternalId = externalId,
            ClientId = clientUserId,
            NutritionistId = authorUserId,
            Name = "Author filter nutrition plan",
            Status = NutritionPlanStatus.Active,
            StartDate = DateTime.UtcNow.Date.AddDays(-1),
            TargetWeightKg = targetWeightKg,
            Weeks =
            [
                new PlanWeek { WeekNumber = 1, Status = WeekStatus.Published, DatePublished = DateTime.UtcNow.AddDays(-1) }
            ],
            Version = 1,
            DateCreated = DateTime.UtcNow,
        }, cancellationToken: Ct);

        return externalId;
    }

    private async Task<Guid> SeedTrainingPlanAsync(Guid clientUserId, Guid authorUserId)
    {
        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        var externalId = Guid.NewGuid();

        await mongo.TrainingPlans.InsertOneAsync(new TrainingPlan
        {
            Id = ObjectId.GenerateNewId(),
            ExternalId = externalId,
            ClientId = clientUserId,
            TrainerId = authorUserId,
            Name = "Author filter training plan",
            Status = TrainingPlanStatus.Active,
            StartDate = DateTime.UtcNow.Date.AddDays(-1),
            Weeks =
            [
                new TrainingWeek { WeekNumber = 1, Status = WeekStatus.Published, DatePublished = DateTime.UtcNow.AddDays(-1) }
            ],
            Version = 1,
            DateCreated = DateTime.UtcNow,
        }, cancellationToken: Ct);

        return externalId;
    }

    private async Task<ClientSummary> GetClientRowAsync(Actor trainer, Actor client, ClientListStatus status)
    {
        var response = await trainer.Http.GetAsync($"/trainer/clients?status={status}&pageSize=100", Ct);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<GetClientsResponse>(JsonOptions, Ct);
        return body!.Clients.Single(c => c.PublicId == client.PublicId);
    }

    [Fact]
    public async Task GetClients_ForeignAuthoredInWindowPlan_IsPausedWithNoPlanData()
    {
        var (trainer, client) = await LinkedPairAsync();
        await SeedNutritionPlanAsync(client.UserId, Guid.NewGuid());
        await SeedTrainingPlanAsync(client.UserId, Guid.NewGuid());

        var row = await GetClientRowAsync(trainer, client, ClientListStatus.Paused);

        row.Status.Should().Be(ClientListStatus.Paused);
        row.ActivePlans.Should().BeEmpty();
        row.HasActiveNutritionPlan.Should().BeFalse();
        row.HasActiveTrainingPlan.Should().BeFalse();

        var response = await trainer.Http.GetAsync("/trainer/clients?pageSize=100", Ct);
        var body = await response.Content.ReadFromJsonAsync<GetClientsResponse>(JsonOptions, Ct);
        body!.FilterCounts.EndingSoon.Should().Be(0);
    }

    [Fact]
    public async Task GetClients_OwnAuthoredInWindowPlan_IsActiveAndEndingSoon()
    {
        var (trainer, client) = await LinkedPairAsync();
        await SeedNutritionPlanAsync(client.UserId, trainer.UserId);

        var row = await GetClientRowAsync(trainer, client, ClientListStatus.Active);

        row.Status.Should().Be(ClientListStatus.Active);
        row.HasActiveNutritionPlan.Should().BeTrue();
        row.ActivePlans.Should().ContainSingle();

        var response = await trainer.Http.GetAsync("/trainer/clients?pageSize=100", Ct);
        var body = await response.Content.ReadFromJsonAsync<GetClientsResponse>(JsonOptions, Ct);
        body!.FilterCounts.EndingSoon.Should().Be(1);
    }

    [Fact]
    public async Task GetClients_EndedLinkWithOwnInWindowPlan_IsArchivedWithNoPlanData()
    {
        var (trainer, client) = await LinkedPairAsync(active: false);
        await SeedNutritionPlanAsync(client.UserId, trainer.UserId);
        await SeedTrainingPlanAsync(client.UserId, trainer.UserId);

        var row = await GetClientRowAsync(trainer, client, ClientListStatus.Archived);

        row.Status.Should().Be(ClientListStatus.Archived);
        row.ActivePlans.Should().BeEmpty();
        row.HasActiveNutritionPlan.Should().BeFalse();
        row.HasActiveTrainingPlan.Should().BeFalse();

        var response = await trainer.Http.GetAsync("/trainer/clients?status=Archived&pageSize=100", Ct);
        var body = await response.Content.ReadFromJsonAsync<GetClientsResponse>(JsonOptions, Ct);
        body!.FilterCounts.EndingSoon.Should().Be(0);
    }

    [Fact]
    public async Task ConversationFilterCounts_ForeignAuthoredEndingSoonPlan_DoesNotCount()
    {
        var (trainer, client) = await LinkedPairAsync();
        await SeedNutritionPlanAsync(client.UserId, Guid.NewGuid());

        var response = await trainer.Http.GetAsync("/conversations/filter-counts", Ct);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<GetConversationFilterCountsResponse>(JsonOptions, Ct);

        body!.All.Should().Be(1);
        body.EndingSoon.Should().Be(0);
    }

    [Fact]
    public async Task ConversationFilterCounts_OwnAuthoredEndingSoonPlan_Counts()
    {
        var (trainer, client) = await LinkedPairAsync();
        await SeedNutritionPlanAsync(client.UserId, trainer.UserId);

        var response = await trainer.Http.GetAsync("/conversations/filter-counts", Ct);
        var body = await response.Content.ReadFromJsonAsync<GetConversationFilterCountsResponse>(JsonOptions, Ct);

        body!.EndingSoon.Should().Be(1);
    }

    [Fact]
    public async Task GetClientDashboard_ForeignAuthoredPlan_StatusIsPaused()
    {
        var (trainer, client) = await LinkedPairAsync();
        await SeedNutritionPlanAsync(client.UserId, Guid.NewGuid(), targetWeightKg: 99m);

        var response = await trainer.Http.GetAsync($"/trainer/clients/{client.PublicId}", Ct);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<GetClientDashboardResponse>(JsonOptions, Ct);

        body!.Status.Should().Be(ClientListStatus.Paused);
    }

    [Fact]
    public async Task GetClientDashboard_OwnAuthoredPlan_StatusIsActive()
    {
        var (trainer, client) = await LinkedPairAsync();
        await SeedNutritionPlanAsync(client.UserId, trainer.UserId);

        var response = await trainer.Http.GetAsync($"/trainer/clients/{client.PublicId}", Ct);
        var body = await response.Content.ReadFromJsonAsync<GetClientDashboardResponse>(JsonOptions, Ct);

        body!.Status.Should().Be(ClientListStatus.Active);
    }

    [Fact]
    public async Task GetDashboardSummary_ForeignAuthoredPlans_ReportNoPlans()
    {
        var (trainer, client) = await LinkedPairAsync();
        await SeedNutritionPlanAsync(client.UserId, Guid.NewGuid());
        await SeedTrainingPlanAsync(client.UserId, Guid.NewGuid());

        var response = await trainer.Http.GetAsync("/trainer/dashboard-summary", Ct);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<GetDashboardSummaryResponse>(JsonOptions, Ct);
        var item = body!.Clients.Single(c => c.PublicId == client.PublicId);

        item.ActiveNutritionPlansCount.Should().Be(0);
        item.HasActiveTrainingPlan.Should().BeFalse();
    }

    [Fact]
    public async Task GetDashboardSummary_OwnAuthoredPlans_ReportPlans()
    {
        var (trainer, client) = await LinkedPairAsync();
        await SeedNutritionPlanAsync(client.UserId, trainer.UserId);
        await SeedTrainingPlanAsync(client.UserId, trainer.UserId);

        var response = await trainer.Http.GetAsync("/trainer/dashboard-summary", Ct);
        var body = await response.Content.ReadFromJsonAsync<GetDashboardSummaryResponse>(JsonOptions, Ct);
        var item = body!.Clients.Single(c => c.PublicId == client.PublicId);

        item.ActiveNutritionPlansCount.Should().Be(1);
        item.HasActiveTrainingPlan.Should().BeTrue();
    }

    [Fact]
    public async Task GetClientTimeline_PublishEvents_OnlyForCallersOwnPlans()
    {
        var (trainer, client) = await LinkedPairAsync();
        var foreignNutrition = await SeedNutritionPlanAsync(client.UserId, Guid.NewGuid());
        var foreignTraining = await SeedTrainingPlanAsync(client.UserId, Guid.NewGuid());
        var ownNutrition = await SeedNutritionPlanAsync(client.UserId, trainer.UserId);

        var response = await trainer.Http.GetAsync($"/trainer/clients/{client.PublicId}/timeline", Ct);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<GetClientTimelineResponse>(JsonOptions, Ct);
        var ids = body!.Items.Select(i => i.Id).ToList();

        ids.Should().Contain($"nutrition_plan:{ownNutrition}");
        ids.Should().NotContain($"nutrition_plan:{foreignNutrition}");
        ids.Should().NotContain($"training_plan:{foreignTraining}");
    }

    [Fact]
    public async Task ListClientPlans_ReturnsOnlyCallersOwnPlans()
    {
        var (trainer, client) = await LinkedPairAsync();
        var foreignNutrition = await SeedNutritionPlanAsync(client.UserId, Guid.NewGuid());
        var foreignTraining = await SeedTrainingPlanAsync(client.UserId, Guid.NewGuid());
        var ownNutrition = await SeedNutritionPlanAsync(client.UserId, trainer.UserId);
        var ownTraining = await SeedTrainingPlanAsync(client.UserId, trainer.UserId);

        var response = await trainer.Http.GetAsync($"/trainer/clients/{client.PublicId}/plans", Ct);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<ListClientPlansResponse>(JsonOptions, Ct);
        var planIds = body!.Plans.Select(p => p.PlanId).ToList();

        planIds.Should().BeEquivalentTo([ownNutrition, ownTraining]);
        planIds.Should().NotContain([foreignNutrition, foreignTraining]);
    }
}
