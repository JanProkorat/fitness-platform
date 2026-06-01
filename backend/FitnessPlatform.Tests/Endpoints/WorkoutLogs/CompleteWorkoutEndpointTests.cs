using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Common;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.WorkoutLogs.CompleteWorkout;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace FitnessPlatform.Tests.Endpoints.WorkoutLogs;

/// <summary>
/// Tests for <see cref="CompleteWorkoutEndpoint"/>.
/// The endpoint now delegates the completion pipeline to <see cref="IWorkoutCompletionService"/>;
/// these tests verify the HTTP contract and ownership check.
/// Behavioral tests (TrainingCompletion fan-out, PR detection) live in
/// <see cref="WorkoutCompletionServiceTests"/>.
/// </summary>
public class CompleteWorkoutEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();

    private IWorkoutCompletionService StubCompletionService()
    {
        var svc = Substitute.For<IWorkoutCompletionService>();
        svc.CompleteAsync(Arg.Any<WorkoutLog>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>())
            .Returns(new List<string>());
        return svc;
    }

    private static ISessionLockService StubLockService()
    {
        var svc = Substitute.For<ISessionLockService>();
        svc.ReleaseAsync(Arg.Any<Guid>(), Arg.Any<LockHolder>(), Arg.Any<LockType>(),
            Arg.Any<CancellationToken>()).Returns(true);
        return svc;
    }

    [Fact]
    public async Task HandleAsync_ValidRequest_CompletesWorkout()
    {
        var logId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(externalId: logId, clientId: _clientId);
        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log]);
        var completionService = StubCompletionService();

        var ep = Factory.Create<CompleteWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, completionService, StubLockService(), Substitute.For<IRealtimeNotifier>());

        await ep.HandleAsync(new CompleteWorkoutRequest { LogId = logId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await completionService.Received(1).CompleteAsync(
            Arg.Any<WorkoutLog>(),
            Arg.Is<DateTime>(d => d > DateTime.UtcNow.AddSeconds(-5) && d <= DateTime.UtcNow),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NotFound_Returns404()
    {
        var mongo = WorkoutLogTestHelpers.CreateMockMongo();

        var ep = Factory.Create<CompleteWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, StubCompletionService(), StubLockService(), Substitute.For<IRealtimeNotifier>());

        await ep.HandleAsync(new CompleteWorkoutRequest { LogId = Guid.NewGuid() }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_OtherClientsLog_Returns404()
    {
        // A log belonging to a different client must not be accessible.
        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: []);

        var ep = Factory.Create<CompleteWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, StubCompletionService(), StubLockService(), Substitute.For<IRealtimeNotifier>());

        await ep.HandleAsync(new CompleteWorkoutRequest { LogId = Guid.NewGuid() }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_PassesUtcNowAsCompletionInstant()
    {
        var logId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(externalId: logId, clientId: _clientId);
        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log]);
        var completionService = StubCompletionService();

        var before = DateTime.UtcNow;

        var ep = Factory.Create<CompleteWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, completionService, StubLockService(), Substitute.For<IRealtimeNotifier>());

        await ep.HandleAsync(new CompleteWorkoutRequest { LogId = logId }, TestContext.Current.CancellationToken);

        var after = DateTime.UtcNow;

        await completionService.Received(1).CompleteAsync(
            Arg.Any<WorkoutLog>(),
            Arg.Is<DateTime>(d => d >= before && d <= after),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_WorkoutAlreadyCompleted_Returns409()
    {
        var logId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(externalId: logId, clientId: _clientId);
        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log]);

        var completionService = Substitute.For<IWorkoutCompletionService>();
        completionService
            .CompleteAsync(Arg.Any<WorkoutLog>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>())
            .Throws(new WorkoutAlreadyCompletedException());

        var ep = Factory.Create<CompleteWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, completionService, StubLockService(), Substitute.For<IRealtimeNotifier>());

        await ep.HandleAsync(new CompleteWorkoutRequest { LogId = logId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(409,
            "WorkoutAlreadyCompletedException must be surfaced as 409, not 500");
    }
}
