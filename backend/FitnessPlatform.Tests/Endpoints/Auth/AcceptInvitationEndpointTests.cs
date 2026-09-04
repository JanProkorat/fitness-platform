using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
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
    private readonly IConversationSeedService _conversationSeedService = Substitute.For<IConversationSeedService>();

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
            db, userManager, _audit, _notificationService, _notifier, _conversationSeedService);

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
            _trainerId, NotificationType.ClientRequestAccepted,
            Arg.Any<IReadOnlyDictionary<string, string>>(),
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
            db, userManager, _audit, _notificationService, _notifier, _conversationSeedService);

        await ep.HandleAsync(new AcceptInvitationRequest { Token = "dual-role-token" }, TestContext.Current.CancellationToken);

        ep.ValidationFailed.Should().BeFalse();
        db.ClientProfessionalLinks.Received(1).Add(Arg.Is<ClientProfessionalLink>(
            l => l.CanViewTrainingPlans && l.CanViewNutritionPlans));
    }

    /// <summary>
    /// The InvitationToken carries an explicit RequestedScope stamped at invite-creation
    /// time (#917) — the accept flow must honor it instead of re-deriving both flags
    /// from the professional's current held roles, even though the professional holds
    /// both roles here.
    /// </summary>
    [Fact]
    public async Task HandleAsync_TokenCarriesExplicitScope_HonorsStoredScopeOverHeldRoles()
    {
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerId).Build();
        var invitation = EntityBuilder.InvitationToken
            .WithToken("scoped-token")
            .WithProfessionalProfile(trainerProfile)
            .WithRequestedScope(LinkCapabilityScope.NutritionOnly)
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
            db, userManager, _audit, _notificationService, _notifier, _conversationSeedService);

        await ep.HandleAsync(new AcceptInvitationRequest { Token = "scoped-token" }, TestContext.Current.CancellationToken);

        ep.ValidationFailed.Should().BeFalse();
        db.ClientProfessionalLinks.Received(1).Add(Arg.Is<ClientProfessionalLink>(
            l => l.CanViewNutritionPlans && !l.CanViewTrainingPlans));
    }

    /// <summary>
    /// Regression test for #768 — an invite's personal message must surface as the
    /// conversation's first message when the invitee (who had no account yet at
    /// invite-creation time) later accepts via the token flow.
    /// </summary>
    [Fact]
    public async Task HandleAsync_PendingInviteWithMessage_SeedsConversationMessage()
    {
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerId).Build();
        var invitation = EntityBuilder.InvitationToken
            .WithToken("invite-token-with-message")
            .WithEmail("client@test.com")
            .WithProfessionalProfile(trainerProfile)
            .Build();
        var pendingInvite = new PendingInvite
        {
            ProfessionalProfileId = trainerProfile.Id,
            Email = "client@test.com",
            Message = "Excited to start working with you!",
            IsAccepted = false,
        };

        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(invitation)
            .With(pendingInvite)
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
            db, userManager, _audit, _notificationService, _notifier, _conversationSeedService);

        await ep.HandleAsync(new AcceptInvitationRequest { Token = "invite-token-with-message" }, TestContext.Current.CancellationToken);

        ep.ValidationFailed.Should().BeFalse();
        pendingInvite.IsAccepted.Should().BeTrue();
        await _conversationSeedService.Received(1).GetOrSeedConversationAsync(
            _trainerId, _userId, _trainerId, Arg.Any<string>(), pendingInvite.Message,
            seedIntoExisting: false, Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// A client may hold at most one active coach per profession (#980). A different
    /// professional already holds an active link with CanViewNutritionPlans — accepting
    /// this token invite would occupy the same slot with a second nutritionist.
    /// </summary>
    [Fact]
    public async Task HandleAsync_ClientHasActiveNutritionistLink_AnotherNutritionistTokenAccepted_ThrowsErrorWithCode()
    {
        var occupyingProfessionalUserId = Guid.NewGuid();
        var occupyingProfessionalProfile = new ProfessionalProfile
        {
            Id = 1, PublicId = Guid.NewGuid(), UserId = occupyingProfessionalUserId
        };
        var clientProfile = new ClientProfile { Id = 1, UserId = _userId };
        var occupyingLink = EntityBuilder.ClientProfessionalLink
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(occupyingProfessionalProfile)
            .WithCanViewNutritionPlans(true)
            .WithCanViewTrainingPlans(false)
            .Build();

        var invitingProfile = EntityBuilder.ProfessionalProfile.WithId(2).WithUserId(_trainerId).Build();
        var invitation = EntityBuilder.InvitationToken
            .WithToken("nutrition-conflict-token")
            .WithProfessionalProfile(invitingProfile)
            .Build();

        var db = new MockDbBuilder()
            .With(clientProfile)
            .With(occupyingProfessionalProfile)
            .With(invitingProfile)
            .With(occupyingLink)
            .With(invitation)
            .Build();

        var invitingUser = EntityBuilder.User.WithId(_trainerId).WithEmail("inviting-nutritionist@test.com")
            .WithFirstName("N").WithLastName("R").Build();

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_trainerId.ToString()).Returns(invitingUser);
        userManager.GetRolesAsync(invitingUser).Returns(["Nutritionist"]);

        var ep = Factory.Create<AcceptInvitationEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            db, userManager, _audit, _notificationService, _notifier, _conversationSeedService);

        var act = () => ep.HandleAsync(
            new AcceptInvitationRequest { Token = "nutrition-conflict-token" }, TestContext.Current.CancellationToken);

        var exception = await act.Should().ThrowAsync<ValidationFailureException>();
        exception.Which.Failures.Should().ContainSingle(
            f => f.ErrorCode == ErrorCodes.ProfessionAlreadyOccupied);
        invitation.IsUsed.Should().BeFalse();
        db.ClientProfessionalLinks.DidNotReceive().Add(Arg.Any<ClientProfessionalLink>());
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
            db, userManager, _audit, _notificationService, _notifier, _conversationSeedService);

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
            db, userManager, _audit, _notificationService, _notifier, _conversationSeedService);

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
            db, userManager, _audit, _notificationService, _notifier, _conversationSeedService);

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
            db, userManager, _audit, _notificationService, _notifier, _conversationSeedService);

        await ep.HandleAsync(new AcceptInvitationRequest { Token = "one-time-token" }, TestContext.Current.CancellationToken);

        invitation.IsUsed.Should().BeTrue();
    }
}
