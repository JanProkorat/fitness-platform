using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Common;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.ClientTraining;
using FitnessPlatform.Application.Features.WorkoutLogs.CompleteWorkout;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using Microsoft.Extensions.Logging;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace FitnessPlatform.Tests.Endpoints.WorkoutLogs;

/// <summary>
/// Tests for <see cref="CompleteWorkoutEndpoint"/>.
/// The endpoint delegates the completion pipeline to <see cref="IWorkoutCompletionService"/>;
/// these tests verify the HTTP contract, ownership check, and the trainingprogressupdated broadcast.
/// Behavioral tests (TrainingCompletion fan-out, PR detection) live in
/// <see cref="WorkoutCompletionServiceTests"/>.
/// </summary>
public class CompleteWorkoutEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();

    private IWorkoutCompletionService StubCompletionService()
    {
        var svc = Substitute.For<IWorkoutCompletionService>();
        svc.CompleteAsync(Arg.Any<SessionExecution>(), Arg.Any<DateTime>(), Arg.Any<TimeZoneInfo>(), Arg.Any<CancellationToken>())
            .Returns(new List<string>());
        return svc;
    }

    private static IApplicationDbContext CreateMockDb() => new MockDbBuilder().Build();

    private static ISessionLockService StubLockService()
    {
        var svc = Substitute.For<ISessionLockService>();
        svc.ReleaseAsync(Arg.Any<Guid>(), Arg.Any<LockHolder>(), Arg.Any<LockType>(),
            Arg.Any<CancellationToken>()).Returns(true);
        return svc;
    }

    private static IComplianceService StubComplianceService()
    {
        var svc = Substitute.For<IComplianceService>();
        svc.CalculateComplianceAsync(Arg.Any<Guid>(), Arg.Any<DateTime>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>())
            .Returns(new ComplianceResult { CompliancePercent = 100m });
        svc.CalculateStreakAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(1);
        // #935: TrainingProgressBroadcaster now anchors the streak walk on the caller-supplied
        // local calendar day rather than DateTime.UtcNow — stub the new overload too.
        svc.CalculateStreakAsync(Arg.Any<Guid>(), Arg.Any<DateOnly>(), Arg.Any<CancellationToken>())
            .Returns(1);
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
            mongo, completionService, StubLockService(), Substitute.For<IRealtimeNotifier>(),
            StubComplianceService(),
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService(),
            Substitute.For<ILogger<CompleteWorkoutEndpoint>>(),
            CreateMockDb(), TimeProvider.System);

        await ep.HandleAsync(new CompleteWorkoutRequest { LogId = logId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await completionService.Received(1).CompleteAsync(
            Arg.Any<SessionExecution>(),
            Arg.Is<DateTime>(d => d > DateTime.UtcNow.AddSeconds(-5) && d <= DateTime.UtcNow),
            Arg.Any<TimeZoneInfo>(),
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
            mongo, StubCompletionService(), StubLockService(), Substitute.For<IRealtimeNotifier>(),
            StubComplianceService(),
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService(),
            Substitute.For<ILogger<CompleteWorkoutEndpoint>>(),
            CreateMockDb(), TimeProvider.System);

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
            mongo, StubCompletionService(), StubLockService(), Substitute.For<IRealtimeNotifier>(),
            StubComplianceService(),
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService(),
            Substitute.For<ILogger<CompleteWorkoutEndpoint>>(),
            CreateMockDb(), TimeProvider.System);

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
            mongo, completionService, StubLockService(), Substitute.For<IRealtimeNotifier>(),
            StubComplianceService(),
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService(),
            Substitute.For<ILogger<CompleteWorkoutEndpoint>>(),
            CreateMockDb(), TimeProvider.System);

        await ep.HandleAsync(new CompleteWorkoutRequest { LogId = logId }, TestContext.Current.CancellationToken);

        var after = DateTime.UtcNow;

        await completionService.Received(1).CompleteAsync(
            Arg.Any<SessionExecution>(),
            Arg.Is<DateTime>(d => d >= before && d <= after),
            Arg.Any<TimeZoneInfo>(),
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
            .CompleteAsync(Arg.Any<SessionExecution>(), Arg.Any<DateTime>(), Arg.Any<TimeZoneInfo>(), Arg.Any<CancellationToken>())
            .Throws(new WorkoutAlreadyCompletedException());

        var ep = Factory.Create<CompleteWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, completionService, StubLockService(), Substitute.For<IRealtimeNotifier>(),
            StubComplianceService(),
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService(),
            Substitute.For<ILogger<CompleteWorkoutEndpoint>>(),
            CreateMockDb(), TimeProvider.System);

        await ep.HandleAsync(new CompleteWorkoutRequest { LogId = logId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(409,
            "WorkoutAlreadyCompletedException must be surfaced as 409, not 500");
    }

    // ── Gap A: trainingprogressupdated broadcast ─────────────────────────────────

    [Fact]
    public async Task HandleAsync_PlanBoundWorkout_EmitsTrainingProgressUpdated()
    {
        // Arrange: a plan-bound log (has both SessionId and PlanId), with a matching plan.
        var logId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var planId = Guid.NewGuid();
        var trainerId = Guid.NewGuid();
        var clientPublicId = Guid.NewGuid();

        var log = WorkoutLogTestHelpers.CreateLog(
            externalId: logId,
            clientId: _clientId,
            planId: planId,
            sessionId: sessionId);

        var plan = new TrainingPlan
        {
            ExternalId = planId,
            ClientId = clientPublicId,
            TrainerId = trainerId,
            Name = "Test Plan",
            Status = TrainingPlanStatus.Active,
            Weeks = [],
            Version = 1,
            DateCreated = DateTime.UtcNow.AddDays(-10)
        };

        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log], plans: [plan]);
        var notifier = Substitute.For<IRealtimeNotifier>();

        var ep = Factory.Create<CompleteWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, StubCompletionService(), StubLockService(), notifier,
            StubComplianceService(),
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService(),
            Substitute.For<ILogger<CompleteWorkoutEndpoint>>(),
            CreateMockDb(), TimeProvider.System);

        // Act
        await ep.HandleAsync(new CompleteWorkoutRequest { LogId = logId }, TestContext.Current.CancellationToken);

        // Assert: 200 and trainingprogressupdated sent to trainer
        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await notifier.Received(1).NotifyAsync(
            trainerId,
            TrainingProgressBroadcaster.EventName,
            Arg.Is<TrainingProgressUpdatedEvent>(e =>
                e.SessionId == sessionId &&
                e.ClientId == clientPublicId &&
                e.SessionComplete),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_AdHocWorkoutNoSessionId_DoesNotEmitTrainingProgressUpdated()
    {
        // Arrange: an ad-hoc workout (no SessionId, no PlanId).
        var logId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(externalId: logId, clientId: _clientId);
        // sessionId and planId are null by default

        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log]);
        var notifier = Substitute.For<IRealtimeNotifier>();

        var ep = Factory.Create<CompleteWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, StubCompletionService(), StubLockService(), notifier,
            StubComplianceService(),
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService(),
            Substitute.For<ILogger<CompleteWorkoutEndpoint>>(),
            CreateMockDb(), TimeProvider.System);

        // Act
        await ep.HandleAsync(new CompleteWorkoutRequest { LogId = logId }, TestContext.Current.CancellationToken);

        // Assert: 200 and NO trainingprogressupdated (no trainer to notify)
        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await notifier.DidNotReceive().NotifyAsync(
            Arg.Any<Guid>(),
            TrainingProgressBroadcaster.EventName,
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }
}
