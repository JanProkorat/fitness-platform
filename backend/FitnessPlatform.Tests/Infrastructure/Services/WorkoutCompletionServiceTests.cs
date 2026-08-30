using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Endpoints;
using FitnessPlatform.Tests.Endpoints.ClientTraining;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace FitnessPlatform.Tests.Infrastructure.Services;

/// <summary>
/// Tests for <see cref="WorkoutCompletionService"/>'s PR-notification gate (F6, claude-security
/// review). A revoked or narrowed-capability trainer link must not keep receiving a persisted
/// notification + device push for the client's personal records — authorship on the plan document
/// (<c>TrainingPlan.TrainerId</c>) is permanent, but the link is not.
/// </summary>
public class WorkoutCompletionServiceTests
{
    private readonly Guid _clientId = Guid.NewGuid();
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly Guid _planId = Guid.NewGuid();

    private SessionExecution CreateExecution() => new()
    {
        ExternalId = Guid.NewGuid(),
        ClientId = _clientId,
        PlanId = _planId,
        // SessionId intentionally left null — skips PopulateCompletionFlagsAsync, which is
        // irrelevant to the notification gate under test here.
        Status = SessionExecutionStatus.Partial,
        Performance = new SessionExecutionPerformance
        {
            StartedAt = DateTime.UtcNow.AddMinutes(-30),
        },
        DateCreated = DateTime.UtcNow.AddMinutes(-30),
        Version = 1,
    };

    private TrainingPlan CreatePlan() => new()
    {
        ExternalId = _planId,
        ClientId = _clientId,
        TrainerId = _trainerId,
        Name = "Test Plan",
        Status = TrainingPlanStatus.Active,
        Version = 1,
        DateCreated = DateTime.UtcNow.AddDays(-30),
    };

    private static IPrDetectionService CreatePrDetectionStub(IReadOnlyList<string> prDescriptions)
    {
        var svc = Substitute.For<IPrDetectionService>();
        svc.DetectAndMarkPRsAsync(Arg.Any<SessionExecution>(), Arg.Any<CancellationToken>())
            .Returns(prDescriptions.ToList());
        return svc;
    }

    private WorkoutCompletionService CreateService(
        IMongoContext mongo,
        IReadOnlyList<string> prDescriptions,
        INotificationService notifications,
        IClientLinkAuthorizationService linkAuthorizationService)
    {
        return new WorkoutCompletionService(
            mongo,
            CreatePrDetectionStub(prDescriptions),
            notifications,
            linkAuthorizationService,
            Substitute.For<ILogger<WorkoutCompletionService>>());
    }

    [Fact]
    public async Task CompleteAsync_PrDetectedAndLinkGrantsAccess_NotifiesTrainer()
    {
        var plan = CreatePlan();
        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan);
        var notifications = Substitute.For<INotificationService>();
        var linkAuthorizationService = EndpointTestHelpers.CreateGrantingLinkAuthorizationService();

        var service = CreateService(mongo, ["Bench Press: 100 kg x 5"], notifications, linkAuthorizationService);
        var execution = CreateExecution();

        await service.CompleteAsync(execution, DateTime.UtcNow, TimeZoneInfo.Utc, TestContext.Current.CancellationToken);

        await notifications.Received(1).CreateAsync(
            _trainerId,
            NotificationType.PersonalRecord,
            Arg.Any<IReadOnlyDictionary<string, string>>(),
            Arg.Any<string?>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CompleteAsync_PrDetectedButLinkRevoked_DoesNotNotifyTrainer()
    {
        // Same fixture as the positive test above except the trainer's link no longer grants
        // training access (collaboration ended, or narrowed to nutrition-only) — the control
        // proving the gate discriminates rather than always notifying.
        var plan = CreatePlan();
        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan);
        var notifications = Substitute.For<INotificationService>();
        var linkAuthorizationService = EndpointTestHelpers.CreateGrantingLinkAuthorizationService(canViewTrainingPlans: false);

        var service = CreateService(mongo, ["Bench Press: 100 kg x 5"], notifications, linkAuthorizationService);
        var execution = CreateExecution();

        await service.CompleteAsync(execution, DateTime.UtcNow, TimeZoneInfo.Utc, TestContext.Current.CancellationToken);

        await notifications.DidNotReceive().CreateAsync(
            Arg.Any<Guid>(),
            Arg.Any<NotificationType>(),
            Arg.Any<IReadOnlyDictionary<string, string>>(),
            Arg.Any<string?>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CompleteAsync_NoPrDetected_DoesNotNotifyTrainer_RegardlessOfAccess()
    {
        // Pre-existing behavior, unrelated to the F6 gate: no PR means no notification attempt
        // at all, so the link authorization service is never even consulted.
        var plan = CreatePlan();
        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan);
        var notifications = Substitute.For<INotificationService>();
        var linkAuthorizationService = EndpointTestHelpers.CreateGrantingLinkAuthorizationService();

        var service = CreateService(mongo, [], notifications, linkAuthorizationService);
        var execution = CreateExecution();

        await service.CompleteAsync(execution, DateTime.UtcNow, TimeZoneInfo.Utc, TestContext.Current.CancellationToken);

        await notifications.DidNotReceive().CreateAsync(
            Arg.Any<Guid>(),
            Arg.Any<NotificationType>(),
            Arg.Any<IReadOnlyDictionary<string, string>>(),
            Arg.Any<string?>(),
            Arg.Any<CancellationToken>());
    }
}
