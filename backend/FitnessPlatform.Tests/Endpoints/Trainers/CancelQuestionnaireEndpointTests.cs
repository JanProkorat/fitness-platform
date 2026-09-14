using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.Trainers.CancelQuestionnaire;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Services;
using Microsoft.Extensions.Logging;
using FitnessPlatform.Tests.Builders;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Trainers;

/// <summary>
/// Tests for <see cref="CancelQuestionnaireEndpoint"/>.
/// </summary>
public class CancelQuestionnaireEndpointTests
{
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly IRealtimeNotifier _notifier = Substitute.For<IRealtimeNotifier>();
    private readonly INotificationService _notificationService = Substitute.For<INotificationService>();
    private readonly ILogger<CancelQuestionnaireEndpoint> _logger = Substitute.For<ILogger<CancelQuestionnaireEndpoint>>();

    private CancelQuestionnaireEndpoint CreateEndpoint(IApplicationDbContext db, Guid callerId) =>
        Factory.Create<CancelQuestionnaireEndpoint>(
            ctx => ctx.Request.HttpContext.User = FakeTrainerPrincipal(callerId),
            db, _notifier, _notificationService, _logger, new ClientLinkAuthorizationService(db));

    [Fact]
    public async Task Cancel_HappyPath_Returns204_NotifiesAndBroadcasts()
    {
        var (db, clientProfile, response) = BuildLinkedClientWithPendingResponse();

        var ep = CreateEndpoint(db, _trainerId);

        await ep.HandleAsync(
            new CancelQuestionnaireRequest { ClientPublicId = clientProfile.PublicId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);
        response.Status.Should().Be(QuestionnaireResponseStatus.Cancelled);

        await _notificationService.Received(1).CreateAsync(
            clientProfile.UserId,
            NotificationType.QuestionnaireAssigned,
            Arg.Any<IReadOnlyDictionary<string, string>>(),
            variant: NotificationTemplates.QuestionnaireAssignedRevoked,
            ct: Arg.Any<CancellationToken>());

        await _notifier.Received(1).NotifyAsync(
            clientProfile.UserId, "questionnairecancelled", Arg.Any<object>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Cancel_NoClaims_Returns401()
    {
        var (db, clientProfile, _) = BuildLinkedClientWithPendingResponse();

        var ep = Factory.Create<CancelQuestionnaireEndpoint>(
            db, _notifier, _notificationService, _logger, new ClientLinkAuthorizationService(db));

        await ep.HandleAsync(
            new CancelQuestionnaireRequest { ClientPublicId = clientProfile.PublicId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }

    [Fact]
    public async Task Cancel_NoTrainerProfile_Returns404()
    {
        var db = new MockDbBuilder().Build();

        var ep = CreateEndpoint(db, _trainerId);

        await ep.HandleAsync(
            new CancelQuestionnaireRequest { ClientPublicId = Guid.NewGuid() },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task Cancel_NonexistentClient_Returns404()
    {
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerId).Build();
        var db = new MockDbBuilder().With(trainerProfile).Build();

        var ep = CreateEndpoint(db, _trainerId);

        await ep.HandleAsync(
            new CancelQuestionnaireRequest { ClientPublicId = Guid.NewGuid() },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    /// <summary>
    /// Deny path through the new <see cref="IClientLinkAuthorizationService"/> — the trainer has
    /// a profile and the client exists, but there is no active link between them. A dead/detached
    /// service dependency here would silently return 200 instead of 404 (the #916 / F1-F11
    /// failure mode this suite guards against).
    /// </summary>
    [Fact]
    public async Task Cancel_NotLinkedToClient_Returns404()
    {
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerId).Build();
        var clientUser = EntityBuilder.User.Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(10).WithUser(clientUser).Build();
        // No link added — the trainer has no active relationship to this client.
        var db = new MockDbBuilder().With(trainerProfile).With(clientProfile).Build();

        var ep = CreateEndpoint(db, _trainerId);

        await ep.HandleAsync(
            new CancelQuestionnaireRequest { ClientPublicId = clientProfile.PublicId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
        await _notificationService.DidNotReceive().CreateAsync(
            Arg.Any<Guid>(), Arg.Any<NotificationType>(),
            Arg.Any<IReadOnlyDictionary<string, string>>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Cancel_NoPendingQuestionnaire_ThrowsValidationError()
    {
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerId).Build();
        var trainerUser = EntityBuilder.User.WithId(_trainerId).Build();
        var clientUser = EntityBuilder.User.Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(10).WithUser(clientUser).Build();
        var link = EntityBuilder.ClientProfessionalLink
            .WithId(42).WithClientProfile(clientProfile).WithProfessionalProfile(trainerProfile).Build();

        // No pending/in-progress QuestionnaireResponse seeded.
        var db = new MockDbBuilder()
            .With(trainerProfile).With(trainerUser).With(clientProfile).With(link)
            .Build();

        var ep = CreateEndpoint(db, _trainerId);

        var act = () => ep.HandleAsync(
            new CancelQuestionnaireRequest { ClientPublicId = clientProfile.PublicId },
            TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<ValidationFailureException>();
    }

    private (IApplicationDbContext db, ClientProfile clientProfile, QuestionnaireResponse response)
        BuildLinkedClientWithPendingResponse()
    {
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerId).Build();
        var trainerUser = EntityBuilder.User.WithId(_trainerId)
            .WithFirstName("Test").WithLastName("Trainer").Build();
        var clientUser = EntityBuilder.User.WithEmail("client@test.com").Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(10).WithUser(clientUser).Build();
        var link = EntityBuilder.ClientProfessionalLink
            .WithId(42).WithClientProfile(clientProfile).WithProfessionalProfile(trainerProfile).Build();

        var response = new QuestionnaireResponse
        {
            PublicId = Guid.NewGuid(),
            QuestionnaireId = 1,
            ClientId = clientProfile.UserId,
            ProfessionalId = _trainerId,
            LinkId = link.Id,
            Status = QuestionnaireResponseStatus.Pending,
            DateCreated = DateTime.UtcNow,
            Questionnaire = new Questionnaire
            {
                PublicId = Guid.NewGuid(),
                ProfessionalId = _trainerId,
                Title = "Onboarding Questionnaire",
                DateCreated = DateTime.UtcNow,
            },
        };

        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(trainerUser)
            .With(clientProfile)
            .With(link)
            .With(response)
            .Build();

        return (db, clientProfile, response);
    }

    private static ClaimsPrincipal FakeTrainerPrincipal(Guid userId) =>
        new(new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(userId, AppRoles.Trainer)));
}
