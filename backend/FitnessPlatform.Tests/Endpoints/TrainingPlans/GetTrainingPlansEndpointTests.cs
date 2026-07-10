using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.TrainingPlans.GetTrainingPlans;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.TrainingPlans;

/// <summary>
/// Tests for <see cref="GetTrainingPlansEndpoint"/>, in particular the server-side
/// CanViewTrainingPlans enforcement added for #590 (previously only gated client-side).
/// </summary>
public class GetTrainingPlansEndpointTests
{
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly Guid _clientId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_ClientIdFilter_WithPlanAccess_Returns200()
    {
        var plan = TrainingPlanTestHelpers.CreatePlan(clientId: _clientId, trainerId: _trainerId);
        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);
        var authHelper = TrainingPlanTestHelpers.CreateMockAuthHelper(hasPlanAccess: true);

        var ep = Factory.Create<GetTrainingPlansEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, authHelper);

        await ep.HandleAsync(new GetTrainingPlansRequest { ClientId = _clientId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await authHelper.Received(1).HasPlanAccessAsync(
            _trainerId, _clientId, true, Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// Regression test for #590 — a trainer whose ClientProfessionalLink has
    /// CanViewTrainingPlans = false must be rejected server-side, not just gated
    /// on the web UI.
    /// </summary>
    [Fact]
    public async Task HandleAsync_ClientIdFilter_WithoutPlanAccess_Returns403()
    {
        var plan = TrainingPlanTestHelpers.CreatePlan(clientId: _clientId, trainerId: _trainerId);
        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);
        var authHelper = TrainingPlanTestHelpers.CreateMockAuthHelper(hasPlanAccess: false);

        var ep = Factory.Create<GetTrainingPlansEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, authHelper);

        await ep.HandleAsync(new GetTrainingPlansRequest { ClientId = _clientId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(403);
    }

    [Fact]
    public async Task HandleAsync_NoClientIdFilter_DoesNotCheckPlanAccess_Returns200()
    {
        var plan = TrainingPlanTestHelpers.CreatePlan(trainerId: _trainerId);
        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);
        var authHelper = TrainingPlanTestHelpers.CreateMockAuthHelper(hasPlanAccess: false);

        var ep = Factory.Create<GetTrainingPlansEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, authHelper);

        await ep.HandleAsync(new GetTrainingPlansRequest(), TestContext.Current.CancellationToken);

        // Unscoped list — every plan already filters TrainerId == trainerId, so there is no
        // client-specific permission to enforce.
        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await authHelper.DidNotReceive().HasPlanAccessAsync(
            Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<bool>(), Arg.Any<CancellationToken>());
    }
}
