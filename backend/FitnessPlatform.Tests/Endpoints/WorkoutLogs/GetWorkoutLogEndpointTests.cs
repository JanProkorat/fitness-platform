using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.WorkoutLogs.GetWorkoutLog;
using FitnessPlatform.Tests.Endpoints;

namespace FitnessPlatform.Tests.Endpoints.WorkoutLogs;

/// <summary>
/// Tests for <see cref="GetWorkoutLogEndpoint"/>.
/// </summary>
public class GetWorkoutLogEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_OwnLog_Returns200()
    {
        var logId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(externalId: logId, clientId: _clientId);
        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log]);

        var ep = Factory.Create<GetWorkoutLogEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo);

        await ep.HandleAsync(new GetWorkoutLogRequest { LogId = logId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }

    [Fact]
    public async Task HandleAsync_NotFound_Returns404()
    {
        var mongo = WorkoutLogTestHelpers.CreateMockMongo();

        var ep = Factory.Create<GetWorkoutLogEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo);

        await ep.HandleAsync(new GetWorkoutLogRequest { LogId = Guid.NewGuid() }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }
}
