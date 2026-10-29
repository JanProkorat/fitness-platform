using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Trainers.GetClientOfflineSyncConflicts;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using FluentValidation.TestHelper;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.Trainers;

/// <summary>
/// Tests for <c>GET /trainer/clients/{ClientId}/offline-sync-conflicts</c>.
/// </summary>
[Collection(TestCollection.Name)]
public class GetClientOfflineSyncConflictsEndpointTests(FitnessApiFactory factory)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private async Task InsertConflictAsync(Guid clientUserId, Guid planAuthorId, Guid planId, DateTime createdAt)
    {
        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        await mongo.OfflineSyncConflicts.InsertOneAsync(new OfflineSyncConflict
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientUserId,
            PlanId = planId,
            PlanAuthorId = planAuthorId,
            Operation = "LogMealEaten",
            Kind = OfflineSyncConflictKind.PlanChanged,
            MealId = Guid.NewGuid(),
            OccurredAt = createdAt,
            LogDate = createdAt.Date,
            BasedOnPlanVersion = 1,
            CurrentPlanVersion = 2,
            PlanName = "Plan",
            MealKind = MealKind.Lunch,
            MealLogged = true,
            DateCreated = createdAt,
        }, cancellationToken: Ct);
    }

    private static Task<HttpResponseMessage> GetAsync(Actor coach, Guid clientPublicId, string query = "") =>
        coach.Http.GetAsync($"/trainer/clients/{clientPublicId}/offline-sync-conflicts{query}", Ct);

    [Fact]
    public async Task Get_LinkedNutritionist_ReturnsOwnClientsConflictsNewestFirstWithTotalCount()
    {
        var coach = await TestActors.Nutritionist(factory).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        var otherClient = await TestActors.Client(factory).CreateAsync(Ct);
        await TestActors.Link(factory, coach, client).AsRole(UserRole.Nutritionist).CreateAsync(Ct);
        var planId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        await InsertConflictAsync(client.UserId, coach.UserId, planId, now.AddHours(-3));
        await InsertConflictAsync(client.UserId, coach.UserId, planId, now.AddHours(-1));
        await InsertConflictAsync(client.UserId, coach.UserId, planId, now.AddHours(-2));
        await InsertConflictAsync(otherClient.UserId, coach.UserId, planId, now);
        await InsertConflictAsync(client.UserId, Guid.NewGuid(), planId, now);

        var response = await GetAsync(coach, client.PublicId, "?page=1&pageSize=2");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Headers.GetValues("X-Total-Count").Single().Should().Be("3");
        var body = (await response.Content.ReadFromJsonAsync<GetClientOfflineSyncConflictsResponse>(Json, Ct))!;
        body.Items.Should().HaveCount(2);
        body.Items.Select(i => i.DetectedAt).Should().BeInDescendingOrder();
        body.Items[0].DetectedAt.Should().BeCloseTo(now.AddHours(-1), TimeSpan.FromSeconds(1));
        body.Items.Should().OnlyContain(i => i.PlanId == planId && i.Kind == OfflineSyncConflictKind.PlanChanged);
    }

    [Fact]
    public async Task Get_SecondPage_ReturnsTheRemainder()
    {
        var coach = await TestActors.Nutritionist(factory).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        await TestActors.Link(factory, coach, client).AsRole(UserRole.Nutritionist).CreateAsync(Ct);
        var planId = Guid.NewGuid();
        for (var i = 0; i < 3; i++)
        {
            await InsertConflictAsync(client.UserId, coach.UserId, planId, DateTime.UtcNow.AddMinutes(-i));
        }

        var response = await GetAsync(coach, client.PublicId, "?page=2&pageSize=2");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await response.Content.ReadFromJsonAsync<GetClientOfflineSyncConflictsResponse>(Json, Ct))!
            .Items.Should().HaveCount(1);
    }

    [Fact]
    public async Task Get_NotLinked_Returns404()
    {
        var coach = await TestActors.Nutritionist(factory).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);

        (await GetAsync(coach, client.PublicId)).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await GetAsync(coach, Guid.NewGuid())).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Get_InactiveLink_Returns404()
    {
        var coach = await TestActors.Nutritionist(factory).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        await TestActors.Link(factory, coach, client).AsRole(UserRole.Nutritionist).Inactive().CreateAsync(Ct);

        (await GetAsync(coach, client.PublicId)).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Get_TrainerOnlyLink_Returns403()
    {
        var trainer = await TestActors.Trainer(factory).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        await TestActors.Link(factory, trainer, client).CreateAsync(Ct);

        (await GetAsync(trainer, client.PublicId)).StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Get_LinkWithoutNutritionFlag_Returns403()
    {
        var coach = await TestActors.Nutritionist(factory).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        await TestActors.Link(factory, coach, client).AsRole(UserRole.Nutritionist).CanViewNutritionPlans(false).CreateAsync(Ct);

        (await GetAsync(coach, client.PublicId)).StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Get_PageSizeZero_Returns400()
    {
        var coach = await TestActors.Nutritionist(factory).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        await TestActors.Link(factory, coach, client).AsRole(UserRole.Nutritionist).CreateAsync(Ct);

        (await GetAsync(coach, client.PublicId, "?pageSize=0")).StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Theory]
    [InlineData(0, 20, ErrorCodes.OutOfRange)]
    [InlineData(1, 0, ErrorCodes.OutOfRange)]
    [InlineData(1, 101, ErrorCodes.OutOfRange)]
    public void Validate_PagingOutOfRange_FailsWithOutOfRange(int page, int pageSize, string errorCode)
    {
        var result = new GetClientOfflineSyncConflictsValidator().TestValidate(
            new GetClientOfflineSyncConflictsRequest { ClientId = Guid.NewGuid(), Page = page, PageSize = pageSize });

        result.Errors.Should().ContainSingle().Which.ErrorCode.Should().Be(errorCode);
    }

    [Theory]
    [InlineData(1, 1)]
    [InlineData(5, 100)]
    public void Validate_PagingInRange_Passes(int page, int pageSize)
    {
        var result = new GetClientOfflineSyncConflictsValidator().TestValidate(
            new GetClientOfflineSyncConflictsRequest { ClientId = Guid.NewGuid(), Page = page, PageSize = pageSize });

        result.IsValid.Should().BeTrue();
    }
}
