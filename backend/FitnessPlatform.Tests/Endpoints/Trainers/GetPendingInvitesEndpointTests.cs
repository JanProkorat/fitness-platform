using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.Trainers.PendingInvites.GetAll;
using FitnessPlatform.Tests.Builders;

namespace FitnessPlatform.Tests.Endpoints.Trainers;

public class GetPendingInvitesEndpointTests
{
    private readonly Guid _trainerId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_WithPendingInvites_ReturnsIdInEachItem()
    {
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerId).Build();
        var invite = EntityBuilder.PendingInvite
            .WithId(77)
            .WithProfessionalProfile(trainerProfile)
            .WithEmail("invited@test.com")
            .Build();

        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(invite)
            .Build();

        var ep = Factory.Create<GetPendingInvitesEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.Response.Invites.Should().ContainSingle();
        ep.Response.Invites[0].Id.Should().Be(77);
        ep.Response.Invites[0].Email.Should().Be("invited@test.com");
    }

    [Fact]
    public async Task HandleAsync_NoProfessionalProfile_Returns404()
    {
        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<GetPendingInvitesEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var db = new MockDbBuilder().Build();
        var ep = Factory.Create<GetPendingInvitesEndpoint>(db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }
}
