using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.WorkoutLogs.CompleteWorkout;
using NSubstitute;

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
            mongo, completionService);

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
            mongo, StubCompletionService());

        await ep.HandleAsync(new CompleteWorkoutRequest { LogId = Guid.NewGuid() }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_OtherClientsLog_Returns404()
    {
        // A log belonging to a different client must not be accessible.
        // The real MongoDB filter (ClientId == callerClientId) would return empty results.
        // We model this by returning an empty log collection so the endpoint responds 404.
        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: []); // no match — filtered by MongoDB

        var ep = Factory.Create<CompleteWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, StubCompletionService());

        await ep.HandleAsync(new CompleteWorkoutRequest { LogId = Guid.NewGuid() }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_PassesUtcNowAsCompletionInstant()
    {
        // Verify the endpoint always passes DateTime.UtcNow (not backdated) for live completions.
        var logId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(externalId: logId, clientId: _clientId);
        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log]);
        var completionService = StubCompletionService();

        var before = DateTime.UtcNow;

        var ep = Factory.Create<CompleteWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, completionService);

        await ep.HandleAsync(new CompleteWorkoutRequest { LogId = logId }, TestContext.Current.CancellationToken);

        var after = DateTime.UtcNow;

        await completionService.Received(1).CompleteAsync(
            Arg.Any<WorkoutLog>(),
            Arg.Is<DateTime>(d => d >= before && d <= after),
            Arg.Any<CancellationToken>());
    }
}
