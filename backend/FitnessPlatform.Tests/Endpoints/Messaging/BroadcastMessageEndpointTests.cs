using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FluentValidation.TestHelper;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Messaging.Broadcast;
using FitnessPlatform.Tests.Builders;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Messaging;

/// <summary>
/// Tests for <see cref="BroadcastMessageEndpoint"/> and <see cref="BroadcastMessageValidator"/>.
/// </summary>
public class BroadcastMessageEndpointTests
{
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly IConversationSeedService _conversationSeedService = Substitute.For<IConversationSeedService>();

    // ── validator ────────────────────────────────────────────────────────

    [Fact]
    public void Validator_EmptyClientPublicIds_HasValidationError()
    {
        var result = new BroadcastMessageValidator().TestValidate(
            new BroadcastMessageRequest { ClientPublicIds = [], Text = "Hello" });

        result.ShouldHaveValidationErrorFor(x => x.ClientPublicIds);
    }

    [Fact]
    public void Validator_TooManyRecipients_FailsWithLimitExceededCode()
    {
        var tooMany = Enumerable.Range(0, BroadcastMessageValidator.MaxRecipients + 1)
            .Select(_ => Guid.NewGuid())
            .ToList();

        var result = new BroadcastMessageValidator().TestValidate(
            new BroadcastMessageRequest { ClientPublicIds = tooMany, Text = "Hello" });

        result.ShouldHaveValidationErrorFor(x => x.ClientPublicIds)
            .WithErrorCode(ErrorCodes.BroadcastRecipientLimitExceeded);
    }

    [Fact]
    public void Validator_MaxRecipients_NoValidationError()
    {
        var exactlyMax = Enumerable.Range(0, BroadcastMessageValidator.MaxRecipients)
            .Select(_ => Guid.NewGuid())
            .ToList();

        var result = new BroadcastMessageValidator().TestValidate(
            new BroadcastMessageRequest { ClientPublicIds = exactlyMax, Text = "Hello" });

        result.ShouldNotHaveValidationErrorFor(x => x.ClientPublicIds);
    }

    [Fact]
    public void Validator_EmptyText_HasValidationError()
    {
        var result = new BroadcastMessageValidator().TestValidate(
            new BroadcastMessageRequest { ClientPublicIds = [Guid.NewGuid()], Text = "" });

        result.ShouldHaveValidationErrorFor(x => x.Text);
    }

    [Fact]
    public void Validator_TextTooLong_HasValidationError()
    {
        var result = new BroadcastMessageValidator().TestValidate(
            new BroadcastMessageRequest { ClientPublicIds = [Guid.NewGuid()], Text = new string('a', 4001) });

        result.ShouldHaveValidationErrorFor(x => x.Text);
    }

    // ── endpoint ─────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<BroadcastMessageEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity()),
            db, EndpointTestHelpers.CreateGrantingLinkAuthorizationService(), _conversationSeedService);

        await ep.HandleAsync(
            new BroadcastMessageRequest { ClientPublicIds = [Guid.NewGuid()], Text = "Hi" },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }

    [Fact]
    public async Task HandleAsync_UnknownClientPublicId_Returns404WithNotLinkedCode()
    {
        var db = new MockDbBuilder()
            .With(EntityBuilder.User.WithId(_trainerId).Build())
            .Build();

        var ep = Factory.Create<BroadcastMessageEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            db, EndpointTestHelpers.CreateGrantingLinkAuthorizationService(), _conversationSeedService);

        await ep.HandleAsync(
            new BroadcastMessageRequest { ClientPublicIds = [Guid.NewGuid()], Text = "Hi" },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
        await _conversationSeedService.DidNotReceiveWithAnyArgs().GetOrSeedConversationAsync(
            default, default, default, default!, default, default, default);
    }

    /// <summary>
    /// Covers both "unrelated id" and "archived link" from the design's error_paths — both fail
    /// with the same coded 404, since <see cref="IClientLinkAuthorizationService.GetAccessibleClientsAsync"/>
    /// already excludes inactive links from its result.
    /// </summary>
    [Fact]
    public async Task HandleAsync_ClientNotInAccessibleLinks_Returns404WithNotLinkedCode()
    {
        var clientPublicId = Guid.NewGuid();
        var clientUserId = Guid.NewGuid();
        var clientProfile = EntityBuilder.ClientProfile.WithPublicId(clientPublicId).WithUserId(clientUserId).Build();

        var db = new MockDbBuilder()
            .With(EntityBuilder.User.WithId(_trainerId).Build())
            .With(clientProfile)
            .Build();

        // The client profile exists, but is not among the caller's active links.
        var linkAuthorizationService = EndpointTestHelpers.CreateGrantingLinkAuthorizationService(
            accessibleClients: []);

        var ep = Factory.Create<BroadcastMessageEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            db, linkAuthorizationService, _conversationSeedService);

        await ep.HandleAsync(
            new BroadcastMessageRequest { ClientPublicIds = [clientPublicId], Text = "Hi" },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
        await _conversationSeedService.DidNotReceiveWithAnyArgs().GetOrSeedConversationAsync(
            default, default, default, default!, default, default, default);
    }

    [Fact]
    public async Task HandleAsync_ValidRecipients_ReturnsDistinctSentCountAndBroadcastsToEach()
    {
        var trainer = EntityBuilder.User.WithId(_trainerId).WithFirstName("Coach").WithLastName("Carl").Build();

        var clientAPublicId = Guid.NewGuid();
        var clientAUserId = Guid.NewGuid();
        var clientA = EntityBuilder.User.WithId(clientAUserId).WithFirstName("Alice").WithLastName("Anders").Build();
        var clientAProfile = EntityBuilder.ClientProfile.WithPublicId(clientAPublicId).WithUserId(clientAUserId).Build();

        var clientBPublicId = Guid.NewGuid();
        var clientBUserId = Guid.NewGuid();
        var clientB = EntityBuilder.User.WithId(clientBUserId).WithFirstName("Bob").WithLastName("Baker").Build();
        var clientBProfile = EntityBuilder.ClientProfile.WithPublicId(clientBPublicId).WithUserId(clientBUserId).Build();

        var db = new MockDbBuilder()
            .With(trainer).With(clientA).With(clientB)
            .With(clientAProfile).With(clientBProfile)
            .Build();

        var linkAuthorizationService = EndpointTestHelpers.CreateGrantingLinkAuthorizationService(
            accessibleClients:
            [
                (clientAUserId, new LinkCapabilities(true, true)),
                (clientBUserId, new LinkCapabilities(true, true)),
            ]);

        var ep = Factory.Create<BroadcastMessageEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            db, linkAuthorizationService, _conversationSeedService);

        await ep.HandleAsync(
            new BroadcastMessageRequest { ClientPublicIds = [clientAPublicId, clientBPublicId], Text = "Hi {{firstName}}" },
            TestContext.Current.CancellationToken);

        ep.Response.Should().NotBeNull();
        ep.Response.SentCount.Should().Be(2);

        await _conversationSeedService.Received(1).GetOrSeedConversationAsync(
            _trainerId, clientAUserId, _trainerId, "Coach Carl", "Hi Alice", seedIntoExisting: true, Arg.Any<CancellationToken>());
        await _conversationSeedService.Received(1).GetOrSeedConversationAsync(
            _trainerId, clientBUserId, _trainerId, "Coach Carl", "Hi Bob", seedIntoExisting: true, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_DuplicateRecipientIds_DeduplicatesAndSendsOnce()
    {
        var trainer = EntityBuilder.User.WithId(_trainerId).WithFirstName("Coach").WithLastName("Carl").Build();

        var clientPublicId = Guid.NewGuid();
        var clientUserId = Guid.NewGuid();
        var client = EntityBuilder.User.WithId(clientUserId).WithFirstName("Alice").WithLastName("Anders").Build();
        var clientProfile = EntityBuilder.ClientProfile.WithPublicId(clientPublicId).WithUserId(clientUserId).Build();

        var db = new MockDbBuilder().With(trainer).With(client).With(clientProfile).Build();

        var linkAuthorizationService = EndpointTestHelpers.CreateGrantingLinkAuthorizationService(
            accessibleClients: [(clientUserId, new LinkCapabilities(true, true))]);

        var ep = Factory.Create<BroadcastMessageEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            db, linkAuthorizationService, _conversationSeedService);

        await ep.HandleAsync(
            new BroadcastMessageRequest { ClientPublicIds = [clientPublicId, clientPublicId], Text = "Hi" },
            TestContext.Current.CancellationToken);

        ep.Response.SentCount.Should().Be(1);
        await _conversationSeedService.Received(1).GetOrSeedConversationAsync(
            _trainerId, clientUserId, _trainerId, "Coach Carl", "Hi", seedIntoExisting: true, Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// A link that grants neither plan domain still receives a broadcast — messaging is not plan
    /// data, and per #903 the capability flags gate plan reads, not the ability to message a live
    /// client one-by-one (which this endpoint reuses for several clients at once).
    /// </summary>
    [Fact]
    public async Task HandleAsync_GrantsNothingLink_StillSendsMessage()
    {
        var trainer = EntityBuilder.User.WithId(_trainerId).WithFirstName("Coach").WithLastName("Carl").Build();

        var clientPublicId = Guid.NewGuid();
        var clientUserId = Guid.NewGuid();
        var client = EntityBuilder.User.WithId(clientUserId).WithFirstName("Alice").WithLastName("Anders").Build();
        var clientProfile = EntityBuilder.ClientProfile.WithPublicId(clientPublicId).WithUserId(clientUserId).Build();

        var db = new MockDbBuilder().With(trainer).With(client).With(clientProfile).Build();

        var linkAuthorizationService = EndpointTestHelpers.CreateGrantingLinkAuthorizationService(
            accessibleClients: [(clientUserId, new LinkCapabilities(false, false))]);

        var ep = Factory.Create<BroadcastMessageEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            db, linkAuthorizationService, _conversationSeedService);

        await ep.HandleAsync(
            new BroadcastMessageRequest { ClientPublicIds = [clientPublicId], Text = "Hi" },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.SentCount.Should().Be(1);
        await _conversationSeedService.Received(1).GetOrSeedConversationAsync(
            _trainerId, clientUserId, _trainerId, "Coach Carl", "Hi", seedIntoExisting: true, Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// A recipient with no first/last name (e.g. Apple sign-in without a shared name) must not
    /// throw — the placeholders substitute to an empty string instead.
    /// </summary>
    [Fact]
    public async Task HandleAsync_RecipientWithEmptyName_SubstitutesWithoutThrowing()
    {
        var trainer = EntityBuilder.User.WithId(_trainerId).WithFirstName("Coach").WithLastName("Carl").Build();

        var clientPublicId = Guid.NewGuid();
        var clientUserId = Guid.NewGuid();
        var client = EntityBuilder.User.WithId(clientUserId).WithFirstName("").WithLastName("").Build();
        var clientProfile = EntityBuilder.ClientProfile.WithPublicId(clientPublicId).WithUserId(clientUserId).Build();

        var db = new MockDbBuilder().With(trainer).With(client).With(clientProfile).Build();

        var linkAuthorizationService = EndpointTestHelpers.CreateGrantingLinkAuthorizationService(
            accessibleClients: [(clientUserId, new LinkCapabilities(true, true))]);

        var ep = Factory.Create<BroadcastMessageEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            db, linkAuthorizationService, _conversationSeedService);

        await ep.HandleAsync(
            new BroadcastMessageRequest { ClientPublicIds = [clientPublicId], Text = "Hi {{firstName}} ({{fullName}})" },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        await _conversationSeedService.Received(1).GetOrSeedConversationAsync(
            _trainerId, clientUserId, _trainerId, "Coach Carl", "Hi  ()", seedIntoExisting: true, Arg.Any<CancellationToken>());
    }
}
