using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.ClientMeasurements.GetClientMeasurements;
using FitnessPlatform.Tests.Builders;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.ClientMeasurements;

/// <summary>
/// Tests for <see cref="GetClientMeasurementsEndpoint"/>.
/// </summary>
public class GetClientMeasurementsEndpointTests
{
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly Guid _clientPublicId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_ActiveLink_ReturnsMeasurements()
    {
        var trainerProfile = EntityBuilder.TrainerProfile
            .WithUserId(_trainerId)
            .WithId(1)
            .Build();

        var clientProfile = EntityBuilder.ClientProfile
            .WithPublicId(_clientPublicId)
            .WithId(2)
            .Build();

        var link = EntityBuilder.ClientTrainerLink
            .WithClientProfileId(2)
            .WithTrainerProfileId(1)
            .Build();

        var measurement = new BodyMeasurement
        {
            Id = 1,
            PublicId = Guid.NewGuid(),
            ClientProfileId = 2,
            MeasuredAt = DateTime.UtcNow,
            WeightKg = 75m
        };

        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(clientProfile)
            .With(link)
            .With(measurement)
            .Build();

        var audit = Substitute.For<IAuditService>();

        var ep = Factory.Create<GetClientMeasurementsEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            db, audit);

        await ep.HandleAsync(
            new GetClientMeasurementsRequest { ClientId = _clientPublicId, Page = 1, PageSize = 10 },
            TestContext.Current.CancellationToken);

        ep.Response.Should().NotBeNull();
        ep.Response.TotalCount.Should().Be(1);
        ep.Response.Items.Should().HaveCount(1);
        ep.Response.Items[0].WeightKg.Should().Be(75m);

        // Verify audit was logged
        await audit.Received(1).LogAsync(
            _trainerId,
            "Read",
            nameof(BodyMeasurement),
            _clientPublicId,
            Arg.Any<string?>(),
            Arg.Any<string?>(),
            Arg.Any<string?>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NoActiveLink_Returns404()
    {
        var trainerProfile = EntityBuilder.TrainerProfile
            .WithUserId(_trainerId)
            .WithId(1)
            .Build();

        var clientProfile = EntityBuilder.ClientProfile
            .WithPublicId(_clientPublicId)
            .WithId(2)
            .Build();

        // No link between trainer and client
        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(clientProfile)
            .Build();

        var audit = Substitute.For<IAuditService>();

        var ep = Factory.Create<GetClientMeasurementsEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            db, audit);

        await ep.HandleAsync(
            new GetClientMeasurementsRequest { ClientId = _clientPublicId, Page = 1, PageSize = 10 },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var db = new MockDbBuilder().Build();
        var audit = Substitute.For<IAuditService>();

        var ep = Factory.Create<GetClientMeasurementsEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity()),
            db, audit);

        await ep.HandleAsync(
            new GetClientMeasurementsRequest { ClientId = _clientPublicId, Page = 1, PageSize = 10 },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }
}
