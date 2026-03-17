using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Features.ClientMeasurements.GetLatestMeasurement;
using FitnessPlatform.Tests.Builders;

namespace FitnessPlatform.Tests.Endpoints.ClientMeasurements;

/// <summary>
/// Tests for <see cref="GetLatestMeasurementEndpoint"/>.
/// </summary>
public class GetLatestMeasurementEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_HasMeasurements_ReturnsLatest()
    {
        var clientProfile = EntityBuilder.ClientProfile
            .WithUserId(_clientId)
            .WithId(10)
            .Build();

        var older = new BodyMeasurement
        {
            Id = 1,
            PublicId = Guid.NewGuid(),
            ClientProfileId = 10,
            MeasuredAt = DateTime.UtcNow.AddDays(-7),
            WeightKg = 82
        };
        var latest = new BodyMeasurement
        {
            Id = 2,
            PublicId = Guid.NewGuid(),
            ClientProfileId = 10,
            MeasuredAt = DateTime.UtcNow,
            WeightKg = 80.5m
        };

        var db = new MockDbBuilder()
            .With(clientProfile)
            .With(older)
            .With(latest)
            .Build();

        var ep = Factory.Create<GetLatestMeasurementEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.Response.Should().NotBeNull();
        ep.Response.WeightKg.Should().Be(80.5m);
        ep.Response.MeasurementId.Should().Be(latest.PublicId);
    }

    [Fact]
    public async Task HandleAsync_NoMeasurements_Returns404()
    {
        var clientProfile = EntityBuilder.ClientProfile
            .WithUserId(_clientId)
            .WithId(10)
            .Build();

        var db = new MockDbBuilder()
            .With(clientProfile)
            .Build();

        var ep = Factory.Create<GetLatestMeasurementEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<GetLatestMeasurementEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity()),
            db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }
}
