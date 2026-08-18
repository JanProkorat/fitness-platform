using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Features.WorkoutLogs.GetExerciseProgress;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.WorkoutLogs;

/// <summary>
/// Tests for <see cref="GetExerciseProgressEndpoint"/>.
/// </summary>
public class GetExerciseProgressEndpointTests
{
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly Guid _clientPublicId = Guid.NewGuid();
    private readonly Guid _clientUserId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_ValidRequest_Returns200()
    {
        var mongo = WorkoutLogTestHelpers.CreateMockMongo();
        var linkAuthorizationService = EndpointTestHelpers.CreateGrantingLinkAuthorizationService();
        // After fix #529: the endpoint loads ClientProfile to resolve UserId.
        // Provide a mock db that returns a matching ClientProfile.
        var db = BuildMockDbWithClientProfile(_clientPublicId, _clientUserId);

        var ep = Factory.Create<GetExerciseProgressEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, linkAuthorizationService, db);

        await ep.HandleAsync(new GetExerciseProgressRequest
        {
            ClientId = _clientPublicId,
            ExerciseId = Guid.NewGuid()
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }

    [Fact]
    public async Task HandleAsync_NoActiveLink_Returns404()
    {
        var mongo = WorkoutLogTestHelpers.CreateMockMongo();
        var linkAuthorizationService = WorkoutLogTestHelpers.CreateDenyingLinkAuthorizationService();
        // Client profile is seeded so the guard under test — the capability check at :54 — is the
        // only thing that can produce the 404. An empty db would let the downstream ClientProfile
        // lookup (:66) return the same status, making this indistinguishable from
        // HandleAsync_ClientProfileNotFound_Returns404.
        var db = BuildMockDbWithClientProfile(_clientPublicId, _clientUserId);

        var ep = Factory.Create<GetExerciseProgressEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, linkAuthorizationService, db);

        await ep.HandleAsync(new GetExerciseProgressRequest
        {
            ClientId = _clientPublicId,
            ExerciseId = Guid.NewGuid()
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    /// <summary>
    /// Mirror-site regression guard: this is training-domain data and must require
    /// <c>CanViewTrainingPlans</c> specifically. A link that grants only the nutrition domain
    /// must still be denied — if the guard were ever widened to <c>caps is not null</c>, this
    /// test would regress to 200.
    /// </summary>
    [Fact]
    public async Task HandleAsync_LinkGrantsOnlyNutrition_Returns404()
    {
        var mongo = WorkoutLogTestHelpers.CreateMockMongo();
        var linkAuthorizationService = EndpointTestHelpers.CreateGrantingLinkAuthorizationService(
            canViewNutritionPlans: true, canViewTrainingPlans: false);
        var db = BuildMockDbWithClientProfile(_clientPublicId, _clientUserId);

        var ep = Factory.Create<GetExerciseProgressEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, linkAuthorizationService, db);

        await ep.HandleAsync(new GetExerciseProgressRequest
        {
            ClientId = _clientPublicId,
            ExerciseId = Guid.NewGuid()
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_ClientProfileNotFound_Returns404()
    {
        // linkAuthorizationService says "link exists" but the ClientProfile row is missing
        // (data integrity gap).
        var mongo = WorkoutLogTestHelpers.CreateMockMongo();
        var linkAuthorizationService = EndpointTestHelpers.CreateGrantingLinkAuthorizationService();
        // Empty db — no ClientProfile matching the PublicId
        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<GetExerciseProgressEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, linkAuthorizationService, db);

        await ep.HandleAsync(new GetExerciseProgressRequest
        {
            ClientId = _clientPublicId,
            ExerciseId = Guid.NewGuid()
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private static IApplicationDbContext BuildMockDbWithClientProfile(Guid publicId, Guid userId)
    {
        var clientUser = EntityBuilder.User.WithId(userId).Build();
        var clientProfile = EntityBuilder.ClientProfile
            .WithId(1)
            .WithPublicId(publicId)
            .WithUser(clientUser)
            .Build();

        return new MockDbBuilder()
            .With(clientProfile)
            .Build();
    }
}
