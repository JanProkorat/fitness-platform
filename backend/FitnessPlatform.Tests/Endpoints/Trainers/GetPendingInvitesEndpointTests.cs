using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
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
            db, TimeProvider.System);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.Response.Invites.Should().ContainSingle();
        ep.Response.Invites[0].Id.Should().Be(77);
        ep.Response.Invites[0].Email.Should().Be("invited@test.com");
    }

    [Fact]
    public async Task HandleAsync_ReturnsDerivedStatus_AndOnlyListsUnansweredInvites()
    {
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerId).Build();
        var fresh = EntityBuilder.PendingInvite.WithId(1).WithProfessionalProfile(trainerProfile)
            .WithEmail("fresh@test.com").WithSentAt(DateTime.UtcNow.AddDays(-1)).Build();
        var stale = EntityBuilder.PendingInvite.WithId(2).WithProfessionalProfile(trainerProfile)
            .WithEmail("stale@test.com").WithSentAt(DateTime.UtcNow.AddDays(-8)).Build();
        var cancelled = EntityBuilder.PendingInvite.WithId(3).WithProfessionalProfile(trainerProfile)
            .WithEmail("cancelled@test.com").WithStatus(PendingInviteStatus.Cancelled).Build();
        var declined = EntityBuilder.PendingInvite.WithId(4).WithProfessionalProfile(trainerProfile)
            .WithEmail("declined@test.com").WithStatus(PendingInviteStatus.Declined).Build();

        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(fresh).With(stale).With(cancelled).With(declined)
            .Build();

        var ep = Factory.Create<GetPendingInvitesEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            db, TimeProvider.System);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.Response.Invites.Should().HaveCount(2);
        ep.Response.Invites.Single(i => i.Id == 1).Status.Should().Be(PendingInviteStatus.Pending);
        ep.Response.Invites.Single(i => i.Id == 2).Status.Should().Be(PendingInviteStatus.Expired);
        ep.Response.Invites.Select(i => i.Id).Should().BeEquivalentTo([1L, 2L], "cancelled and declined invites are not listed");
    }

    [Fact]
    public async Task HandleAsync_NoProfessionalProfile_Returns404()
    {
        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<GetPendingInvitesEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            db, TimeProvider.System);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

}
