using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FluentAssertions;
using FluentValidation.TestHelper;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Trainers.ReviewAllClientOfflineSyncConflicts;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;

namespace FitnessPlatform.Tests.Endpoints.Trainers;

/// <summary>
/// Tests for the review endpoints under <c>/trainer/clients/{ClientId}/offline-sync-conflicts</c>.
/// </summary>
[Collection(TestCollection.Name)]
public class ReviewClientOfflineSyncConflictsEndpointTests(FitnessApiFactory factory)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private async Task<Guid> InsertConflictAsync(Guid clientUserId, Guid planAuthorId, Guid planId)
    {
        var conflictId = Guid.NewGuid();
        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        await mongo.OfflineSyncConflicts.InsertOneAsync(new OfflineSyncConflict
        {
            ExternalId = conflictId,
            ClientId = clientUserId,
            PlanId = planId,
            PlanAuthorId = planAuthorId,
            Operation = "LogMealEaten",
            Kind = OfflineSyncConflictKind.PlanChanged,
            MealId = Guid.NewGuid(),
            OccurredAt = DateTime.UtcNow,
            LogDate = DateTime.UtcNow.Date,
            BasedOnPlanVersion = 1,
            CurrentPlanVersion = 2,
            PlanName = "Plan",
            MealKind = MealKind.Lunch,
            MealLogged = true,
        }, cancellationToken: Ct);
        return conflictId;
    }

    private async Task<OfflineSyncConflict> LoadAsync(Guid conflictId)
    {
        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        return await mongo.OfflineSyncConflicts.Find(c => c.ExternalId == conflictId).FirstAsync(Ct);
    }

    private async Task<(Actor Coach, Actor Client)> SeedLinkedPairAsync()
    {
        var coach = await TestActors.Nutritionist(factory).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        await TestActors.Link(factory, coach, client).AsRole(UserRole.Nutritionist).CreateAsync(Ct);
        return (coach, client);
    }

    private static Task<HttpResponseMessage> ReviewAsync(Actor coach, Guid clientPublicId, Guid conflictId) =>
        coach.Http.PostAsJsonAsync(
            $"/trainer/clients/{clientPublicId}/offline-sync-conflicts/{conflictId}/review", new { }, Ct);

    private static Task<HttpResponseMessage> ReviewAllAsync(Actor coach, Guid clientPublicId, Guid planId) =>
        coach.Http.PostAsJsonAsync(
            $"/trainer/clients/{clientPublicId}/offline-sync-conflicts/review-all", new { planId }, Ct);

    [Fact]
    public async Task Review_ByAuthor_Returns204AndMarksReviewed()
    {
        var (coach, client) = await SeedLinkedPairAsync();
        var conflictId = await InsertConflictAsync(client.UserId, coach.UserId, Guid.NewGuid());

        var response = await ReviewAsync(coach, client.PublicId, conflictId);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        var stored = await LoadAsync(conflictId);
        stored.ReviewedAt.Should().NotBeNull();
        stored.ReviewedByUserId.Should().Be(coach.UserId);
        stored.Version.Should().Be(2);
    }

    [Fact]
    public async Task Review_Repeated_Returns204AndKeepsFirstReview()
    {
        var (coach, client) = await SeedLinkedPairAsync();
        var conflictId = await InsertConflictAsync(client.UserId, coach.UserId, Guid.NewGuid());
        await ReviewAsync(coach, client.PublicId, conflictId);
        var first = await LoadAsync(conflictId);

        var response = await ReviewAsync(coach, client.PublicId, conflictId);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        var second = await LoadAsync(conflictId);
        second.ReviewedAt.Should().Be(first.ReviewedAt);
        second.ReviewedByUserId.Should().Be(first.ReviewedByUserId);
        second.Version.Should().Be(first.Version);
    }

    [Fact]
    public async Task Review_LinkedCoachWhoDidNotAuthorThePlan_Returns404AndLeavesItUnreviewed()
    {
        var (coach, client) = await SeedLinkedPairAsync();
        var conflictId = await InsertConflictAsync(client.UserId, Guid.NewGuid(), Guid.NewGuid());

        (await ReviewAsync(coach, client.PublicId, conflictId)).StatusCode.Should().Be(HttpStatusCode.NotFound);

        (await LoadAsync(conflictId)).ReviewedAt.Should().BeNull();
    }

    [Fact]
    public async Task Review_ConflictOfAnotherClientEvenIfAuthored_Returns404()
    {
        var (coach, client) = await SeedLinkedPairAsync();
        var otherClient = await TestActors.Client(factory).CreateAsync(Ct);
        await TestActors.Link(factory, coach, otherClient).AsRole(UserRole.Nutritionist).CreateAsync(Ct);
        var otherConflictId = await InsertConflictAsync(otherClient.UserId, coach.UserId, Guid.NewGuid());

        (await ReviewAsync(coach, client.PublicId, otherConflictId)).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await ReviewAsync(coach, client.PublicId, Guid.NewGuid())).StatusCode.Should().Be(HttpStatusCode.NotFound);

        (await LoadAsync(otherConflictId)).ReviewedAt.Should().BeNull();
    }

    [Fact]
    public async Task Review_NotLinked_Returns404()
    {
        var coach = await TestActors.Nutritionist(factory).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        var conflictId = await InsertConflictAsync(client.UserId, coach.UserId, Guid.NewGuid());

        (await ReviewAsync(coach, client.PublicId, conflictId)).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Review_LinkWithoutNutritionFlag_Returns403()
    {
        var coach = await TestActors.Nutritionist(factory).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        await TestActors.Link(factory, coach, client).AsRole(UserRole.Nutritionist).CanViewNutritionPlans(false).CreateAsync(Ct);
        var conflictId = await InsertConflictAsync(client.UserId, coach.UserId, Guid.NewGuid());

        (await ReviewAsync(coach, client.PublicId, conflictId)).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await ReviewAllAsync(coach, client.PublicId, Guid.NewGuid())).StatusCode.Should().Be(HttpStatusCode.Forbidden);

        (await LoadAsync(conflictId)).ReviewedAt.Should().BeNull();
    }

    [Fact]
    public async Task ReviewAll_ReviewsOnlyTheCallersUnreviewedConflictsOfThePlan()
    {
        var (coach, client) = await SeedLinkedPairAsync();
        var planId = Guid.NewGuid();
        var otherPlanId = Guid.NewGuid();
        var first = await InsertConflictAsync(client.UserId, coach.UserId, planId);
        var second = await InsertConflictAsync(client.UserId, coach.UserId, planId);
        var otherPlan = await InsertConflictAsync(client.UserId, coach.UserId, otherPlanId);
        var foreignAuthor = await InsertConflictAsync(client.UserId, Guid.NewGuid(), planId);
        await ReviewAsync(coach, client.PublicId, second);

        var response = await ReviewAllAsync(coach, client.PublicId, planId);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await response.Content.ReadFromJsonAsync<ReviewAllClientOfflineSyncConflictsResponse>(Json, Ct))!
            .ReviewedCount.Should().Be(1);
        (await LoadAsync(first)).ReviewedAt.Should().NotBeNull();
        (await LoadAsync(otherPlan)).ReviewedAt.Should().BeNull();
        (await LoadAsync(foreignAuthor)).ReviewedAt.Should().BeNull();

        var again = await ReviewAllAsync(coach, client.PublicId, planId);
        (await again.Content.ReadFromJsonAsync<ReviewAllClientOfflineSyncConflictsResponse>(Json, Ct))!
            .ReviewedCount.Should().Be(0);
    }

    [Fact]
    public async Task ReviewAll_EmptyPlanId_Returns400()
    {
        var (coach, client) = await SeedLinkedPairAsync();

        (await ReviewAllAsync(coach, client.PublicId, Guid.Empty)).StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public void ValidateReviewAll_EmptyPlanId_Fails()
    {
        var result = new ReviewAllClientOfflineSyncConflictsValidator().TestValidate(
            new ReviewAllClientOfflineSyncConflictsRequest { ClientId = Guid.NewGuid(), PlanId = Guid.Empty });

        result.ShouldHaveValidationErrorFor(x => x.PlanId);
    }
}
