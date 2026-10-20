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
            Status = PendingInviteStatus.Pending
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
        invite.Status.Should().Be(PendingInviteStatus.Cancelled);
        db.PendingInvites.DidNotReceive().Remove(Arg.Any<PendingInvite>());
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
            Status = PendingInviteStatus.Pending
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
    /// An already-answered invite cannot be cancelled: the call is refused with 409, the status
    /// is left untouched, and no Withdrawn event is written.
    /// </summary>
    [Theory]
    [InlineData(PendingInviteStatus.Accepted)]
    [InlineData(PendingInviteStatus.Declined)]
    [InlineData(PendingInviteStatus.Cancelled)]
    public async Task Delete_NonPendingInvite_Returns409_AndKeepsStatus(PendingInviteStatus status)
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
            Status = status
        };

        var db = new MockDbBuilder()
            .With(trainerUser)
            .With(trainerProfile)
            .With(invitedUser)
            .With(invite)
            .Build();

        var ep = CreateEndpoint(trainerId, db);

        await ep.HandleAsync(new DeletePendingInviteRequest { Id = invite.PublicId.ToString() }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(409);
        invite.Status.Should().Be(status);
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
            Status = PendingInviteStatus.Pending
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

    /// <summary>
    /// An invite past its validity window is still stored as Pending, so the coach can still
    /// cancel it to tidy up: 204 and Cancelled.
    /// </summary>
    [Fact]
    public async Task Delete_ExpiredPendingInvite_IsStillCancelled()
    {
        var trainerId = Guid.NewGuid();
        var trainerUser = CreateUser(trainerId, "trainer@test.com", "Coach", "Carl");
        var trainerProfile = new ProfessionalProfile { Id = 1, PublicId = Guid.NewGuid(), UserId = trainerId };
        var invite = new PendingInvite
        {
            PublicId = Guid.NewGuid(),
            ProfessionalProfileId = trainerProfile.Id,
            Email = "jane@test.com",
            SentAt = DateTime.UtcNow.AddDays(-8),
            Status = PendingInviteStatus.Pending
        };

        var db = new MockDbBuilder().With(trainerUser).With(trainerProfile).With(invite).Build();
        var ep = CreateEndpoint(trainerId, db);

        await ep.HandleAsync(new DeletePendingInviteRequest { Id = invite.PublicId.ToString() }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);
        invite.Status.Should().Be(PendingInviteStatus.Cancelled);
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
            Status = PendingInviteStatus.Pending
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
