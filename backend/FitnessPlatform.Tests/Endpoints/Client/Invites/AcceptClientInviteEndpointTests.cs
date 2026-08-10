using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Client.Invites.Accept;
using FitnessPlatform.Tests.Builders;
using Microsoft.AspNetCore.Identity;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Client.Invites;

/// <summary>
/// Tests for <see cref="AcceptClientInviteEndpoint"/>, in particular the
/// IDOR guard that scopes the invite lookup to the caller's own email
/// (issue #654).
/// </summary>
public class AcceptClientInviteEndpointTests
{
    private readonly INotificationService _notificationService = Substitute.For<INotificationService>();
    private readonly IRealtimeNotifier _notifier = Substitute.For<IRealtimeNotifier>();
    private readonly IAuditService _audit = Substitute.For<IAuditService>();
    private readonly IConversationSeedService _conversationSeedService = Substitute.For<IConversationSeedService>();
    private readonly UserManager<ApplicationUser> _userManager = EndpointTestHelpers.CreateFakeUserManager();

    private static ApplicationUser CreateUser(Guid id, string email) => new()
    {
        Id = id,
        Email = email,
        NormalizedEmail = email.ToUpperInvariant(),
        FirstName = "Anna",
        LastName = "Novakova"
    };

    private AcceptClientInviteEndpoint CreateEndpoint(
        Guid callerId,
        FitnessPlatform.Application.Infrastructure.Data.IApplicationDbContext db) =>
        Factory.Create<AcceptClientInviteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(callerId, AppRoles.Client))),
            db, _userManager, _notificationService, _notifier, _audit, _conversationSeedService);

    [Fact]
    public async Task Accept_ByRecipient_Returns204_AndMarksAccepted()
    {
        // Arrange
        var clientId = Guid.NewGuid();
        var inviteId = Guid.NewGuid();
        var clientUser = CreateUser(clientId, "client@example.com");
        var professionalProfile = new ProfessionalProfile { Id = 1, PublicId = Guid.NewGuid(), UserId = Guid.NewGuid() };
        var invite = new PendingInvite
        {
            PublicId = inviteId,
            ProfessionalProfileId = professionalProfile.Id,
            ProfessionalProfile = professionalProfile,
            // Different casing than the caller's NormalizedEmail — must still match.
            Email = "Client@Example.com",
            IsAccepted = false
        };

        var db = new MockDbBuilder()
            .With(clientUser)
            .With(professionalProfile)
            .With(invite)
            .Build();

        var ep = CreateEndpoint(clientId, db);

        // Act
        await ep.HandleAsync(new AcceptClientInviteRequest { Id = inviteId }, TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(204);
        invite.IsAccepted.Should().BeTrue();
        await _notifier.Received(1).NotifyAsync(
            professionalProfile.UserId, "inviteaccepted", Arg.Any<object>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Accept_ByNonRecipient_Returns404_AndDoesNotAcceptOrNotify()
    {
        // Arrange — attacker knows the invite GUID but the invite belongs to a different email.
        var attackerId = Guid.NewGuid();
        var inviteId = Guid.NewGuid();
        var attacker = CreateUser(attackerId, "attacker@example.com");
        var professionalProfile = new ProfessionalProfile { Id = 1, PublicId = Guid.NewGuid(), UserId = Guid.NewGuid() };
        var invite = new PendingInvite
        {
            PublicId = inviteId,
            ProfessionalProfileId = professionalProfile.Id,
            ProfessionalProfile = professionalProfile,
            Email = "victim@example.com",
            IsAccepted = false
        };

        var db = new MockDbBuilder()
            .With(attacker)
            .With(professionalProfile)
            .With(invite)
            .Build();

        var ep = CreateEndpoint(attackerId, db);

        // Act
        await ep.HandleAsync(new AcceptClientInviteRequest { Id = inviteId }, TestContext.Current.CancellationToken);

        // Assert — 404, not 403: must not confirm the GUID exists (no enumeration oracle),
        // and the real recipient's invite must survive untouched.
        ep.HttpContext.Response.StatusCode.Should().Be(404);
        invite.IsAccepted.Should().BeFalse();
        await _notifier.DidNotReceiveWithAnyArgs().NotifyAsync(default, default!, default!, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task Accept_WithInviteMessage_SeedsConversationMessage()
    {
        // Arrange — invite carries a personal message from the professional (#768).
        var clientId = Guid.NewGuid();
        var inviteId = Guid.NewGuid();
        var clientUser = CreateUser(clientId, "client@example.com");
        var professionalProfile = new ProfessionalProfile { Id = 1, PublicId = Guid.NewGuid(), UserId = Guid.NewGuid() };
        var invite = new PendingInvite
        {
            PublicId = inviteId,
            ProfessionalProfileId = professionalProfile.Id,
            ProfessionalProfile = professionalProfile,
            Email = "client@example.com",
            Message = "Welcome aboard, looking forward to working with you!",
            IsAccepted = false
        };

        var db = new MockDbBuilder()
            .With(clientUser)
            .With(professionalProfile)
            .With(invite)
            .Build();

        var ep = CreateEndpoint(clientId, db);

        // Act
        await ep.HandleAsync(new AcceptClientInviteRequest { Id = inviteId }, TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(204);
        await _conversationSeedService.Received(1).GetOrSeedConversationAsync(
            professionalProfile.UserId,
            clientId,
            professionalProfile.UserId,
            Arg.Any<string>(),
            invite.Message,
            seedIntoExisting: false,
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Accept_WithoutInviteMessage_DoesNotSeedConversation()
    {
        // Arrange — invite has no message; must not create an empty conversation shell.
        var clientId = Guid.NewGuid();
        var inviteId = Guid.NewGuid();
        var clientUser = CreateUser(clientId, "client@example.com");
        var professionalProfile = new ProfessionalProfile { Id = 1, PublicId = Guid.NewGuid(), UserId = Guid.NewGuid() };
        var invite = new PendingInvite
        {
            PublicId = inviteId,
            ProfessionalProfileId = professionalProfile.Id,
            ProfessionalProfile = professionalProfile,
            Email = "client@example.com",
            IsAccepted = false
        };

        var db = new MockDbBuilder()
            .With(clientUser)
            .With(professionalProfile)
            .With(invite)
            .Build();

        var ep = CreateEndpoint(clientId, db);

        // Act
        await ep.HandleAsync(new AcceptClientInviteRequest { Id = inviteId }, TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(204);
        await _conversationSeedService.DidNotReceiveWithAnyArgs().GetOrSeedConversationAsync(
            default, default, default, default!, default, default, TestContext.Current.CancellationToken);
    }

    /// <summary>
    /// The PendingInvite carries an explicit RequestedScope stamped at invite-creation
    /// time (#917) — the accept flow must honor it instead of re-deriving both flags
    /// from the professional's current held roles, even though the professional holds
    /// both roles here.
    /// </summary>
    [Fact]
    public async Task Accept_InviteCarriesExplicitScope_HonorsStoredScopeOverHeldRoles()
    {
        var clientId = Guid.NewGuid();
        var inviteId = Guid.NewGuid();
        var clientUser = CreateUser(clientId, "client@example.com");
        var professionalUserId = Guid.NewGuid();
        var professionalUser = CreateUser(professionalUserId, "pro@example.com");
        var professionalProfile = new ProfessionalProfile
        {
            Id = 1, PublicId = Guid.NewGuid(), UserId = professionalUserId, User = professionalUser
        };
        var invite = new PendingInvite
        {
            PublicId = inviteId,
            ProfessionalProfileId = professionalProfile.Id,
            ProfessionalProfile = professionalProfile,
            Email = "client@example.com",
            IsAccepted = false,
            RequestedScope = LinkCapabilityScope.NutritionOnly
        };

        var db = new MockDbBuilder()
            .With(clientUser)
            .With(professionalProfile)
            .With(invite)
            .Build();

        _userManager.FindByIdAsync(professionalUserId.ToString()).Returns(professionalUser);
        _userManager.GetRolesAsync(professionalUser).Returns(["Trainer", "Nutritionist"]);

        var ep = CreateEndpoint(clientId, db);

        await ep.HandleAsync(new AcceptClientInviteRequest { Id = inviteId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);
        db.ClientProfessionalLinks.Received(1).Add(Arg.Is<ClientProfessionalLink>(
            l => l.CanViewNutritionPlans && !l.CanViewTrainingPlans));
    }

    [Fact]
    public async Task Accept_UnknownOrAlreadyAcceptedInvite_Returns404()
    {
        // Arrange — existing behavior preserved: unknown GUID or already-consumed invite is 404.
        var clientId = Guid.NewGuid();
        var clientUser = CreateUser(clientId, "client@example.com");

        var db = new MockDbBuilder().With(clientUser).Build();
        var ep = CreateEndpoint(clientId, db);

        // Act
        await ep.HandleAsync(new AcceptClientInviteRequest { Id = Guid.NewGuid() }, TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }
}
