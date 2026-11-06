using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FormUp.Application.Domain.Common;
using FormUp.Application.Domain.Constants;
using FormUp.Application.Domain.Documents;
using FormUp.Application.Domain.Enums;
using FormUp.Application.Domain.Interfaces;
using FormUp.Application.Features.SessionExecutions.CompleteWorkout;
using FormUp.Application.Infrastructure.Data;
using FormUp.Tests.Builders;
using Microsoft.Extensions.Logging;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace FormUp.Tests.Endpoints.SessionExecutions;

/// <summary>
/// The trainer's in-app notice and email when a client completes a plan workout
/// (<see cref="CompleteWorkoutEndpoint"/>).
/// </summary>
public class CompleteWorkoutNotificationTests
{
    private const string SessionName = "Upper body A";

    private readonly Guid _clientId = Guid.NewGuid();
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly Guid _sessionId = Guid.NewGuid();
    private readonly Guid _clientProfilePublicId = Guid.NewGuid();
    private readonly INotificationService _notices = Substitute.For<INotificationService>();
    private readonly INotificationEmailSender _emails = Substitute.For<INotificationEmailSender>();

    private TrainingPlan BuildPlan() => new()
    {
        ExternalId = Guid.NewGuid(),
        ClientId = _clientId,
        TrainerId = _trainerId,
        Name = "Lean cut",
        Weeks =
        [
            new TrainingWeek
            {
                WeekNumber = 1,
                Days = [new TrainingDay { DayOfWeek = 1, Sessions = [new TrainingSession { SessionId = _sessionId, Name = SessionName }] }]
            }
        ]
    };

    private async Task<int> RunAsync(
        bool planBound, bool canViewTraining = true, bool alreadyCompleted = false)
    {
        var plan = BuildPlan();
        var log = WorkoutLogTestHelpers.CreateLog(
            clientId: _clientId,
            planId: planBound ? plan.ExternalId : null,
            sessionId: planBound ? _sessionId : null,
            startedAt: DateTime.UtcNow.AddMinutes(-47));
        log.Performance!.Notes = "Felt strong";
        log.Performance.Workouts =
        [
            new LoggedWorkout
            {
                Exercises =
                [
                    new WorkoutExercise { Sets = [new WorkoutSet(), new WorkoutSet()] },
                    new WorkoutExercise { Sets = [new WorkoutSet()] }
                ]
            }
        ];

        var completion = Substitute.For<IWorkoutCompletionService>();
        if (alreadyCompleted)
        {
            completion.CompleteAsync(Arg.Any<SessionExecution>(), Arg.Any<DateTime>(), Arg.Any<TimeZoneInfo>(), Arg.Any<CancellationToken>())
                .ThrowsAsync(new WorkoutAlreadyCompletedException());
        }
        else
        {
            completion.CompleteAsync(Arg.Any<SessionExecution>(), Arg.Any<DateTime>(), Arg.Any<TimeZoneInfo>(), Arg.Any<CancellationToken>())
                .Returns(call =>
                {
                    log.Performance.CompletedAt = DateTime.UtcNow;
                    return new List<string>();
                });
        }

        var lockService = Substitute.For<ISessionLockService>();
        lockService.ReleaseAsync(Arg.Any<Guid>(), Arg.Any<LockHolder>(), Arg.Any<LockType>(), Arg.Any<CancellationToken>())
            .Returns(true);

        var compliance = Substitute.For<IComplianceService>();
        compliance.CalculateComplianceAsync(Arg.Any<Guid>(), Arg.Any<DateTime>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>(), Arg.Any<Guid?>())
            .Returns(new ComplianceResult { CompliancePercent = 100m });

        var clientUser = EntityBuilder.User.WithId(_clientId).WithFirstName("Petra").WithLastName("Svobodova").Build();
        var db = new MockDbBuilder()
            .With(EntityBuilder.ClientProfile.WithUser(clientUser).WithPublicId(_clientProfilePublicId).Build())
            .Build();

        var ep = Factory.Create<CompleteWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            WorkoutLogTestHelpers.CreateMockMongo(logs: [log], plans: [plan]),
            completion, lockService, Substitute.For<IRealtimeNotifier>(), compliance,
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService(canViewTrainingPlans: canViewTraining),
            Substitute.For<ILogger<CompleteWorkoutEndpoint>>(),
            db, TimeProvider.System, _notices, _emails);

        await ep.HandleAsync(new CompleteWorkoutRequest { LogId = log.ExternalId }, TestContext.Current.CancellationToken);

        return ep.HttpContext.Response.StatusCode;
    }

    [Fact]
    public async Task HandleAsync_PlanWorkoutWithTrainingAccess_NotifiesTheTrainerInAppAndByEmail()
    {
        (await RunAsync(planBound: true)).Should().Be(200);

        await _notices.Received(1).CreateAsync(
            _trainerId,
            NotificationType.WorkoutFinished,
            Arg.Is<IReadOnlyDictionary<string, string>?>(p => p != null
                && p["clientName"] == "Petra Svobodova"
                && p["sessionName"] == SessionName
                && p["clientId"] == _clientProfilePublicId.ToString()),
            Arg.Any<string?>(),
            Arg.Any<CancellationToken>());
        await _emails.Received(1).SendAsync(
            _trainerId,
            NotificationEvent.WorkoutFinished,
            Arg.Is<IReadOnlyDictionary<string, string>>(v =>
                v[NotificationEmailWorkItem.SessionNameKey] == SessionName
                && v[NotificationEmailWorkItem.PlanNameKey] == "Lean cut"
                && v[NotificationEmailWorkItem.ExerciseCountKey] == "2"
                && v[NotificationEmailWorkItem.SetCountKey] == "3"
                && v[NotificationEmailWorkItem.DurationMinutesKey] == "47"
                && v[NotificationEmailWorkItem.NoteKey] == "Felt strong"
                && v[NotificationEmailWorkItem.ClientPublicIdKey] == _clientProfilePublicId.ToString()),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_TrainerLinkWithoutTrainingAccess_SendsNothing()
    {
        (await RunAsync(planBound: true, canViewTraining: false)).Should().Be(200);

        await AssertNothingSentAsync();
    }

    [Fact]
    public async Task HandleAsync_AdHocWorkoutWithoutPlan_SendsNothing()
    {
        (await RunAsync(planBound: false)).Should().Be(200);

        await AssertNothingSentAsync();
    }

    [Fact]
    public async Task HandleAsync_WorkoutAlreadyCompleted_Returns409AndSendsNothing()
    {
        (await RunAsync(planBound: true, alreadyCompleted: true)).Should().Be(409);

        await AssertNothingSentAsync();
    }

    private async Task AssertNothingSentAsync()
    {
        await _notices.DidNotReceive().CreateAsync(
            Arg.Any<Guid>(), NotificationType.WorkoutFinished,
            Arg.Any<IReadOnlyDictionary<string, string>?>(), Arg.Any<string?>(), Arg.Any<CancellationToken>());
        await _emails.DidNotReceive().SendAsync(
            Arg.Any<Guid>(), Arg.Any<NotificationEvent>(),
            Arg.Any<IReadOnlyDictionary<string, string>>(), Arg.Any<CancellationToken>());
    }
}
