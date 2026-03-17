using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Features.ClientMeasurements.AddMeasurement;
using FitnessPlatform.Tests.Builders;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.ClientMeasurements;

/// <summary>
/// Tests for <see cref="AddMeasurementEndpoint"/>.
/// </summary>
public class AddMeasurementEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_ValidRequest_CreatesMeasurement()
    {
        var clientProfile = EntityBuilder.ClientProfile
            .WithUserId(_clientId)
            .WithId(10)
            .Build();

        var db = new MockDbBuilder()
            .With(clientProfile)
            .Build();

        var ep = Factory.Create<AddMeasurementEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            db);

        var request = new AddMeasurementRequest
        {
            MeasuredAt = DateTime.UtcNow,
            WeightKg = 82.5m,
            BodyFatPercentage = 18.5m,
            WaistCm = 85,
            Notes = "Morning measurement"
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);
        db.BodyMeasurements.Received(1).Add(Arg.Is<BodyMeasurement>(m =>
            m.ClientProfileId == 10 &&
            m.WeightKg == 82.5m &&
            m.Notes == "Morning measurement"));
    }

    [Fact]
    public async Task HandleAsync_NoClientProfile_Returns404()
    {
        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<AddMeasurementEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            db);

        await ep.HandleAsync(
            new AddMeasurementRequest { MeasuredAt = DateTime.UtcNow, WeightKg = 80 },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<AddMeasurementEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity()),
            db);

        await ep.HandleAsync(
            new AddMeasurementRequest { MeasuredAt = DateTime.UtcNow },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }
}
