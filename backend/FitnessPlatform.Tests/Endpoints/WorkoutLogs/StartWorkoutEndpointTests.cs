using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.WorkoutLogs.StartWorkout;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Endpoints;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.WorkoutLogs;

/// <summary>
/// Tests for <see cref="StartWorkoutEndpoint"/>.
/// </summary>
public class StartWorkoutEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();
    private static readonly IOptions<TrainingLockOptions> LockOptions =
        Options.Create(new TrainingLockOptions { LiveTtlHours = 6 });

    private static ISessionLockService CreateNoOpLockService()
    {
        var svc = Substitute.For<ISessionLockService>();
        svc.AcquireAsync(
                Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(),
                Arg.Any<LockHolder>(), Arg.Any<LockType>(), Arg.Any<TimeSpan>(),
                Arg.Any<CancellationToken>())
            .Returns(new AcquireResult.Acquired(new SessionLock
            {
                SessionId = Guid.NewGuid(), PlanId = Guid.NewGuid(),
                ClientId = Guid.NewGuid(), TrainerId = Guid.NewGuid(),
                Holder = LockHolder.Client, Type = LockType.Live,
                AcquiredAt = DateTime.UtcNow, ExpiresAt = DateTime.UtcNow.AddHours(6)
            }));
        return svc;
    }

    [Fact]
    public async Task HandleAsync_ValidRequest_CreatesLog()
    {
        var mongo = WorkoutLogTestHelpers.CreateMockMongo();
        var ep = Factory.Create<StartWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, CreateNoOpLockService(), LockOptions);

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
        var ep = Factory.Create<StartWorkoutEndpoint>(
            mongo, CreateNoOpLockService(), LockOptions);

        await ep.HandleAsync(new StartWorkoutRequest(), TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }
}
