using FluentAssertions;
using FormUp.Application.Domain.Documents;
using FormUp.Application.Domain.Enums;
using FormUp.Application.Domain.Interfaces;
using FormUp.Application.Infrastructure.Services;
using FormUp.Tests.Endpoints.SessionExecutions;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace FormUp.Tests.Endpoints.TrainingPlans;

/// <summary>
/// A trainer finishing a session for a client goes through <see cref="IWorkoutCompletionService"/>, the same
/// pipeline the client's own completion uses. It must not raise the workout-finished notice: that one is
/// the client's own signal, sent from the complete-workout endpoint.
/// </summary>
public class FinishSessionNotificationTests
{
    [Fact]
    public async Task CompleteAsync_PlanBoundSessionWithPersonalRecord_NeverRaisesWorkoutFinished()
    {
        var trainerId = Guid.NewGuid();
        var clientId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientId,
            TrainerId = trainerId,
            Name = "Plan",
            Weeks = [new TrainingWeek { Days = [new TrainingDay { Sessions = [new TrainingSession { SessionId = sessionId, Name = "Push" }] }] }]
        };
        var execution = WorkoutLogTestHelpers.CreateLog(clientId: clientId, planId: plan.ExternalId, sessionId: sessionId);

        var prDetection = Substitute.For<IPrDetectionService>();
        prDetection.DetectAndMarkPRsAsync(Arg.Any<SessionExecution>(), Arg.Any<CancellationToken>())
            .Returns(["Bench press 100 kg"]);
        var notices = Substitute.For<INotificationService>();
        var service = new WorkoutCompletionService(
            WorkoutLogTestHelpers.CreateMockMongo(logs: [execution], plans: [plan]),
            prDetection,
            notices,
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService(),
            Substitute.For<ILogger<WorkoutCompletionService>>());

        await service.CompleteAsync(execution, DateTime.UtcNow, TimeZoneInfo.Utc, TestContext.Current.CancellationToken);

        await notices.Received(1).CreateAsync(
            trainerId, NotificationType.PersonalRecord,
            Arg.Any<IReadOnlyDictionary<string, string>?>(), Arg.Any<string?>(), Arg.Any<CancellationToken>());
        await notices.DidNotReceive().CreateAsync(
            Arg.Any<Guid>(), NotificationType.WorkoutFinished,
            Arg.Any<IReadOnlyDictionary<string, string>?>(), Arg.Any<string?>(), Arg.Any<CancellationToken>());
        execution.Status.Should().Be(SessionExecutionStatus.Completed);
    }
}
