using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Auth.AcceptInvitation;
using FitnessPlatform.Tests.Builders;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Auth;

public class AcceptInvitationEndpointTests
{
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly IAuditService _audit = Substitute.For<IAuditService>();

    [Fact]
    public async Task HandleAsync_ValidToken_AcceptsInvitation()
    {
        var trainerProfile = EntityBuilder.TrainerProfile.WithId(1).WithUserId(_trainerId).Build();
        var invitation = EntityBuilder.InvitationToken
            .WithToken("invite-token")
            .WithTrainerProfile(trainerProfile)
            .Build();

        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(invitation)
            .Build();

        var trainerUser = EntityBuilder.User.WithId(_trainerId).WithEmail("trainer@test.com")
            .WithFirstName("T").WithLastName("R").Build();

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_trainerId.ToString()).Returns(trainerUser);
        userManager.GetRolesAsync(trainerUser).Returns(["Trainer"]);

        var ep = Factory.Create<AcceptInvitationEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            db, userManager, _audit);

        await ep.HandleAsync(new AcceptInvitationRequest { Token = "invite-token" }, TestContext.Current.CancellationToken);

        ep.ValidationFailed.Should().BeFalse();
        ep.Response.Message.Should().Be("Invitation accepted successfully.");
        invitation.IsUsed.Should().BeTrue();
        db.ClientProfiles.Received(1).Add(Arg.Is<ClientProfile>(cp => cp.UserId == _userId));
        db.ClientTrainerLinks.Received(1).Add(Arg.Any<ClientTrainerLink>());
    }

    [Fact]
    public async Task HandleAsync_ExpiredToken_ThrowsError()
    {
        var trainerProfile = EntityBuilder.TrainerProfile.WithId(1).WithUserId(_trainerId).Build();
        var invitation = EntityBuilder.InvitationToken
            .WithToken("expired-token")
            .WithTrainerProfile(trainerProfile)
            .Expired()
            .Build();

        var db = new MockDbBuilder().With(invitation).Build();
        var userManager = EndpointTestHelpers.CreateFakeUserManager();

        var ep = Factory.Create<AcceptInvitationEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            db, userManager, _audit);

        var act = () => ep.HandleAsync(new AcceptInvitationRequest { Token = "expired-token" }, default);

        await act.Should().ThrowAsync<ValidationFailureException>();
    }

    [Fact]
    public async Task HandleAsync_UsedToken_ThrowsError()
    {
        var trainerProfile = EntityBuilder.TrainerProfile.WithId(1).WithUserId(_trainerId).Build();
        var invitation = EntityBuilder.InvitationToken
            .WithToken("used-token")
            .WithTrainerProfile(trainerProfile)
            .Used()
            .Build();

        var db = new MockDbBuilder().With(invitation).Build();
        var userManager = EndpointTestHelpers.CreateFakeUserManager();

        var ep = Factory.Create<AcceptInvitationEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            db, userManager, _audit);

        var act = () => ep.HandleAsync(new AcceptInvitationRequest { Token = "used-token" }, default);

        await act.Should().ThrowAsync<ValidationFailureException>();
    }

    [Fact]
    public async Task HandleAsync_InvalidToken_ThrowsError()
    {
        var db = new MockDbBuilder().Build();
        var userManager = EndpointTestHelpers.CreateFakeUserManager();

        var ep = Factory.Create<AcceptInvitationEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            db, userManager, _audit);

        var act = () => ep.HandleAsync(new AcceptInvitationRequest { Token = "nonexistent" }, default);

        await act.Should().ThrowAsync<ValidationFailureException>();
    }

    [Fact]
    public async Task HandleAsync_MarksTokenAsUsed()
    {
        var trainerProfile = EntityBuilder.TrainerProfile.WithId(1).WithUserId(_trainerId).Build();
        var invitation = EntityBuilder.InvitationToken
            .WithToken("one-time-token")
            .WithTrainerProfile(trainerProfile)
            .Build();

        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(invitation)
            .Build();

        var trainerUser = EntityBuilder.User.WithId(_trainerId).WithEmail("trainer@test.com")
            .WithFirstName("T").WithLastName("R").Build();

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_trainerId.ToString()).Returns(trainerUser);
        userManager.GetRolesAsync(trainerUser).Returns(["Trainer"]);

        var ep = Factory.Create<AcceptInvitationEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            db, userManager, _audit);

        await ep.HandleAsync(new AcceptInvitationRequest { Token = "one-time-token" }, TestContext.Current.CancellationToken);

        invitation.IsUsed.Should().BeTrue();
    }
}
