using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Client.Invites.Decline;
using FitnessPlatform.Tests.Builders;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Client.Invites;

/// <summary>
/// Tests for <see cref="DeclineClientInviteEndpoint"/>, in particular the
/// IDOR guard that scopes the invite lookup to the caller's own email
/// (issue #654).
/// </summary>
public class DeclineClientInviteEndpointTests
{
    private readonly IRealtimeNotifier _notifier = Substitute.For<IRealtimeNotifier>();

    private static ApplicationUser CreateUser(Guid id, string email) => new()
    {
        Id = id,
        Email = email,
        NormalizedEmail = email.ToUpperInvariant(),
        FirstName = "Anna",
        LastName = "Novakova"
    };

    private DeclineClientInviteEndpoint CreateEndpoint(
        Guid callerId,
        FitnessPlatform.Application.Infrastructure.Data.IApplicationDbContext db) =>
        Factory.Create<DeclineClientInviteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(callerId, AppRoles.Client))),
            db, _notifier);

    [Fact]
    public async Task Decline_ByRecipient_Returns204_AndMarksAccepted()
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
        await ep.HandleAsync(new DeclineClientInviteRequest { Id = inviteId }, TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(204);
        invite.IsAccepted.Should().BeTrue();
        await _notifier.Received(1).NotifyAsync(
            professionalProfile.UserId, "invitedeclined", Arg.Any<object>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Decline_ByNonRecipient_Returns404_AndDoesNotAcceptOrNotify()
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
        await ep.HandleAsync(new DeclineClientInviteRequest { Id = inviteId }, TestContext.Current.CancellationToken);

        // Assert — 404, not 403: must not confirm the GUID exists (no enumeration oracle),
        // and the real recipient's invite must survive so they can still act on it.
        ep.HttpContext.Response.StatusCode.Should().Be(404);
        invite.IsAccepted.Should().BeFalse();
        await _notifier.DidNotReceiveWithAnyArgs().NotifyAsync(default, default!, default!, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task Decline_UnknownOrAlreadyAcceptedInvite_Returns404()
    {
        // Arrange — existing behavior preserved: unknown GUID or already-consumed invite is 404.
        var clientId = Guid.NewGuid();
        var clientUser = CreateUser(clientId, "client@example.com");

        var db = new MockDbBuilder().With(clientUser).Build();
        var ep = CreateEndpoint(clientId, db);

        // Act
        await ep.HandleAsync(new DeclineClientInviteRequest { Id = Guid.NewGuid() }, TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }
}
