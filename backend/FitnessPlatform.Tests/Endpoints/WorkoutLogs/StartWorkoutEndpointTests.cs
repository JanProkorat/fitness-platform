using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Features.WorkoutLogs.StartWorkout;
using FitnessPlatform.Tests.Endpoints;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.WorkoutLogs;

/// <summary>
/// Tests for <see cref="StartWorkoutEndpoint"/>.
/// </summary>
public class StartWorkoutEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_ValidRequest_CreatesLog()
    {
        var mongo = WorkoutLogTestHelpers.CreateMockMongo();
        var ep = Factory.Create<StartWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo);

        await ep.HandleAsync(new StartWorkoutRequest(), TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await mongo.WorkoutLogs.Received(1).InsertOneAsync(
            Arg.Is<WorkoutLog>(w =>
                w.ClientId == _clientId &&
                !w.IsCompleted),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var mongo = WorkoutLogTestHelpers.CreateMockMongo();
        var ep = Factory.Create<StartWorkoutEndpoint>(mongo);

        await ep.HandleAsync(new StartWorkoutRequest(), TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }
}
