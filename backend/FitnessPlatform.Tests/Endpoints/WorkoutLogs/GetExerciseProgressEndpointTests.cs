using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.WorkoutLogs.GetExerciseProgress;
using FitnessPlatform.Tests.Endpoints;

namespace FitnessPlatform.Tests.Endpoints.WorkoutLogs;

/// <summary>
/// Tests for <see cref="GetExerciseProgressEndpoint"/>.
/// </summary>
public class GetExerciseProgressEndpointTests
{
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly Guid _clientId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_ValidRequest_Returns200()
    {
        var mongo = WorkoutLogTestHelpers.CreateMockMongo();
        var authHelper = WorkoutLogTestHelpers.CreateMockAuthHelper(true);

        var ep = Factory.Create<GetExerciseProgressEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, authHelper);

        await ep.HandleAsync(new GetExerciseProgressRequest
        {
            ClientId = _clientId,
            ExerciseId = Guid.NewGuid()
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }

    [Fact]
    public async Task HandleAsync_NoActiveLink_Returns404()
    {
        var mongo = WorkoutLogTestHelpers.CreateMockMongo();
        var authHelper = WorkoutLogTestHelpers.CreateMockAuthHelper(false);

        var ep = Factory.Create<GetExerciseProgressEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, authHelper);

        await ep.HandleAsync(new GetExerciseProgressRequest
        {
            ClientId = _clientId,
            ExerciseId = Guid.NewGuid()
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }
}
