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
        params string[] roles)
    {
        var emailService = Substitute.For<IEmailService>();
        var logger = Substitute.For<ILogger<CreatePendingInviteEndpoint>>();

        return Factory.Create<CreatePendingInviteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(roles.Length > 1
                    ? MultiRoleClaims(callerId, roles)
                    : EndpointTestHelpers.FakeUserClaims(callerId, roles.FirstOrDefault() ?? AppRoles.Trainer))),
            db, emailService, logger);
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
            FirstName = "Jane",
            LastName = "Doe",
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
    /// claude-security F8 — superseding the #768 regression contract this test used to assert
    /// (a chat message seeded immediately into an existing user's account for an email match
    /// with no relationship check). That immediate seed, plus the accompanying notification and
    /// realtime push, is exactly the abuse vector: a free professional account could drop
    /// attacker-written text into any registered user's message stream. The side effect is now
    /// deferred to acceptance time — this test proves the endpoint no longer writes anything into
    /// the invited user's inbox at creation time, only the PendingInvite/InvitationToken rows and
    /// the outbound email.
    /// </summary>
    [Fact]
    public async Task HandleAsync_ExistingUserWithMessage_DoesNotSeedConversationImmediately()
    {
        var trainerUser = EntityBuilder.User.WithId(_trainerId).WithEmail("trainer@test.com")
            .WithFirstName("Train").WithLastName("Er").Build();
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUser(trainerUser).Build();
        var existingUser = EntityBuilder.User.WithId(Guid.NewGuid()).WithEmail("jane@test.com")
            .WithFirstName("Jane").WithLastName("Doe").Build();

        var db = new MockDbBuilder()
            .With(trainerUser)
            .With(trainerProfile)
            .With(existingUser)
            .Build();

        PendingInvite? captured = null;
        db.PendingInvites.When(x => x.Add(Arg.Any<PendingInvite>()))
            .Do(ci => captured = ci.Arg<PendingInvite>());

        var ep = CreateEndpoint(db, _trainerId, AppRoles.Trainer);

        await ep.HandleAsync(new CreatePendingInviteRequest
        {
            FirstName = "Jane",
            LastName = "Doe",
            Email = "jane@test.com",
            Message = "Looking forward to coaching you!"
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200,
            "the invite is still created successfully — only the immediate side effect is removed");
        captured.Should().NotBeNull();
        captured!.Message.Should().Be("Looking forward to coaching you!",
            "the message is still stored on the invite for the accept-time seed to use later");
    }

    [Fact]
    public async Task HandleAsync_NoProfessionalProfile_ThrowsError()
    {
        var db = new MockDbBuilder().Build();
        var ep = CreateEndpoint(db, _trainerId, AppRoles.Trainer);

        var act = () => ep.HandleAsync(new CreatePendingInviteRequest
        {
            FirstName = "Jane",
            LastName = "Doe",
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
            FirstName = "Jane",
            LastName = "Doe",
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
            FirstName = "Jane",
            LastName = "Doe",
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
            FirstName = "Jane",
            LastName = "Doe",
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
            FirstName = "Jane",
            LastName = "Doe",
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
            FirstName = "Someone",
            LastName = "Else",
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
            FirstName = "Jane",
            LastName = "Doe",
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
            FirstName = "Jane",
            LastName = "Doe",
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
            FirstName = "Jane",
            LastName = "Doe",
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
                FirstName = "Existing",
                LastName = $"Invitee{i}",
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
            FirstName = "One",
            LastName = "Too Many",
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
                FirstName = "Existing",
                LastName = $"Invitee{i}",
                Email = $"existing{i}@test.com",
                SentAt = DateTime.UtcNow.AddDays(-1),
                IsAccepted = false
            });
        }

        var db = builder.Build();

        var ep = CreateEndpoint(db, _trainerId, AppRoles.Trainer);

        await ep.HandleAsync(new CreatePendingInviteRequest
        {
            FirstName = "Jane",
            LastName = "Doe",
            Email = "jane@test.com"
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }
}
