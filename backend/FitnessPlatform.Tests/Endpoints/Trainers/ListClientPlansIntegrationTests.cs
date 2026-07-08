using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Endpoints.ClientTraining;
using FitnessPlatform.Tests.Endpoints.NutritionPlans;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Bson;

namespace FitnessPlatform.Tests.Endpoints.Trainers;

/// <summary>
/// Integration tests for GET /trainer/clients/{clientId}/plans — issue #528.
///
/// Root cause: ListClientPlansEndpoint was filtering NutritionPlan.ClientId and
/// TrainingPlan.ClientId by clientProfile.UserId, but those fields store
/// clientProfile.PublicId. The result was always an empty list.
///
/// These tests use real PostgreSQL + MongoDB (Testcontainers) to validate
/// that plans are only found when ClientId == PublicId — not when it equals UserId.
/// A mock-based test cannot catch this bug because mocks ignore the filter value.
/// </summary>
[Collection(TestCollection.Name)]
public class ListClientPlansIntegrationTests(FitnessApiFactory factory)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private static string UniqueEmail(string tag) => $"{Guid.NewGuid():N}@listplans-{tag}.com";

    // ── helpers ───────────────────────────────────────────────────────────────

    private async Task<(HttpClient Http, long ProfessionalProfileId)> SetupTrainerAsync()
    {
        var http = factory.CreateClient();
        var email = UniqueEmail("trainer");

        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "Test", "Trainer", "Trainer");
        var (token, _) = await TestHelpers.LoginAsync(http, email, "TestPass1!");
        TestHelpers.SetBearerToken(http, token);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var user = await db.Users.FirstAsync(
            u => u.Email == email, TestContext.Current.CancellationToken);
        var profile = await db.ProfessionalProfiles.FirstAsync(
            p => p.UserId == user.Id, TestContext.Current.CancellationToken);

        return (http, profile.Id);
    }

    private async Task<(Guid ClientPublicId, long ClientProfileId, Guid ClientUserId)>
        SetupClientAsync()
    {
        var http = factory.CreateClient();
        var email = UniqueEmail("client");

        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "Test", "Client", "Client");
        await TestHelpers.LoginAsync(http, email, "TestPass1!");

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var user = await db.Users.FirstAsync(
            u => u.Email == email, TestContext.Current.CancellationToken);
        var profile = await db.ClientProfiles.FirstAsync(
            cp => cp.UserId == user.Id, TestContext.Current.CancellationToken);

        return (profile.PublicId, profile.Id, user.Id);
    }

    private async Task LinkTrainerToClientAsync(long trainerProfileId, long clientProfileId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        db.ClientProfessionalLinks.Add(new ClientProfessionalLink
        {
            PublicId = Guid.NewGuid(),
            ProfessionalProfileId = trainerProfileId,
            ClientProfileId = clientProfileId,
            ProfessionalRole = UserRole.Trainer,
            IsActive = true,
            CanViewTrainingPlans = true,
            CanViewNutritionPlans = true,
            DateCreated = DateTime.UtcNow,
        });

        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    // ── regression guard tests ────────────────────────────────────────────────

    /// <summary>
    /// Regression guard for #528: when a NutritionPlan is seeded with
    /// ClientId = clientProfile.PublicId (the correct key), the endpoint returns it.
    /// A test seeding with UserId would pass green even with the broken filter —
    /// this test would fail with the broken filter and pass with the fix.
    /// </summary>
    [Fact]
    public async Task Plans_SeededWithPublicId_AreReturnedByTrainer()
    {
        var (trainerHttp, trainerProfileId) = await SetupTrainerAsync();
        var (clientPublicId, clientProfileId, _) = await SetupClientAsync();
        await LinkTrainerToClientAsync(trainerProfileId, clientProfileId);

        // Seed a NutritionPlan with ClientId = PublicId (the correct key)
        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            await mongo.NutritionPlans.InsertOneAsync(new NutritionPlan
            {
                Id = ObjectId.GenerateNewId(),
                ExternalId = Guid.NewGuid(),
                ClientId = clientPublicId,   // ← MUST be PublicId, not UserId
                NutritionistId = Guid.NewGuid(),
                Name = "Test Plan PublicId",
                Status = NutritionPlanStatus.Active,
                StartDate = DateTime.UtcNow.AddDays(-7),
                Weeks = [],
                Version = 1,
                DateCreated = DateTime.UtcNow,
            }, cancellationToken: TestContext.Current.CancellationToken);
        }

        var response = await trainerHttp.GetAsync(
            $"/trainer/clients/{clientPublicId}/plans",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<PlansResponse>(
            JsonOptions, cancellationToken: TestContext.Current.CancellationToken);

        body!.Plans.Should().HaveCountGreaterThanOrEqualTo(1,
            "the plan seeded with ClientId = PublicId must appear in the list");
        body.Plans.Should().Contain(p => p.Name == "Test Plan PublicId");
    }

    /// <summary>
    /// Regression guard for #528: a plan seeded with ClientId = UserId (the WRONG key,
    /// the old bug) must NOT appear in the response. Without this guard, a test
    /// seeding with UserId would still pass green while production (which uses PublicId)
    /// would silently return zero plans.
    /// </summary>
    [Fact]
    public async Task Plans_SeededWithUserIdInsteadOfPublicId_AreNotReturned()
    {
        var (trainerHttp, trainerProfileId) = await SetupTrainerAsync();
        var (clientPublicId, clientProfileId, clientUserId) = await SetupClientAsync();
        await LinkTrainerToClientAsync(trainerProfileId, clientProfileId);

        // Seed a NutritionPlan with ClientId = UserId (wrong key — the old bug)
        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            await mongo.NutritionPlans.InsertOneAsync(new NutritionPlan
            {
                Id = ObjectId.GenerateNewId(),
                ExternalId = Guid.NewGuid(),
                ClientId = clientUserId,   // ← WRONG: UserId not PublicId
                NutritionistId = Guid.NewGuid(),
                Name = "WrongKey Plan UserId",
                Status = NutritionPlanStatus.Active,
                StartDate = DateTime.UtcNow.AddDays(-7),
                Weeks = [],
                Version = 1,
                DateCreated = DateTime.UtcNow,
            }, cancellationToken: TestContext.Current.CancellationToken);
        }

        var response = await trainerHttp.GetAsync(
            $"/trainer/clients/{clientPublicId}/plans",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<PlansResponse>(
            JsonOptions, cancellationToken: TestContext.Current.CancellationToken);

        body!.Plans.Should().NotContain(p => p.Name == "WrongKey Plan UserId",
            "a plan whose ClientId is UserId (not PublicId) must not match the filter");
    }

    /// <summary>
    /// Regression guard for #650: ListClientPlansEndpoint:198 was passing
    /// <c>clientUserId</c> instead of <c>clientPublicId</c> to
    /// <see cref="IComplianceService.CalculateComplianceAsync"/>. Because
    /// NutritionPlan.ClientId and MealLog.ClientId are both keyed on PublicId,
    /// the compliance lookup silently found no active plan and no logs, forcing
    /// nutrition compliance to 0% regardless of real adherence. This test seeds a
    /// real, published nutrition plan and a matching meal log — both keyed on
    /// PublicId — through the real (unmocked) ComplianceService, and asserts the
    /// endpoint's HTTP response reports non-zero compliance.
    /// </summary>
    [Fact]
    public async Task Plans_AdheredNutritionPlanWithMealLogsOnPublicId_ReportsNonZeroNutritionCompliance()
    {
        var (trainerHttp, trainerProfileId) = await SetupTrainerAsync();
        var (clientPublicId, clientProfileId, _) = await SetupClientAsync();
        await LinkTrainerToClientAsync(trainerProfileId, clientProfileId);

        var today = DateTime.UtcNow.Date;
        var dow = (int)today.DayOfWeek;
        dow = dow == 0 ? 7 : dow;
        var mondayThisWeek = today.AddDays(-(dow - 1));

        var plan = PlanTestHelpers.CreatePlan(
            clientId: clientPublicId,
            status: NutritionPlanStatus.Active,
            weekCount: 1,
            name: "Adhered Nutrition Plan");
        plan.Id = ObjectId.GenerateNewId();
        plan.DatePublished = mondayThisWeek;
        plan.StartDate = mondayThisWeek;
        plan.Weeks[0].Status = WeekStatus.Published;
        plan.Weeks[0].DatePublished = mondayThisWeek;
        plan.Weeks[0].Days[dow - 1].Meals = [PlanTestHelpers.CreateMeal(kind: MealKind.Breakfast)];

        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            await mongo.NutritionPlans.InsertOneAsync(
                plan, cancellationToken: TestContext.Current.CancellationToken);

            // MealLog.ClientId is keyed on ClientProfile.PublicId — matches the plan.
            await mongo.MealLogs.InsertOneAsync(new MealLog
            {
                Id = ObjectId.GenerateNewId(),
                ClientId = clientPublicId,
                PlanId = plan.ExternalId,
                MealId = plan.Weeks[0].Days[dow - 1].Meals[0].MealId,
                EatenAt = DateTime.UtcNow,
                FoodsEaten = [],
            }, cancellationToken: TestContext.Current.CancellationToken);
        }

        var response = await trainerHttp.GetAsync(
            $"/trainer/clients/{clientPublicId}/plans",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<PlansResponse>(
            JsonOptions, cancellationToken: TestContext.Current.CancellationToken);

        var planItem = body!.Plans.Single(p => p.Name == "Adhered Nutrition Plan");
        planItem.ResultSummary.CompliancePercent.Should().NotBeNull()
            .And.NotBe(0m, "the client logged the planned meal — compliance must not be 0%");
    }

    /// <summary>
    /// Regression guard for #650: proves the same PublicId key fix also yields non-zero
    /// TRAINING compliance from the real (unmocked) ComplianceService — the design review
    /// for #650 explicitly called out that <c>CalculateComplianceAsync</c> computes both
    /// nutrition and training percentages from the caller-supplied id, so passing UserId
    /// forced BOTH to 0%, not just nutrition. ListClientPlansEndpoint only surfaces
    /// NutritionCompliancePercent in its response DTO (training-plan items never carry a
    /// CompliancePercent), so this test calls the real, unmodified IComplianceService
    /// directly with clientPublicId to verify the underlying computation — the same
    /// dependency ListClientPlansEndpoint now calls correctly.
    /// </summary>
    [Fact]
    public async Task ComplianceService_CalledWithPublicIdAndCompletedSession_ReportsNonZeroTrainingCompliance()
    {
        var (clientPublicId, _, _) = await SetupClientAsync();

        using var scope = factory.Services.CreateScope();

        var sessionId = Guid.NewGuid();
        var exerciseIds = new List<Guid> { Guid.NewGuid(), Guid.NewGuid() };

        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: clientPublicId,
            sessionId: sessionId,
            exerciseIds: exerciseIds);
        plan.Id = ObjectId.GenerateNewId();

        // The plan's Monday session (DayOfWeek == 1) always uses `sessionId` regardless of
        // "today" — evaluate compliance for that single day to avoid weekday flakiness.
        var mondaySession = plan.StartDate!.Value;

        var completion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: clientPublicId,
            sessionId: sessionId,
            date: mondaySession,
            completedExerciseIds: exerciseIds);
        completion.Id = ObjectId.GenerateNewId();

        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        await mongo.TrainingPlans.InsertOneAsync(
            plan, cancellationToken: TestContext.Current.CancellationToken);
        await mongo.TrainingCompletions.InsertOneAsync(
            completion, cancellationToken: TestContext.Current.CancellationToken);

        var complianceService = scope.ServiceProvider.GetRequiredService<IComplianceService>();
        var result = await complianceService.CalculateComplianceAsync(
            clientPublicId, mondaySession, mondaySession, TestContext.Current.CancellationToken);

        result.TrainingCompliancePercent.Should().BeGreaterThan(0m,
            "the client completed the only planned session for that day — training compliance must not be 0%");
    }

    // ── DTOs for deserialization ──────────────────────────────────────────────

    private record PlansResponse(List<PlanItem> Plans);

    private record PlanItem(
        Guid PlanId,
        string PlanType,
        string Name,
        string Status,
        DateTime? PeriodStart,
        DateTime? PeriodEnd,
        ResultSummary ResultSummary);

    private record ResultSummary(
        int? TotalTrainings,
        int? PrCount,
        decimal? CompliancePercent,
        decimal? WeightDeltaKg);
}
