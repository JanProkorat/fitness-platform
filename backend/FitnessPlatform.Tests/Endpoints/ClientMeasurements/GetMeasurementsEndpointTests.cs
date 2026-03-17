using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Features.ClientMeasurements.GetMeasurements;
using FitnessPlatform.Tests.Builders;

namespace FitnessPlatform.Tests.Endpoints.ClientMeasurements;

/// <summary>
/// Tests for <see cref="GetMeasurementsEndpoint"/>.
/// </summary>
public class GetMeasurementsEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_WithMeasurements_ReturnsPaginated()
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
            MeasuredAt = DateTime.UtcNow.AddDays(-1),
            WeightKg = 80
        };
        var m2 = new BodyMeasurement
        {
            Id = 2,
            PublicId = Guid.NewGuid(),
            ClientProfileId = 10,
            MeasuredAt = DateTime.UtcNow,
            WeightKg = 79.5m
        };

        var db = new MockDbBuilder()
            .With(clientProfile)
            .With(m1)
            .With(m2)
            .Build();

        var ep = Factory.Create<GetMeasurementsEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            db);

        await ep.HandleAsync(
            new GetMeasurementsRequest { Page = 1, PageSize = 10 },
            TestContext.Current.CancellationToken);

        ep.Response.Should().NotBeNull();
        ep.Response.TotalCount.Should().Be(2);
        ep.Response.Items.Should().HaveCount(2);
        ep.Response.Page.Should().Be(1);
    }

    [Fact]
    public async Task HandleAsync_NoClientProfile_Returns404()
    {
        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<GetMeasurementsEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            db);

        await ep.HandleAsync(
            new GetMeasurementsRequest { Page = 1, PageSize = 10 },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<GetMeasurementsEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity()),
            db);

        await ep.HandleAsync(
            new GetMeasurementsRequest { Page = 1, PageSize = 10 },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }
}
