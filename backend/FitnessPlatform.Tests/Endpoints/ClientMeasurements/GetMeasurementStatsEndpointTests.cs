using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Features.ClientMeasurements.GetMeasurementStats;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.NutritionPlans;

namespace FitnessPlatform.Tests.Endpoints.ClientMeasurements;

/// <summary>
/// Tests for <see cref="GetMeasurementStatsEndpoint"/>.
/// </summary>
public class GetMeasurementStatsEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();

    // Helper: returns a mock IMongoContext with empty NutritionPlans collection
    // (no active plan) — ensures the plan-first read path falls back gracefully
    // without affecting the assertion being tested.
    private static IMongoContext CreateEmptyMongo() =>
        PlanTestHelpers.CreateMockMongo();

    [Fact]
    public async Task HandleAsync_WithWeightData_ReturnsStats()
    {
        var clientProfile = EntityBuilder.ClientProfile
            .WithUserId(_clientId)
            .WithId(10)
            .Build();

        var m1 = new BodyMeasurement
        {
            Id = 1,
            PublicId = Guid.NewGuid(),
            ClientProfileId = 10,
            MeasuredAt = DateTime.UtcNow.AddDays(-45),
            WeightKg = 85m
        };
        var m2 = new BodyMeasurement
        {
            Id = 2,
            PublicId = Guid.NewGuid(),
            ClientProfileId = 10,
            MeasuredAt = DateTime.UtcNow.AddDays(-10),
            WeightKg = 82m
        };
        var m3 = new BodyMeasurement
        {
            Id = 3,
            PublicId = Guid.NewGuid(),
            ClientProfileId = 10,
            MeasuredAt = DateTime.UtcNow,
            WeightKg = 80m
        };

        var db = new MockDbBuilder()
            .With(clientProfile)
            .With(m1)
            .With(m2)
            .With(m3)
            .Build();

        var ep = Factory.Create<GetMeasurementStatsEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            db, CreateEmptyMongo());

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.Response.Should().NotBeNull();
        ep.Response.MinWeight.Should().Be(80m);
        ep.Response.MaxWeight.Should().Be(85m);
        ep.Response.AvgWeight.Should().Be(82.33m);
        ep.Response.LatestWeight.Should().Be(80m);
        ep.Response.TotalCount.Should().Be(3);
        // 30 days ago from latest (now) => m1 at -45 days qualifies (<= -30)
        // weight change = 80 - 85 = -5
        ep.Response.WeightChange30Days.Should().Be(-5m);
    }

    [Fact]
    public async Task HandleAsync_NoWeightData_ReturnsEmptyStats()
    {
        var clientProfile = EntityBuilder.ClientProfile
            .WithUserId(_clientId)
            .WithId(10)
            .Build();

        // Measurement without weight
        var m1 = new BodyMeasurement
        {
            Id = 1,
            PublicId = Guid.NewGuid(),
            ClientProfileId = 10,
            MeasuredAt = DateTime.UtcNow,
            WeightKg = null,
            WaistCm = 85
        };

        var db = new MockDbBuilder()
            .With(clientProfile)
            .With(m1)
            .Build();

        var ep = Factory.Create<GetMeasurementStatsEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            db, CreateEmptyMongo());

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.Response.Should().NotBeNull();
        ep.Response.MinWeight.Should().BeNull();
        ep.Response.MaxWeight.Should().BeNull();
        ep.Response.AvgWeight.Should().BeNull();
        ep.Response.LatestWeight.Should().BeNull();
        ep.Response.TotalCount.Should().Be(1);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<GetMeasurementStatsEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity()),
            db, CreateEmptyMongo());

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }
}
