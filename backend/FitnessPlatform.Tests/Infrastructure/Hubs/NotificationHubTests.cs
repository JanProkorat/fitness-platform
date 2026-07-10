using System.Security.Claims;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Infrastructure.Hubs;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Endpoints;
using FluentAssertions;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;

namespace FitnessPlatform.Tests.Infrastructure.Hubs;

/// <summary>
/// Tests for <see cref="NotificationHub.SendTyping"/>, in particular the
/// <c>Guid.TryParse</c> guard added for #663 — a malformed
/// <c>conversationId</c> must fail soft (matching the hub's existing style,
/// which already returns early on a null/unresolved userId) instead of
/// letting <c>Guid.Parse</c> throw a <see cref="FormatException"/>.
/// </summary>
public class NotificationHubTests
{
    private static NotificationHub CreateHub(Guid userId, IServiceScopeFactory scopeFactory)
    {
        var hub = new NotificationHub(new PresenceTracker(), scopeFactory);

        var context = Substitute.For<HubCallerContext>();
        context.User.Returns(new ClaimsPrincipal(
            new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(userId, AppRoles.Client))));

        hub.Context = context;
        hub.Clients = Substitute.For<IHubCallerClients>();
        hub.Groups = Substitute.For<IGroupManager>();

        return hub;
    }

    [Fact]
    public async Task SendTyping_MalformedConversationId_ReturnsWithoutThrowing_AndNeverOpensDbScope()
    {
        // Arrange
        var scopeFactory = Substitute.For<IServiceScopeFactory>();
        var hub = CreateHub(Guid.NewGuid(), scopeFactory);

        // Act
        var act = () => hub.SendTyping("not-a-guid");

        // Assert — no FormatException, and the malformed id short-circuits before
        // a DB scope is ever created (the old code parsed conversationId inline
        // inside the EF query, one line after the scope was opened).
        await act.Should().NotThrowAsync();
        scopeFactory.DidNotReceive().CreateScope();
    }

    [Fact]
    public async Task SendTyping_NullUserId_ReturnsWithoutThrowing_AndNeverOpensDbScope()
    {
        // Arrange — no UserId claim on the caller's ClaimsPrincipal.
        var scopeFactory = Substitute.For<IServiceScopeFactory>();
        var hub = new NotificationHub(new PresenceTracker(), scopeFactory)
        {
            Context = Substitute.For<HubCallerContext>(),
            Clients = Substitute.For<IHubCallerClients>(),
            Groups = Substitute.For<IGroupManager>()
        };
        hub.Context.User.Returns(new ClaimsPrincipal(new ClaimsIdentity()));

        // Act
        var act = () => hub.SendTyping(Guid.NewGuid().ToString());

        // Assert
        await act.Should().NotThrowAsync();
        scopeFactory.DidNotReceive().CreateScope();
    }
}
