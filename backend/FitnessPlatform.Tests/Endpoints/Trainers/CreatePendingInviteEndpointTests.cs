using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Trainers.PendingInvites.Create;
using FitnessPlatform.Tests.Builders;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Trainers;

public class CreatePendingInviteEndpointTests
{
    private readonly Guid _trainerId = Guid.NewGuid();

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

        var emailService = Substitute.For<IEmailService>();
        var notificationService = Substitute.For<INotificationService>();
        var notifier = Substitute.For<IRealtimeNotifier>();
        var conversationSeedService = Substitute.For<IConversationSeedService>();
        var logger = Substitute.For<ILogger<CreatePendingInviteEndpoint>>();

        var ep = Factory.Create<CreatePendingInviteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            db, emailService, notificationService, notifier, conversationSeedService, logger);

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
    /// Regression test for #768 — when the invited email already belongs to a
    /// registered user, the invite's message must be seeded as the conversation's
    /// first message immediately (via the shared <see cref="IConversationSeedService"/>),
    /// not silently dropped.
    /// </summary>
    [Fact]
    public async Task HandleAsync_ExistingUserWithMessage_SeedsConversation()
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

        var emailService = Substitute.For<IEmailService>();
        var notificationService = Substitute.For<INotificationService>();
        var notifier = Substitute.For<IRealtimeNotifier>();
        var conversationSeedService = Substitute.For<IConversationSeedService>();
        var logger = Substitute.For<ILogger<CreatePendingInviteEndpoint>>();

        var ep = Factory.Create<CreatePendingInviteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            db, emailService, notificationService, notifier, conversationSeedService, logger);

        await ep.HandleAsync(new CreatePendingInviteRequest
        {
            FirstName = "Jane",
            LastName = "Doe",
            Email = "jane@test.com",
            Message = "Looking forward to coaching you!"
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        await conversationSeedService.Received(1).GetOrSeedConversationAsync(
            trainerProfile.UserId, existingUser.Id, trainerProfile.UserId,
            Arg.Any<string>(), "Looking forward to coaching you!", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NoProfessionalProfile_ThrowsError()
    {
        var db = new MockDbBuilder().Build();
        var emailService = Substitute.For<IEmailService>();
        var notificationService = Substitute.For<INotificationService>();
        var notifier = Substitute.For<IRealtimeNotifier>();
        var conversationSeedService = Substitute.For<IConversationSeedService>();
        var logger = Substitute.For<ILogger<CreatePendingInviteEndpoint>>();

        var ep = Factory.Create<CreatePendingInviteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            db, emailService, notificationService, notifier, conversationSeedService, logger);

        var act = () => ep.HandleAsync(new CreatePendingInviteRequest
        {
            FirstName = "Jane",
            LastName = "Doe",
            Email = "jane@test.com"
        }, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<ValidationFailureException>();
    }
}
