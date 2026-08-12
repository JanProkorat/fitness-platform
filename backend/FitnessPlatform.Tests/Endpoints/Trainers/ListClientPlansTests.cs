using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Trainers.ListClientPlans;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Trainers;

/// <summary>
/// Tests for <see cref="ListClientPlansEndpoint" />.
/// </summary>
public class ListClientPlansTests
{
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly IComplianceService _complianceService = Substitute.For<IComplianceService>();
    private readonly IAuditService _audit = Substitute.For<IAuditService>();

    // ── Happy path — combined list ───────────────────────────────────────────

    [Fact]
    public async Task List_BothPlanTypes_ReturnsCombinedListNewestFirst()
    {
        var (db, clientProfile) = BuildLinkedClientSetup();
        // NutritionPlan.ClientId and TrainingPlan.ClientId store ClientProfile.PublicId (not UserId).
        var clientPublicId = clientProfile.PublicId;

        var olderStart = new DateTime(2025, 1, 6, 0, 0, 0, DateTimeKind.Utc);  // Monday
        var newerStart = new DateTime(2025, 6, 2, 0, 0, 0, DateTimeKind.Utc);  // Monday

        var nutritionPlan = CreateNutritionPlan(clientPublicId, startDate: olderStart, name: "Old Nutrition Plan");
        var trainingPlan = CreateTrainingPlan(clientPublicId, startDate: newerStart, name: "New Training Plan");

        var mongo = BuildMongo(
            nutritionPlans: [nutritionPlan],
            trainingPlans: [trainingPlan],
            workoutLogs: [],
            personalRecords: []);

        var ep = CreateEndpoint(db, mongo, _trainerId);

        await ep.HandleAsync(new ListClientPlansRequest { ClientId = clientProfile.PublicId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        var plans = ep.Response.Plans;
        plans.Should().HaveCount(2);

        // Newest-first: trainingPlan (newerStart) should come before nutritionPlan (olderStart)
        plans[0].PlanId.Should().Be(trainingPlan.ExternalId);
        plans[0].PlanType.Should().Be("Training");
        plans[0].Name.Should().Be("New Training Plan");
        plans[1].PlanId.Should().Be(nutritionPlan.ExternalId);
        plans[1].PlanType.Should().Be("Nutrition");
        plans[1].Name.Should().Be("Old Nutrition Plan");
    }

    [Fact]
    public async Task List_AllStatuses_ReturnsDraftActiveCompleted()
    {
        var (db, clientProfile) = BuildLinkedClientSetup();
        // NutritionPlan.ClientId and TrainingPlan.ClientId store ClientProfile.PublicId (not UserId).
        var clientPublicId = clientProfile.PublicId;

        var start1 = new DateTime(2025, 1, 6, 0, 0, 0, DateTimeKind.Utc);
        var start2 = new DateTime(2025, 3, 3, 0, 0, 0, DateTimeKind.Utc);
        var start3 = new DateTime(2025, 5, 5, 0, 0, 0, DateTimeKind.Utc);

        var draftPlan = CreateTrainingPlan(clientPublicId, status: TrainingPlanStatus.Draft, startDate: start1, name: "Draft Plan");
        var activePlan = CreateTrainingPlan(clientPublicId, status: TrainingPlanStatus.Active, startDate: start2, name: "Active Plan");
        var completedPlan = CreateTrainingPlan(clientPublicId, status: TrainingPlanStatus.Completed, startDate: start3, name: "Completed Plan");

        var mongo = BuildMongo(
            trainingPlans: [draftPlan, activePlan, completedPlan],
            workoutLogs: [],
            personalRecords: []);

        var ep = CreateEndpoint(db, mongo, _trainerId);

        await ep.HandleAsync(new ListClientPlansRequest { ClientId = clientProfile.PublicId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        var plans = ep.Response.Plans;
        plans.Should().HaveCount(3);

        // Verify all statuses are present
        plans.Select(p => p.Status).Should().BeEquivalentTo(["Draft", "Active", "Completed"]);
    }

    // ── Training plan result summary ─────────────────────────────────────────

    [Fact]
    public async Task List_TrainingPlan_ResultSummaryIncludesTotalTrainingsAndPrCount()
    {
        var (db, clientProfile) = BuildLinkedClientSetup();
        // NutritionPlan.ClientId and TrainingPlan.ClientId store ClientProfile.PublicId (not UserId).
        // WorkoutLog.ClientId and PersonalRecord.ClientId store UserId.
        var clientPublicId = clientProfile.PublicId;
        var clientUserId = clientProfile.UserId;

        var planStart = new DateTime(2025, 1, 6, 0, 0, 0, DateTimeKind.Utc);
        var planId = Guid.NewGuid();

        var trainingPlan = CreateTrainingPlan(clientPublicId, externalId: planId, startDate: planStart, name: "Hypertrophy Plan");

        // 3 completed logs for this plan — keyed on UserId (WorkoutLog convention)
        var log1 = CreateWorkoutLog(clientUserId, planId, isCompleted: true);
        var log2 = CreateWorkoutLog(clientUserId, planId, isCompleted: true);
        var log3 = CreateWorkoutLog(clientUserId, planId, isCompleted: true);
        // 1 not completed (should not be counted)
        var log4 = CreateWorkoutLog(clientUserId, planId, isCompleted: false);
        // 1 completed but for a different plan (should not be counted)
        var log5 = CreateWorkoutLog(clientUserId, Guid.NewGuid(), isCompleted: true);

        // 2 PRs in the plan window — keyed on UserId (PersonalRecord convention)
        var pr1 = CreatePersonalRecord(clientUserId, achievedAt: planStart.AddDays(10));
        var pr2 = CreatePersonalRecord(clientUserId, achievedAt: planStart.AddDays(20));
        // 1 PR before plan start (should not be counted)
        var prBefore = CreatePersonalRecord(clientUserId, achievedAt: planStart.AddDays(-5));

        var mongo = BuildMongo(
            trainingPlans: [trainingPlan],
            workoutLogs: [log1, log2, log3, log4, log5],
            personalRecords: [pr1, pr2, prBefore]);

        var ep = CreateEndpoint(db, mongo, _trainerId);

        await ep.HandleAsync(new ListClientPlansRequest { ClientId = clientProfile.PublicId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        var planItem = ep.Response.Plans.Single();
        planItem.ResultSummary.TotalTrainings.Should().Be(3);
        planItem.ResultSummary.PrCount.Should().Be(2);
        planItem.ResultSummary.CompliancePercent.Should().BeNull();
        planItem.ResultSummary.WeightDeltaKg.Should().BeNull();
    }

    [Fact]
    public async Task List_TrainingPlanNoStartDate_PrCountIsNull()
    {
        var (db, clientProfile) = BuildLinkedClientSetup();
        var clientPublicId = clientProfile.PublicId;
        var clientUserId = clientProfile.UserId;

        var planId = Guid.NewGuid();
        // No StartDate set — Draft plan — ClientId is PublicId for plans
        var trainingPlan = CreateTrainingPlan(clientPublicId, externalId: planId, startDate: null, name: "Draft Plan");

        var pr = CreatePersonalRecord(clientUserId, achievedAt: DateTime.UtcNow.AddDays(-5));

        var mongo = BuildMongo(
            trainingPlans: [trainingPlan],
            workoutLogs: [],
            personalRecords: [pr]);

        var ep = CreateEndpoint(db, mongo, _trainerId);

        await ep.HandleAsync(new ListClientPlansRequest { ClientId = clientProfile.PublicId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.Plans.Single().ResultSummary.PrCount.Should().BeNull();
        ep.Response.Plans.Single().ResultSummary.TotalTrainings.Should().Be(0);
    }

    // ── Nutrition plan result summary ────────────────────────────────────────

    [Fact]
    public async Task List_NutritionPlan_ResultSummaryIncludesComplianceAndWeightDelta()
    {
        var planStart = new DateTime(2025, 1, 6, 0, 0, 0, DateTimeKind.Utc);
        var planEnd = new DateTime(2025, 3, 31, 0, 0, 0, DateTimeKind.Utc);
        var clientUserId = Guid.NewGuid();

        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerId).Build();
        var clientUser = EntityBuilder.User.WithId(clientUserId).Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(10).WithUser(clientUser).Build();

        // NutritionPlan.ClientId stores ApplicationUser.Id (#840, previously PublicId).
        var nutritionPlan = CreateNutritionPlan(
            clientProfile.UserId,
            startDate: planStart,
            dateCompleted: planEnd,
            name: "Weight Loss Plan");
        var link = EntityBuilder.ClientProfessionalLink
            .WithId(42)
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(trainerProfile)
            .Build();

        // Two body measurements within the plan window (distinct Ids required for delta calculation)
        var measurementStart = new BodyMeasurement
        {
            Id = 1,
            ClientProfileId = clientProfile.Id,
            MeasuredAt = planStart.AddDays(1),
            WeightKg = 80.0m
        };
        var measurementEnd = new BodyMeasurement
        {
            Id = 2,
            ClientProfileId = clientProfile.Id,
            MeasuredAt = planEnd.AddDays(-1),
            WeightKg = 75.5m
        };

        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(clientProfile)
            .With(link)
            .With(measurementStart)
            .With(measurementEnd)
            .Build();

        // Regression guard for #840 (supersedes #650): ListClientPlansEndpoint must call
        // CalculateComplianceAsync with clientProfile.UserId, not clientProfile.PublicId.
        // NutritionPlan/MealLog/TrainingCompletion collections all key ClientId on UserId now.
        // This substitute is configured ONLY for UserId — a call made with PublicId (the
        // now-stale identifier) would hit no matching setup and return
        // default(ComplianceResult) == null, causing a NullReferenceException.
        _complianceService
            .CalculateComplianceAsync(clientProfile.UserId, planStart, planEnd, Arg.Any<CancellationToken>())
            .Returns(new ComplianceResult
            {
                NutritionCompliancePercent = 87.5m,
                TrainingCompliancePercent = 60m,
                CompliancePercent = 87.5m
            });

        var mongo = BuildMongo(
            nutritionPlans: [nutritionPlan],
            workoutLogs: [],
            personalRecords: []);

        var ep = CreateEndpoint(db, mongo, _trainerId, setupDefaultCompliance: false);

        await ep.HandleAsync(new ListClientPlansRequest { ClientId = clientProfile.PublicId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        var planItem = ep.Response.Plans.Single();
        planItem.ResultSummary.CompliancePercent.Should().Be(87.5m);
        planItem.ResultSummary.WeightDeltaKg.Should().BeApproximately(-4.5m, 0.01m);
        planItem.ResultSummary.TotalTrainings.Should().BeNull();
        planItem.ResultSummary.PrCount.Should().BeNull();
    }

    /// <summary>
    /// Regression guard for #840 (supersedes #650): asserts the exact argument passed to
    /// <see cref="IComplianceService.CalculateComplianceAsync"/> is
    /// <c>ApplicationUser.Id</c>, not <c>ClientProfile.PublicId</c>. Prior to #840,
    /// ListClientPlansEndpoint called with <c>clientPublicId</c> — this test's
    /// <c>Received()</c> assertion on <c>UserId</c> fails against that old code, and its
    /// <c>DidNotReceive()</c> assertion on <c>PublicId</c> fails too (the old code called
    /// with PublicId). Both assertions pass only once the argument is UserId.
    /// </summary>
    [Fact]
    public async Task List_NutritionPlan_CallsComplianceServiceWithUserId_NotPublicId()
    {
        var (db, clientProfile) = BuildLinkedClientSetup();
        var clientPublicId = clientProfile.PublicId;
        var clientUserId = clientProfile.UserId;

        var planStart = new DateTime(2025, 1, 6, 0, 0, 0, DateTimeKind.Utc);
        var planEnd = new DateTime(2025, 3, 31, 0, 0, 0, DateTimeKind.Utc);

        var nutritionPlan = CreateNutritionPlan(clientUserId, startDate: planStart, dateCompleted: planEnd, name: "Adhered Plan");
        var mongo = BuildMongo(nutritionPlans: [nutritionPlan], workoutLogs: [], personalRecords: []);

        _complianceService
            .CalculateComplianceAsync(clientUserId, planStart, planEnd, Arg.Any<CancellationToken>())
            .Returns(new ComplianceResult
            {
                NutritionCompliancePercent = 92.0m,
                TrainingCompliancePercent = 80.0m,
                CompliancePercent = 85.0m
            });

        var ep = CreateEndpoint(db, mongo, _trainerId, setupDefaultCompliance: false);

        await ep.HandleAsync(new ListClientPlansRequest { ClientId = clientProfile.PublicId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        var planItem = ep.Response.Plans.Single();
        planItem.ResultSummary.CompliancePercent.Should().Be(92.0m,
            "nutrition compliance must be non-zero when the client adheres to the plan");

        await _complianceService.Received(1).CalculateComplianceAsync(
            clientUserId, planStart, planEnd, Arg.Any<CancellationToken>());
        await _complianceService.DidNotReceive().CalculateComplianceAsync(
            clientPublicId, Arg.Any<DateTime>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task List_NutritionPlanNoStartDate_ComplianceAndWeightDeltaAreNull()
    {
        var (db, clientProfile) = BuildLinkedClientSetup();
        var clientPublicId = clientProfile.PublicId;

        var nutritionPlan = CreateNutritionPlan(clientPublicId, startDate: null, name: "Draft Nutrition Plan");

        var mongo = BuildMongo(nutritionPlans: [nutritionPlan], workoutLogs: [], personalRecords: []);

        var ep = CreateEndpoint(db, mongo, _trainerId);

        await ep.HandleAsync(new ListClientPlansRequest { ClientId = clientProfile.PublicId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        var planItem = ep.Response.Plans.Single();
        planItem.ResultSummary.CompliancePercent.Should().BeNull();
        planItem.ResultSummary.WeightDeltaKg.Should().BeNull();
    }

    // ── Empty results ────────────────────────────────────────────────────────

    [Fact]
    public async Task List_NoPlans_ReturnsEmptyArray()
    {
        var (db, clientProfile) = BuildLinkedClientSetup();

        var mongo = BuildMongo(nutritionPlans: [], trainingPlans: [], workoutLogs: [], personalRecords: []);

        var ep = CreateEndpoint(db, mongo, _trainerId);

        await ep.HandleAsync(new ListClientPlansRequest { ClientId = clientProfile.PublicId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.Plans.Should().BeEmpty();
    }

    // ── Fault propagation ────────────────────────────────────────────────────

    [Fact]
    public async Task List_ComplianceServiceFaults_SurfacesOriginalException_NotTaskCanceledException()
    {
        // Regression guard for the ContinueWith+OnlyOnRanToCompletion pattern that was
        // introduced in the first parallel refactor. That pattern puts the continuation
        // in Canceled state when the antecedent faults, so Task.WhenAll throws
        // TaskCanceledException and the real exception is never observed. The async-lambda
        // pattern must surface the real exception type through Task.WhenAll.
        var (db, clientProfile) = BuildLinkedClientSetup();
        var clientPublicId = clientProfile.PublicId;

        var planStart = new DateTime(2025, 1, 6, 0, 0, 0, DateTimeKind.Utc);
        var nutritionPlan = CreateNutritionPlan(clientPublicId, startDate: planStart, name: "Faulting Plan");
        var mongo = BuildMongo(nutritionPlans: [nutritionPlan], workoutLogs: [], personalRecords: []);

        // Force CalculateComplianceAsync to throw a domain-specific exception
        var expected = new InvalidOperationException("compliance-db-error");
        _complianceService
            .CalculateComplianceAsync(Arg.Any<Guid>(), Arg.Any<DateTime>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>())
            .Returns<ComplianceResult>(_ => throw expected);

        var ep = CreateEndpoint(db, mongo, _trainerId, setupDefaultCompliance: false);

        var act = async () => await ep.HandleAsync(
            new ListClientPlansRequest { ClientId = clientProfile.PublicId },
            TestContext.Current.CancellationToken);

        // Must surface InvalidOperationException (or an AggregateException wrapping it),
        // NOT TaskCanceledException — which is what OnlyOnRanToCompletion produced.
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("compliance-db-error");
    }

    // ── Audit logging (F11) ──────────────────────────────────────────────────
    // ListClientPlansEndpoint reads plan inventory, compliance percentages and weight
    // deltas without leaving an audit trail, unlike sibling routes (GetClientMeasurements)
    // reading the same rows. A successful read must audit; a denied caller (no link) must
    // not — the negative case is the control proving the assertion below isn't vacuous.

    [Fact]
    public async Task List_Success_LogsAuditRead()
    {
        var (db, clientProfile) = BuildLinkedClientSetup();
        var mongo = BuildMongo(nutritionPlans: [], trainingPlans: [], workoutLogs: [], personalRecords: []);

        var ep = CreateEndpoint(db, mongo, _trainerId);

        await ep.HandleAsync(new ListClientPlansRequest { ClientId = clientProfile.PublicId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        await _audit.Received(1).LogAsync(
            _trainerId,
            "Read",
            "ClientPlans",
            clientProfile.PublicId,
            Arg.Any<string?>(),
            Arg.Any<string?>(),
            Arg.Any<string?>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task List_NotLinkedToClient_DoesNotLogAudit()
    {
        // Same denial path as List_NotLinkedToClient_Returns403 — a caller refused access
        // must not generate an audit row for a read that never happened.
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerId).Build();
        var clientUser = EntityBuilder.User.WithEmail("client@test.com").Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(1).WithUser(clientUser).Build();

        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(clientProfile)
            .Build();

        var mongo = BuildMongo();

        var ep = CreateEndpoint(db, mongo, _trainerId);

        await ep.HandleAsync(new ListClientPlansRequest { ClientId = clientProfile.PublicId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(403);
        await _audit.DidNotReceive().LogAsync(
            Arg.Any<Guid?>(),
            Arg.Any<string>(),
            Arg.Any<string>(),
            Arg.Any<Guid?>(),
            Arg.Any<string?>(),
            Arg.Any<string?>(),
            Arg.Any<string?>(),
            Arg.Any<CancellationToken>());
    }

    // ── Auth & ownership errors ──────────────────────────────────────────────

    [Fact]
    public async Task List_NoClaims_Returns401()
    {
        var db = new MockDbBuilder().Build();
        var mongo = BuildMongo();

        var ep = Factory.Create<ListClientPlansEndpoint>(db, mongo, _complianceService, _audit);

        await ep.HandleAsync(new ListClientPlansRequest { ClientId = Guid.NewGuid() },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }

    [Fact]
    public async Task List_NotLinkedToClient_Returns403()
    {
        // Trainer has a profile but NO link to the client
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerId).Build();
        var clientUser = EntityBuilder.User.WithEmail("client@test.com").Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(1).WithUser(clientUser).Build();

        // No link added to MockDbBuilder
        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(clientProfile)
            .Build();

        var mongo = BuildMongo();

        var ep = CreateEndpoint(db, mongo, _trainerId);

        await ep.HandleAsync(new ListClientPlansRequest { ClientId = clientProfile.PublicId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(403);
    }

    [Fact]
    public async Task List_CrossTrainerAccess_Returns403()
    {
        // Trainer 2 tries to access trainer 1's client
        var trainer1Id = Guid.NewGuid();
        var trainer2Id = _trainerId;

        var trainerProfile1 = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(trainer1Id).Build();
        var trainerProfile2 = EntityBuilder.ProfessionalProfile.WithId(2).WithUserId(trainer2Id).Build();
        var clientUser = EntityBuilder.User.Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(10).WithUser(clientUser).Build();

        // Only trainer1 is linked to the client
        var link = EntityBuilder.ClientProfessionalLink
            .WithId(42)
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(trainerProfile1)
            .Build();

        var db = new MockDbBuilder()
            .With(trainerProfile1)
            .With(trainerProfile2)
            .With(clientProfile)
            .With(link)
            .Build();

        var mongo = BuildMongo();

        // trainer2 is calling
        var ep = CreateEndpoint(db, mongo, trainer2Id);

        await ep.HandleAsync(new ListClientPlansRequest { ClientId = clientProfile.PublicId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(403);
    }

    [Fact]
    public async Task List_NonexistentClient_Returns404()
    {
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerId).Build();
        var db = new MockDbBuilder().With(trainerProfile).Build();
        var mongo = BuildMongo();

        var ep = CreateEndpoint(db, mongo, _trainerId);

        await ep.HandleAsync(new ListClientPlansRequest { ClientId = Guid.NewGuid() },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task List_NoTrainerProfile_Returns404()
    {
        // Trainer has no ProfessionalProfile
        var db = new MockDbBuilder().Build();
        var mongo = BuildMongo();

        var ep = CreateEndpoint(db, mongo, _trainerId);

        await ep.HandleAsync(new ListClientPlansRequest { ClientId = Guid.NewGuid() },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private ListClientPlansEndpoint CreateEndpoint(
        IApplicationDbContext db,
        IMongoContext mongo,
        Guid callerId,
        bool setupDefaultCompliance = true)
    {
        if (setupDefaultCompliance)
        {
            _complianceService
                .CalculateComplianceAsync(Arg.Any<Guid>(), Arg.Any<DateTime>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>())
                .Returns(new ComplianceResult
                {
                    NutritionCompliancePercent = 0m,
                    CompliancePercent = 0m
                });
        }

        return Factory.Create<ListClientPlansEndpoint>(
            ctx => ctx.Request.HttpContext.User = FakeTrainerPrincipal(callerId),
            db, mongo, _complianceService, _audit);
    }

    private (IApplicationDbContext db, Application.Domain.Entities.ClientProfile clientProfile)
        BuildLinkedClientSetup()
    {
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerId).Build();
        var clientUser = EntityBuilder.User.WithEmail("client@test.com").Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(10).WithUser(clientUser).Build();
        var link = EntityBuilder.ClientProfessionalLink
            .WithId(42)
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(trainerProfile)
            .Build();

        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(clientProfile)
            .With(link)
            .Build();

        return (db, clientProfile);
    }

    private static ClaimsPrincipal FakeTrainerPrincipal(Guid userId) =>
        new(new ClaimsIdentity(
            EndpointTestHelpers.FakeUserClaims(userId, AppRoles.Trainer)));

    // ── Mongo factory helpers ────────────────────────────────────────────────

    private static IMongoContext BuildMongo(
        IEnumerable<NutritionPlan>? nutritionPlans = null,
        IEnumerable<TrainingPlan>? trainingPlans = null,
        IEnumerable<WorkoutLog>? workoutLogs = null,
        IEnumerable<PersonalRecord>? personalRecords = null)
    {
        // Build collections first — never pass a NSubstitute setup call as an argument
        // to another Returns() call; NSubstitute's thread-local context would throw.
        var nutritionCollection = CreateMockCollection(nutritionPlans?.ToList() ?? []);
        var trainingCollection = CreateMockCollection(trainingPlans?.ToList() ?? []);
        var workoutCollection = CreateMockCollection(workoutLogs?.ToList() ?? []);
        var recordsCollection = CreateMockCollection(personalRecords?.ToList() ?? []);

        // SessionExecutions (#841) — ListClientPlansEndpoint computes TotalTrainings from
        // this unified collection exclusively (Status=Completed, Performance present, PlanId
        // matched), not the retired WorkoutLogs collection stubbed above for legacy call-site
        // compatibility. The endpoint's Mongo query applies the Status=Completed filter
        // server-side and only re-filters by PlanId client-side afterward — since this mock's
        // FindAsync ignores the filter argument entirely (see CreateMockCollection), the
        // Completed-only narrowing must happen HERE, at seed time, mirroring what the real
        // server-side filter would have already excluded.
        var executionDocs = (workoutLogs?.ToList() ?? [])
            .Where(l => l.IsCompleted)
            .Select(FitnessPlatform.Tests.Endpoints.ClientTraining.TrainingCompletionTestHelpers.ToSessionExecution)
            .ToList();
        var executionCollection = CreateMockCollection(executionDocs);

        var mongo = Substitute.For<IMongoContext>();
        mongo.NutritionPlans.Returns(nutritionCollection);
        mongo.TrainingPlans.Returns(trainingCollection);
        mongo.WorkoutLogs.Returns(workoutCollection);
        mongo.PersonalRecords.Returns(recordsCollection);
        mongo.SessionExecutions.Returns(executionCollection);
        return mongo;
    }

    private static IMongoCollection<T> CreateMockCollection<T>(List<T> docs)
    {
        var collection = Substitute.For<IMongoCollection<T>>();
        collection.FindAsync(
                Arg.Any<FilterDefinition<T>>(),
                Arg.Any<FindOptions<T, T>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateCursor(docs));
        return collection;
    }

    private static IAsyncCursor<T> CreateCursor<T>(List<T> docs)
    {
        var cursor = Substitute.For<IAsyncCursor<T>>();
        var moved = false;
        cursor.Current.Returns(docs);
        cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return docs.Count > 0;
        });
        cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return docs.Count > 0;
        });
        return cursor;
    }

    private static NutritionPlan CreateNutritionPlan(
        Guid clientId,
        Guid? externalId = null,
        DateTime? startDate = null,
        DateTime? dateCompleted = null,
        string name = "Test Nutrition Plan",
        NutritionPlanStatus status = NutritionPlanStatus.Active)
    {
        return new NutritionPlan
        {
            ExternalId = externalId ?? Guid.NewGuid(),
            ClientId = clientId,
            NutritionistId = Guid.NewGuid(),
            Name = name,
            Status = status,
            StartDate = startDate,
            DateCompleted = dateCompleted,
            DateCreated = startDate ?? DateTime.UtcNow.AddDays(-30),
            Version = 1
        };
    }

    private static TrainingPlan CreateTrainingPlan(
        Guid clientId,
        Guid? externalId = null,
        DateTime? startDate = null,
        DateTime? dateCompleted = null,
        string name = "Test Training Plan",
        TrainingPlanStatus status = TrainingPlanStatus.Active)
    {
        return new TrainingPlan
        {
            ExternalId = externalId ?? Guid.NewGuid(),
            ClientId = clientId,
            TrainerId = Guid.NewGuid(),
            Name = name,
            Status = status,
            StartDate = startDate,
            DateCompleted = dateCompleted,
            DateCreated = startDate ?? DateTime.UtcNow.AddDays(-30),
            Version = 1
        };
    }

    private static WorkoutLog CreateWorkoutLog(
        Guid clientId,
        Guid planId,
        bool isCompleted = true)
    {
        return new WorkoutLog
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientId,
            PlanId = planId,
            IsCompleted = isCompleted,
            StartedAt = DateTime.UtcNow.AddDays(-5),
            DateCreated = DateTime.UtcNow.AddDays(-5)
        };
    }

    private static PersonalRecord CreatePersonalRecord(
        Guid clientId,
        DateTime? achievedAt = null)
    {
        return new PersonalRecord
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientId,
            ExerciseExternalId = Guid.NewGuid(),
            ExerciseName = "Bench Press",
            WeightKg = 100m,
            Reps = 5,
            AchievedAt = achievedAt ?? DateTime.UtcNow.AddDays(-3),
            WorkoutLogId = Guid.NewGuid(),
            SetNumber = 1,
            DateCreated = DateTime.UtcNow.AddDays(-3)
        };
    }
}
