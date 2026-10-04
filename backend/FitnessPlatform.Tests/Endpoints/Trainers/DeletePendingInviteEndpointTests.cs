using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Trainers.PendingInvites.Delete;
using FitnessPlatform.Tests.Builders;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Trainers;

/// <summary>
/// Tests for <see cref="DeletePendingInviteEndpoint"/> — the coach "Zrušit" (withdraw) flow.
/// #1100 (R3=yes): withdrawing an invite writes a neutral Withdrawn cooperation event, but
/// only when a conversation already exists (never create one just to announce "withdrawn"),
/// and only when the invite hadn't already been accepted. It also invalidates any unused
/// InvitationToken for the same invite so the invitee's email link can no longer be used to
/// accept after the coach has withdrawn in-app.
/// </summary>
public class DeletePendingInviteEndpointTests
{
    private readonly INotificationService _notificationService = Substitute.For<INotificationService>();
    private readonly IRealtimeNotifier _notifier = Substitute.For<IRealtimeNotifier>();
    private readonly IConversationSeedService _conversationSeedService = Substitute.For<IConversationSeedService>();

    private static ApplicationUser CreateUser(Guid id, string email, string first = "Anna", string last = "Novakova") => new()
    {
        Id = id,
        Email = email,
        NormalizedEmail = email.ToUpperInvariant(),
        FirstName = first,
        LastName = last
    };

    private DeletePendingInviteEndpoint CreateEndpoint(
        Guid callerId,
        Application.Infrastructure.Data.IApplicationDbContext db) =>
        Factory.Create<DeletePendingInviteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(callerId, AppRoles.Trainer))),
            db, _notificationService, _notifier, _conversationSeedService);

    [Fact]
    public async Task Delete_UnacceptedInviteWithExistingThread_WritesWithdrawnEvent()
    {
        var trainerId = Guid.NewGuid();
        var trainerUser = CreateUser(trainerId, "trainer@test.com", "Coach", "Carl");
        var trainerProfile = new ProfessionalProfile { Id = 1, PublicId = Guid.NewGuid(), UserId = trainerId };
        var invitedUser = CreateUser(Guid.NewGuid(), "jane@test.com", "Jane", "Doe");
        var invite = new PendingInvite
        {
            PublicId = Guid.NewGuid(),
            ProfessionalProfileId = trainerProfile.Id,
            Email = "jane@test.com",
            IsAccepted = false
        };

        var db = new MockDbBuilder()
            .With(trainerUser)
            .With(trainerProfile)
            .With(invitedUser)
            .With(invite)
            .Build();

        var ep = CreateEndpoint(trainerId, db);

        await ep.HandleAsync(new DeletePendingInviteRequest { Id = invite.PublicId.ToString() }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);
        db.PendingInvites.Received(1).Remove(invite);
        await _conversationSeedService.Received(1).AppendCooperationEventAsync(
            trainerId, invitedUser.Id, trainerId,
            ChatEventType.Withdrawn, invite.PublicId, null,
            createConversationIfMissing: false, Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// No account exists for the invited email — there is no possible Conversation to key
    /// a Withdrawn event on, so nothing is written.
    /// </summary>
    [Fact]
    public async Task Delete_UnacceptedInviteWithNoAccountForEmail_DoesNotWriteWithdrawnEvent()
    {
        var trainerId = Guid.NewGuid();
        var trainerUser = CreateUser(trainerId, "trainer@test.com", "Coach", "Carl");
        var trainerProfile = new ProfessionalProfile { Id = 1, PublicId = Guid.NewGuid(), UserId = trainerId };
        var invite = new PendingInvite
        {
            PublicId = Guid.NewGuid(),
            ProfessionalProfileId = trainerProfile.Id,
            Email = "nobody@test.com",
            IsAccepted = false
        };

        var db = new MockDbBuilder()
            .With(trainerUser)
            .With(trainerProfile)
            .With(invite)
            .Build();

        var ep = CreateEndpoint(trainerId, db);

        await ep.HandleAsync(new DeletePendingInviteRequest { Id = invite.PublicId.ToString() }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);
        await _conversationSeedService.DidNotReceiveWithAnyArgs().AppendCooperationEventAsync(
            default, default, default, default, default, default, default, TestContext.Current.CancellationToken);
    }

    /// <summary>
    /// An already-accepted invite must never get a Withdrawn event — that thread already
    /// reads "accepted"; withdrawing it afterward would be a stale/incorrect signal.
    /// </summary>
    [Fact]
    public async Task Delete_AlreadyAcceptedInvite_DoesNotWriteWithdrawnEvent()
    {
        var trainerId = Guid.NewGuid();
        var trainerUser = CreateUser(trainerId, "trainer@test.com", "Coach", "Carl");
        var trainerProfile = new ProfessionalProfile { Id = 1, PublicId = Guid.NewGuid(), UserId = trainerId };
        var invitedUser = CreateUser(Guid.NewGuid(), "jane@test.com", "Jane", "Doe");
        var invite = new PendingInvite
        {
            PublicId = Guid.NewGuid(),
            ProfessionalProfileId = trainerProfile.Id,
            Email = "jane@test.com",
            IsAccepted = true
        };

        var db = new MockDbBuilder()
            .With(trainerUser)
            .With(trainerProfile)
            .With(invitedUser)
            .With(invite)
            .Build();

        var ep = CreateEndpoint(trainerId, db);

        await ep.HandleAsync(new DeletePendingInviteRequest { Id = invite.PublicId.ToString() }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);
        await _conversationSeedService.DidNotReceiveWithAnyArgs().AppendCooperationEventAsync(
            default, default, default, default, default, default, default, TestContext.Current.CancellationToken);
    }

    /// <summary>
    /// Withdrawing invalidates any still-unused InvitationToken for the same professional +
    /// email, so the invitee's email link (AcceptInvitationEndpoint) can no longer be used
    /// to accept a withdrawn invite.
    /// </summary>
    [Fact]
    public async Task Delete_UnacceptedInvite_MarksMatchingUnusedTokensAsUsed()
    {
        var trainerId = Guid.NewGuid();
        var trainerUser = CreateUser(trainerId, "trainer@test.com", "Coach", "Carl");
        var trainerProfile = new ProfessionalProfile { Id = 1, PublicId = Guid.NewGuid(), UserId = trainerId };
        var invite = new PendingInvite
        {
            PublicId = Guid.NewGuid(),
            ProfessionalProfileId = trainerProfile.Id,
            Email = "jane@test.com",
            IsAccepted = false
        };
        var matchingToken = new InvitationToken
        {
            ProfessionalProfileId = trainerProfile.Id,
            Email = "jane@test.com",
            Token = "still-valid-token",
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            IsUsed = false
        };

        var db = new MockDbBuilder()
            .With(trainerUser)
            .With(trainerProfile)
            .With(invite)
            .With(matchingToken)
            .Build();

        var ep = CreateEndpoint(trainerId, db);

        await ep.HandleAsync(new DeletePendingInviteRequest { Id = invite.PublicId.ToString() }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);
        matchingToken.IsUsed.Should().BeTrue();
    }

    [Fact]
    public async Task Delete_NotOwnedByCaller_ThrowsError()
    {
        var trainerId = Guid.NewGuid();
        var trainerUser = CreateUser(trainerId, "trainer@test.com", "Coach", "Carl");
        var trainerProfile = new ProfessionalProfile { Id = 1, PublicId = Guid.NewGuid(), UserId = trainerId };
        var otherProfessionalProfile = new ProfessionalProfile { Id = 2, PublicId = Guid.NewGuid(), UserId = Guid.NewGuid() };
        var invite = new PendingInvite
        {
            PublicId = Guid.NewGuid(),
            ProfessionalProfileId = otherProfessionalProfile.Id,
            Email = "jane@test.com",
            IsAccepted = false
        };

        var db = new MockDbBuilder()
            .With(trainerUser)
            .With(trainerProfile)
            .With(otherProfessionalProfile)
            .With(invite)
            .Build();

        var ep = CreateEndpoint(trainerId, db);

        var act = () => ep.HandleAsync(new DeletePendingInviteRequest { Id = invite.PublicId.ToString() }, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<ValidationFailureException>();
        db.PendingInvites.DidNotReceive().Remove(Arg.Any<PendingInvite>());
    }

    [Fact]
    public async Task Delete_UnknownInvite_Returns404()
    {
        var trainerId = Guid.NewGuid();
        var trainerUser = CreateUser(trainerId, "trainer@test.com", "Coach", "Carl");
        var trainerProfile = new ProfessionalProfile { Id = 1, PublicId = Guid.NewGuid(), UserId = trainerId };

        var db = new MockDbBuilder()
            .With(trainerUser)
            .With(trainerProfile)
            .Build();

        var ep = CreateEndpoint(trainerId, db);

        await ep.HandleAsync(new DeletePendingInviteRequest { Id = Guid.NewGuid().ToString() }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }
}
