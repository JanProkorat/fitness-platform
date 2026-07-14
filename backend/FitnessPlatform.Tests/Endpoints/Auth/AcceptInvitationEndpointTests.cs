using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
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
    private readonly INotificationService _notificationService = Substitute.For<INotificationService>();
    private readonly IRealtimeNotifier _notifier = Substitute.For<IRealtimeNotifier>();

    [Fact]
    public async Task HandleAsync_ValidToken_AcceptsInvitation()
    {
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerId).Build();
        var invitation = EntityBuilder.InvitationToken
            .WithToken("invite-token")
            .WithProfessionalProfile(trainerProfile)
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
            db, userManager, _audit, _notificationService, _notifier);

        await ep.HandleAsync(new AcceptInvitationRequest { Token = "invite-token" }, TestContext.Current.CancellationToken);

        ep.ValidationFailed.Should().BeFalse();
        ep.Response.Message.Should().Be("Invitation accepted successfully.");
        invitation.IsUsed.Should().BeTrue();
        db.ClientProfiles.Received(1).Add(Arg.Is<ClientProfile>(cp => cp.UserId == _userId));
        db.ClientProfessionalLinks.Received(1).Add(Arg.Is<ClientProfessionalLink>(
            l => l.CanViewTrainingPlans && !l.CanViewNutritionPlans));

        // #770 — the professional must be notified promptly, not left to discover the
        // new client link only via a periodic poll or unrelated page reload.
        await _notificationService.Received(1).CreateAsync(
            _trainerId, NotificationType.ClientRequestAccepted, Arg.Any<string>(), Arg.Any<string>(),
            ct: TestContext.Current.CancellationToken);
        await _notifier.Received(1).NotifyAsync(
            _trainerId, "inviteaccepted", Arg.Any<object>(), Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// Regression test for #776 — a professional holding BOTH Trainer and Nutritionist
    /// roles must be granted CanViewTrainingPlans AND CanViewNutritionPlans on the new
    /// link, not a mutually-exclusive single flag.
    /// </summary>
    [Fact]
    public async Task HandleAsync_DualRoleProfessional_GrantsBothPlanViewFlags()
    {
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerId).Build();
        var invitation = EntityBuilder.InvitationToken
            .WithToken("dual-role-token")
            .WithProfessionalProfile(trainerProfile)
            .Build();

        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(invitation)
            .Build();

        var trainerUser = EntityBuilder.User.WithId(_trainerId).WithEmail("trainer@test.com")
            .WithFirstName("T").WithLastName("R").Build();

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_trainerId.ToString()).Returns(trainerUser);
        userManager.GetRolesAsync(trainerUser).Returns(["Trainer", "Nutritionist"]);

        var ep = Factory.Create<AcceptInvitationEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            db, userManager, _audit, _notificationService, _notifier);

        await ep.HandleAsync(new AcceptInvitationRequest { Token = "dual-role-token" }, TestContext.Current.CancellationToken);

        ep.ValidationFailed.Should().BeFalse();
        db.ClientProfessionalLinks.Received(1).Add(Arg.Is<ClientProfessionalLink>(
            l => l.CanViewTrainingPlans && l.CanViewNutritionPlans));
    }

    [Fact]
    public async Task HandleAsync_ExpiredToken_ThrowsError()
    {
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerId).Build();
        var invitation = EntityBuilder.InvitationToken
            .WithToken("expired-token")
            .WithProfessionalProfile(trainerProfile)
            .Expired()
            .Build();

        var db = new MockDbBuilder().With(invitation).Build();
        var userManager = EndpointTestHelpers.CreateFakeUserManager();

        var ep = Factory.Create<AcceptInvitationEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            db, userManager, _audit, _notificationService, _notifier);

        var act = () => ep.HandleAsync(new AcceptInvitationRequest { Token = "expired-token" }, default);

        await act.Should().ThrowAsync<ValidationFailureException>();
    }

    [Fact]
    public async Task HandleAsync_UsedToken_ThrowsError()
    {
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerId).Build();
        var invitation = EntityBuilder.InvitationToken
            .WithToken("used-token")
            .WithProfessionalProfile(trainerProfile)
            .Used()
            .Build();

        var db = new MockDbBuilder().With(invitation).Build();
        var userManager = EndpointTestHelpers.CreateFakeUserManager();

        var ep = Factory.Create<AcceptInvitationEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            db, userManager, _audit, _notificationService, _notifier);

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
            db, userManager, _audit, _notificationService, _notifier);

        var act = () => ep.HandleAsync(new AcceptInvitationRequest { Token = "nonexistent" }, default);

        await act.Should().ThrowAsync<ValidationFailureException>();
    }

    [Fact]
    public async Task HandleAsync_MarksTokenAsUsed()
    {
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerId).Build();
        var invitation = EntityBuilder.InvitationToken
            .WithToken("one-time-token")
            .WithProfessionalProfile(trainerProfile)
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
            db, userManager, _audit, _notificationService, _notifier);

        await ep.HandleAsync(new AcceptInvitationRequest { Token = "one-time-token" }, TestContext.Current.CancellationToken);

        invitation.IsUsed.Should().BeTrue();
    }
}
