using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.WorkoutLogs.CompleteWorkout;
using FitnessPlatform.Tests.Endpoints;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.WorkoutLogs;

/// <summary>
/// Tests for <see cref="CompleteWorkoutEndpoint"/>.
/// </summary>
public class CompleteWorkoutEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_ValidRequest_CompletesWorkout()
    {
        var logId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(externalId: logId, clientId: _clientId);
        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log]);

        var prDetection = Substitute.For<IPrDetectionService>();
        prDetection.DetectAndMarkPRsAsync(Arg.Any<WorkoutLog>(), Arg.Any<CancellationToken>())
            .Returns(new List<string>());

        var notifications = Substitute.For<INotificationService>();

        var ep = Factory.Create<CompleteWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, prDetection, notifications);

        await ep.HandleAsync(new CompleteWorkoutRequest { LogId = logId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await prDetection.Received(1).DetectAndMarkPRsAsync(
            Arg.Any<WorkoutLog>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NotFound_Returns404()
    {
        var mongo = WorkoutLogTestHelpers.CreateMockMongo();
        var prDetection = Substitute.For<IPrDetectionService>();
        var notifications = Substitute.For<INotificationService>();

        var ep = Factory.Create<CompleteWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, prDetection, notifications);

        await ep.HandleAsync(new CompleteWorkoutRequest { LogId = Guid.NewGuid() }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }
}
