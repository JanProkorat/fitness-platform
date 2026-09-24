using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Trainers.PendingInvites.Create;
using FitnessPlatform.Tests.Builders;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Trainers;

public class CreatePendingInviteEndpointTests
{
    private readonly Guid _trainerId = Guid.NewGuid();

    private static Claim[] MultiRoleClaims(Guid userId, params string[] roles) =>
    [
        new Claim(AppClaims.UserId, userId.ToString()),
        new Claim(AppClaims.Email, "professional@test.com"),
        .. roles.Select(r => new Claim(ClaimTypes.Role, r))
    ];

    private static CreatePendingInviteEndpoint CreateEndpoint(
        Application.Infrastructure.Data.IApplicationDbContext db,
        Guid callerId,
        params string[] roles) =>
        CreateEndpointWithSeedService(db, callerId, roles).Endpoint;

    private static (CreatePendingInviteEndpoint Endpoint, IConversationSeedService ConversationSeedService) CreateEndpointWithSeedService(
        Application.Infrastructure.Data.IApplicationDbContext db,
        Guid callerId,
        params string[] roles)
    {
        var emailService = Substitute.For<IEmailService>();
        var notificationService = Substitute.For<INotificationService>();
        var notifier = Substitute.For<IRealtimeNotifier>();
        var conversationSeedService = Substitute.For<IConversationSeedService>();
        var logger = Substitute.For<ILogger<CreatePendingInviteEndpoint>>();

        var ep = Factory.Create<CreatePendingInviteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(roles.Length > 1
                    ? MultiRoleClaims(callerId, roles)
                    : EndpointTestHelpers.FakeUserClaims(callerId, roles.FirstOrDefault() ?? AppRoles.Trainer))),
            db, emailService, notificationService, notifier, conversationSeedService, logger);

        return (ep, conversationSeedService);
    }

    [Fact]
    public async Task HandleAsync_ValidRequest_ReturnsResponseWithId()
    {
        var trainerUser = EntityBuilder.User.WithId(_trainerId).WithEmail("trainer@test.com")
            .WithFirstName("Train").WithLastName("Er").Build();
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUser(trainerUser).Build();

        var db = new MockDbBuilder()
            .With(trainerUser)
            .With(trainerProfile)
            .Build();

        // Capture the PendingInvite added to the DbSet so we can compare its Id with the response.
        PendingInvite? captured = null;
        db.PendingInvites.When(x => x.Add(Arg.Any<PendingInvite>()))
            .Do(ci => captured = ci.Arg<PendingInvite>());

        var ep = CreateEndpoint(db, _trainerId, AppRoles.Trainer);

        await ep.HandleAsync(new CreatePendingInviteRequest
        {
            Email = "jane@test.com"
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        captured.Should().NotBeNull();
        // In unit tests the mock DB does not auto-assign the PK, so the captured object's Id
        // matches what the response returns (both will be 0 here). The important contract is
        // that the response field is wired to pendingInvite.Id.
        ep.Response.Id.Should().Be(captured!.Id);
        ep.Response.PublicId.Should().Be(captured.PublicId);
        ep.Response.Email.Should().Be("jane@test.com");
    }

    /// <summary>
    /// The behaviour this issue exists to enable: an invite with an email and no message at all
    /// still succeeds now that FirstName/LastName are no longer part of the request shape.
    /// </summary>
    [Fact]
    public async Task HandleAsync_EmailOnlyNoMessage_Returns200()
    {
        var trainerUser = EntityBuilder.User.WithId(_trainerId).WithEmail("trainer@test.com")
            .WithFirstName("Train").WithLastName("Er").Build();
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUser(trainerUser).Build();

        var db = new MockDbBuilder()
            .With(trainerUser)
            .With(trainerProfile)
            .Build();

        PendingInvite? captured = null;
        db.PendingInvites.When(x => x.Add(Arg.Any<PendingInvite>()))
            .Do(ci => captured = ci.Arg<PendingInvite>());

        var ep = CreateEndpoint(db, _trainerId, AppRoles.Trainer);

        await ep.HandleAsync(new CreatePendingInviteRequest
        {
            Email = "email-only@test.com"
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        captured.Should().NotBeNull();
        captured!.Email.Should().Be("email-only@test.com");
        captured.Message.Should().BeNull();
    }

    /// <summary>
    /// MAINTAINER RULING 2026-09-23 (F8 reversed): for a VERIFIED existing CLIENT account,
    /// the endpoint now immediately seeds the professional-client conversation with an
    /// Invited cooperation event (plus the invite's message beneath it) — superseding the
    /// #768/F8 regression contract this test used to assert (that nothing was seeded at
    /// creation time). The accepted risk is documented at the call site; see the
    /// maintainer-ruling comment in CreatePendingInviteEndpoint.HandleAsync.
    /// </summary>
    [Fact]
    public async Task HandleAsync_ExistingVerifiedUserWithMessage_SeedsInvitedEventImmediately()
    {
        var trainerUser = EntityBuilder.User.WithId(_trainerId).WithEmail("trainer@test.com")
            .WithFirstName("Train").WithLastName("Er").Build();
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUser(trainerUser).Build();
        var existingUser = EntityBuilder.User.WithId(Guid.NewGuid()).WithEmail("jane@test.com")
            .WithFirstName("Jane").WithLastName("Doe").Build();
        existingUser.EmailConfirmed = true;
        existingUser.NormalizedEmail = "JANE@TEST.COM";
        var existingClientProfile = EntityBuilder.ClientProfile.WithId(1).WithUser(existingUser).Build();

        var db = new MockDbBuilder()
            .With(trainerUser)
            .With(trainerProfile)
            .With(existingUser)
            .With(existingClientProfile)
            .Build();

        PendingInvite? captured = null;
        db.PendingInvites.When(x => x.Add(Arg.Any<PendingInvite>()))
            .Do(ci => captured = ci.Arg<PendingInvite>());

        var (ep, conversationSeedService) = CreateEndpointWithSeedService(db, _trainerId, AppRoles.Trainer);

        await ep.HandleAsync(new CreatePendingInviteRequest
        {
            Email = "jane@test.com",
            Message = "Looking forward to coaching you!"
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        captured.Should().NotBeNull();
        captured!.Message.Should().Be("Looking forward to coaching you!");

        await conversationSeedService.Received(1).AppendCooperationEventAsync(
            trainerProfile.UserId, existingUser.Id, trainerProfile.UserId,
            ChatEventType.Invited, captured.PublicId, "Looking forward to coaching you!",
            createConversationIfMissing: true, TestContext.Current.CancellationToken);
    }

    /// <summary>
    /// R4: invite threads exist only for VERIFIED accounts. An existing but unverified
    /// account gets no thread at invite-creation time — VerifyEmailEndpoint seeds the
    /// identical rows once the account is verified.
    /// </summary>
    [Fact]
    public async Task HandleAsync_ExistingUnverifiedUser_DoesNotSeedConversationImmediately()
    {
        var trainerUser = EntityBuilder.User.WithId(_trainerId).WithEmail("trainer@test.com")
            .WithFirstName("Train").WithLastName("Er").Build();
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUser(trainerUser).Build();
        var existingUser = EntityBuilder.User.WithId(Guid.NewGuid()).WithEmail("jane@test.com")
            .WithFirstName("Jane").WithLastName("Doe").Build();
        existingUser.EmailConfirmed = false;

        var db = new MockDbBuilder()
            .With(trainerUser)
            .With(trainerProfile)
            .With(existingUser)
            .Build();

        var (ep, conversationSeedService) = CreateEndpointWithSeedService(db, _trainerId, AppRoles.Trainer);

        await ep.HandleAsync(new CreatePendingInviteRequest
        {
            Email = "jane@test.com",
            Message = "Looking forward to coaching you!"
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        await conversationSeedService.DidNotReceiveWithAnyArgs().AppendCooperationEventAsync(
            default, default, default, default, default, default, default, TestContext.Current.CancellationToken);
    }

    /// <summary>
    /// No account at all for the invited email — same no-thread outcome as an unverified
    /// account, for the same reason (nothing exists yet to key a Conversation on).
    /// </summary>
    [Fact]
    public async Task HandleAsync_NoAccountForEmail_DoesNotSeedConversation()
    {
        var trainerUser = EntityBuilder.User.WithId(_trainerId).WithEmail("trainer@test.com")
            .WithFirstName("Train").WithLastName("Er").Build();
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUser(trainerUser).Build();

        var db = new MockDbBuilder()
            .With(trainerUser)
            .With(trainerProfile)
            .Build();

        var (ep, conversationSeedService) = CreateEndpointWithSeedService(db, _trainerId, AppRoles.Trainer);

        await ep.HandleAsync(new CreatePendingInviteRequest
        {
            Email = "nobody-yet@test.com",
            Message = "Looking forward to coaching you!"
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        await conversationSeedService.DidNotReceiveWithAnyArgs().AppendCooperationEventAsync(
            default, default, default, default, default, default, default, TestContext.Current.CancellationToken);
    }

    /// <summary>
    /// #1108 review — the R4 gate must key on the invitee being a CLIENT, not merely
    /// verified: a verified peer professional's own email must get no thread, matching
    /// VerifyEmailEndpoint's ClientProfile-only seed.
    /// </summary>
    [Fact]
    public async Task HandleAsync_VerifiedProfessionalOnlyInvitee_DoesNotSeedConversation()
    {
        var trainerUser = EntityBuilder.User.WithId(_trainerId).WithEmail("trainer@test.com")
            .WithFirstName("Train").WithLastName("Er").Build();
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUser(trainerUser).Build();
        var peerProfessionalUser = EntityBuilder.User.WithId(Guid.NewGuid()).WithEmail("peer@test.com")
            .WithFirstName("Peer").WithLastName("Pro").Build();
        peerProfessionalUser.EmailConfirmed = true;
        peerProfessionalUser.NormalizedEmail = "PEER@TEST.COM";
        var peerProfile = EntityBuilder.ProfessionalProfile.WithId(2).WithUser(peerProfessionalUser).Build();

        var db = new MockDbBuilder()
            .With(trainerUser)
            .With(trainerProfile)
            .With(peerProfessionalUser)
            .With(peerProfile)
            .Build();

        var (ep, conversationSeedService) = CreateEndpointWithSeedService(db, _trainerId, AppRoles.Trainer);

        await ep.HandleAsync(new CreatePendingInviteRequest
        {
            Email = "peer@test.com",
            Message = "Looking forward to coaching you!"
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        await conversationSeedService.DidNotReceiveWithAnyArgs().AppendCooperationEventAsync(
            default, default, default, default, default, default, default, TestContext.Current.CancellationToken);
    }

    /// <summary>
    /// #1108 review — a self-invite (the caller's own email, verified, and holding a
    /// ClientProfile so the client-only gate above alone would have let it through) must
    /// still get no thread. No other guard in this endpoint rejects a self-invite outright
    /// (the invite/token/email are still created) — this is the only place that stops it
    /// from writing into the caller's own message stream.
    /// </summary>
    [Fact]
    public async Task HandleAsync_SelfInvite_VerifiedAndHoldsClientProfile_DoesNotSeedConversation()
    {
        var trainerUser = EntityBuilder.User.WithId(_trainerId).WithEmail("trainer@test.com")
            .WithFirstName("Train").WithLastName("Er").Build();
        trainerUser.EmailConfirmed = true;
        trainerUser.NormalizedEmail = "TRAINER@TEST.COM";
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUser(trainerUser).Build();
        // Dual-role account (holds both a ProfessionalProfile and a ClientProfile) so the
        // client-only gate alone would have let this through — isolates the self-check.
        var trainerClientProfile = EntityBuilder.ClientProfile.WithId(1).WithUser(trainerUser).Build();

        var db = new MockDbBuilder()
            .With(trainerUser)
            .With(trainerProfile)
            .With(trainerClientProfile)
            .Build();

        var (ep, conversationSeedService) = CreateEndpointWithSeedService(db, _trainerId, AppRoles.Trainer);

        await ep.HandleAsync(new CreatePendingInviteRequest
        {
            Email = "trainer@test.com",
            Message = "Looking forward to coaching you!"
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        await conversationSeedService.DidNotReceiveWithAnyArgs().AppendCooperationEventAsync(
            default, default, default, default, default, default, default, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task HandleAsync_NoProfessionalProfile_ThrowsError()
    {
        var db = new MockDbBuilder().Build();
        var ep = CreateEndpoint(db, _trainerId, AppRoles.Trainer);

        var act = () => ep.HandleAsync(new CreatePendingInviteRequest
        {
            Email = "jane@test.com"
        }, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<ValidationFailureException>();
    }

    /// <summary>
    /// Dual-role professional explicitly narrows the invitation to training only — the
    /// requested scope must be stamped on both the PendingInvite and the InvitationToken
    /// so either accept path (token-based or in-app) honors the identical choice.
    /// </summary>
    [Fact]
    public async Task HandleAsync_DualRoleProfessional_ExplicitTrainingOnlyScope_StampsScopeOnBothRecords()
    {
        var trainerUser = EntityBuilder.User.WithId(_trainerId).WithEmail("trainer@test.com")
            .WithFirstName("Train").WithLastName("Er").Build();
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUser(trainerUser).Build();

        var db = new MockDbBuilder()
            .With(trainerUser)
            .With(trainerProfile)
            .Build();

        PendingInvite? capturedInvite = null;
        db.PendingInvites.When(x => x.Add(Arg.Any<PendingInvite>()))
            .Do(ci => capturedInvite = ci.Arg<PendingInvite>());

        InvitationToken? capturedToken = null;
        db.InvitationTokens.When(x => x.Add(Arg.Any<InvitationToken>()))
            .Do(ci => capturedToken = ci.Arg<InvitationToken>());

        var ep = CreateEndpoint(db, _trainerId, AppRoles.Trainer, AppRoles.Nutritionist);

        await ep.HandleAsync(new CreatePendingInviteRequest
        {
            Email = "jane@test.com",
            RequestedScope = LinkCapabilityScope.TrainingOnly
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        capturedInvite.Should().NotBeNull();
        capturedInvite!.RequestedScope.Should().Be(LinkCapabilityScope.TrainingOnly);
        capturedToken.Should().NotBeNull();
        capturedToken!.RequestedScope.Should().Be(LinkCapabilityScope.TrainingOnly);
    }

    /// <summary>
    /// Security invariant (#917): a Trainer-only professional cannot create a pending
    /// invite requesting NutritionOnly scope — the requested scope must be validated
    /// as a subset of the caller's actually-held roles. Deleting the subset check
    /// makes this test fail (proven and reverted — see PR description).
    /// </summary>
    [Fact]
    public async Task HandleAsync_TrainerOnlyProfessional_RequestsNutritionOnlyScope_Returns400WithErrorCode()
    {
        var trainerUser = EntityBuilder.User.WithId(_trainerId).WithEmail("trainer@test.com")
            .WithFirstName("Train").WithLastName("Er").Build();
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUser(trainerUser).Build();

        var db = new MockDbBuilder()
            .With(trainerUser)
            .With(trainerProfile)
            .Build();

        var ep = CreateEndpoint(db, _trainerId, AppRoles.Trainer);

        var act = () => ep.HandleAsync(new CreatePendingInviteRequest
        {
            Email = "jane@test.com",
            RequestedScope = LinkCapabilityScope.NutritionOnly
        }, TestContext.Current.CancellationToken);

        var exception = await act.Should().ThrowAsync<ValidationFailureException>();
        exception.Which.Failures.Should().ContainSingle(
            f => f.ErrorCode == ErrorCodes.RequestedScopeExceedsHeldRoles);
        db.PendingInvites.DidNotReceive().Add(Arg.Any<PendingInvite>());
    }

    // ── claude-security F8: duplicate + outstanding-cap guards ──────────────────

    /// <summary>
    /// Repeatedly re-inviting the same target is the abuse shape the duplicate guard closes —
    /// a legitimate professional who wants to resend must delete the existing invite first.
    /// </summary>
    [Fact]
    public async Task HandleAsync_DuplicateUnacceptedInviteSameEmail_Returns409()
    {
        var trainerUser = EntityBuilder.User.WithId(_trainerId).WithEmail("trainer@test.com")
            .WithFirstName("Train").WithLastName("Er").Build();
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUser(trainerUser).Build();

        var existingInvite = new PendingInvite
        {
            ProfessionalProfileId = trainerProfile.Id,
            Email = "jane@test.com",
            SentAt = DateTime.UtcNow.AddDays(-1),
            IsAccepted = false
        };

        var db = new MockDbBuilder()
            .With(trainerUser)
            .With(trainerProfile)
            .With(existingInvite)
            .Build();

        PendingInvite? captured = null;
        db.PendingInvites.When(x => x.Add(Arg.Any<PendingInvite>()))
            .Do(ci => captured = ci.Arg<PendingInvite>());

        var ep = CreateEndpoint(db, _trainerId, AppRoles.Trainer);

        await ep.HandleAsync(new CreatePendingInviteRequest
        {
            Email = "jane@test.com"
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(409);
        captured.Should().BeNull("no second invite row must be created for a duplicate target");
    }

    /// <summary>
    /// Positive control for the duplicate guard above: a DIFFERENT email for the same
    /// professional is unaffected — proves the guard discriminates by email, not by professional.
    /// </summary>
    [Fact]
    public async Task HandleAsync_ExistingInviteForDifferentEmail_StillSucceeds()
    {
        var trainerUser = EntityBuilder.User.WithId(_trainerId).WithEmail("trainer@test.com")
            .WithFirstName("Train").WithLastName("Er").Build();
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUser(trainerUser).Build();

        var existingInvite = new PendingInvite
        {
            ProfessionalProfileId = trainerProfile.Id,
            Email = "someone-else@test.com",
            SentAt = DateTime.UtcNow.AddDays(-1),
            IsAccepted = false
        };

        var db = new MockDbBuilder()
            .With(trainerUser)
            .With(trainerProfile)
            .With(existingInvite)
            .Build();

        var ep = CreateEndpoint(db, _trainerId, AppRoles.Trainer);

        await ep.HandleAsync(new CreatePendingInviteRequest
        {
            Email = "jane@test.com"
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }

    /// <summary>
    /// Positive control, part 2: an ALREADY-ACCEPTED prior invite for the same email does not
    /// block a new invite — only outstanding (unaccepted) invites count as duplicates.
    /// </summary>
    [Fact]
    public async Task HandleAsync_PriorInviteForSameEmailAlreadyAccepted_StillSucceeds()
    {
        var trainerUser = EntityBuilder.User.WithId(_trainerId).WithEmail("trainer@test.com")
            .WithFirstName("Train").WithLastName("Er").Build();
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUser(trainerUser).Build();

        var acceptedInvite = new PendingInvite
        {
            ProfessionalProfileId = trainerProfile.Id,
            Email = "jane@test.com",
            SentAt = DateTime.UtcNow.AddDays(-30),
            IsAccepted = true
        };

        var db = new MockDbBuilder()
            .With(trainerUser)
            .With(trainerProfile)
            .With(acceptedInvite)
            .Build();

        var ep = CreateEndpoint(db, _trainerId, AppRoles.Trainer);

        await ep.HandleAsync(new CreatePendingInviteRequest
        {
            Email = "jane@test.com"
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }

    /// <summary>
    /// The outstanding-invite cap bounds the standing fan-out an abusive account can build up
    /// even when paced below the rate-limit window.
    /// </summary>
    [Fact]
    public async Task HandleAsync_AtOutstandingInviteCap_Returns429()
    {
        var trainerUser = EntityBuilder.User.WithId(_trainerId).WithEmail("trainer@test.com")
            .WithFirstName("Train").WithLastName("Er").Build();
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUser(trainerUser).Build();

        var builder = new MockDbBuilder()
            .With(trainerUser)
            .With(trainerProfile);
        foreach (var i in Enumerable.Range(0, 200))
        {
            builder = builder.With(new PendingInvite
            {
                ProfessionalProfileId = trainerProfile.Id,
                Email = $"existing{i}@test.com",
                SentAt = DateTime.UtcNow.AddDays(-1),
                IsAccepted = false
            });
        }

        var db = builder.Build();

        PendingInvite? captured = null;
        db.PendingInvites.When(x => x.Add(Arg.Any<PendingInvite>()))
            .Do(ci => captured = ci.Arg<PendingInvite>());

        var ep = CreateEndpoint(db, _trainerId, AppRoles.Trainer);

        await ep.HandleAsync(new CreatePendingInviteRequest
        {
            Email = "one-too-many@test.com"
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(429);
        captured.Should().BeNull("no invite must be created once the cap is reached");
    }

    /// <summary>
    /// Positive control for the cap above: comfortably under the cap still succeeds — proves the
    /// guard discriminates on count rather than always denying.
    /// </summary>
    [Fact]
    public async Task HandleAsync_WellUnderOutstandingInviteCap_StillSucceeds()
    {
        var trainerUser = EntityBuilder.User.WithId(_trainerId).WithEmail("trainer@test.com")
            .WithFirstName("Train").WithLastName("Er").Build();
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUser(trainerUser).Build();

        var builder = new MockDbBuilder()
            .With(trainerUser)
            .With(trainerProfile);
        foreach (var i in Enumerable.Range(0, 5))
        {
            builder = builder.With(new PendingInvite
            {
                ProfessionalProfileId = trainerProfile.Id,
                Email = $"existing{i}@test.com",
                SentAt = DateTime.UtcNow.AddDays(-1),
                IsAccepted = false
            });
        }

        var db = builder.Build();

        var ep = CreateEndpoint(db, _trainerId, AppRoles.Trainer);

        await ep.HandleAsync(new CreatePendingInviteRequest
        {
            Email = "jane@test.com"
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }
}
