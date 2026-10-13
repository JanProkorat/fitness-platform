using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Trainers.GetClientDashboard;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Bson;

namespace FitnessPlatform.Tests.Endpoints.Trainers;

/// <summary>
/// The three coach client routes (dashboard, timeline, plan list) return a discipline's data only when the
/// link flag AND the caller's active coach role both allow it. A removed role still sits in the JWT, so the
/// role claim alone is not enough.
/// </summary>
[Collection(TestCollection.Name)]
public class ClientDisciplineRoleGateIntegrationTests(FitnessApiFactory factory)
{
    /// <summary>The role shapes a coach caller can have.</summary>
    public enum CoachShape
    {
        TrainerOnly,
        NutritionistOnly,
        DualBothActive,
        DualNutritionistRemoved,
        DualTrainerRemoved,
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() },
    };

    private static string UniqueEmail(string tag) => $"{Guid.NewGuid():N}@role-gate-{tag}.com";

    private Task<Actor> CreateCoachAsync(CoachShape shape, string tag)
    {
        var builder = shape switch
        {
            CoachShape.TrainerOnly => TestActors.Trainer(factory),
            CoachShape.NutritionistOnly => TestActors.Nutritionist(factory),
            CoachShape.DualNutritionistRemoved => TestActors.Professional(factory, UserRole.Trainer, UserRole.Nutritionist)
                .WithRemovedCoachRoles(UserRole.Nutritionist),
            CoachShape.DualTrainerRemoved => TestActors.Professional(factory, UserRole.Trainer, UserRole.Nutritionist)
                .WithRemovedCoachRoles(UserRole.Trainer),
            _ => TestActors.Professional(factory, UserRole.Trainer, UserRole.Nutritionist),
        };

        return builder.WithEmail(UniqueEmail(tag)).CreateAsync(TestContext.Current.CancellationToken);
    }

    private async Task<Actor> CreateLinkedClientAsync(Actor coach, bool nutrition, bool training)
    {
        var client = await TestActors.Client(factory)
            .WithEmail(UniqueEmail("client"))
            .CreateAsync(TestContext.Current.CancellationToken);

        await TestActors.Link(factory, coach, client)
            .CanViewNutritionPlans(nutrition)
            .CanViewTrainingPlans(training)
            .CreateAsync(TestContext.Current.CancellationToken);

        return client;
    }

    private async Task SeedBothDomainsAsync(Actor client, Actor coach)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        var start = DateTime.UtcNow.Date.AddDays(-14);

        await mongo.NutritionPlans.InsertOneAsync(new NutritionPlan
        {
            Id = ObjectId.GenerateNewId(),
            ExternalId = Guid.NewGuid(),
            ClientId = client.UserId,
            NutritionistId = coach.UserId,
            Name = "Gate Nutrition Plan",
            Status = NutritionPlanStatus.Active,
            StartDate = start,
            Weeks = [new PlanWeek { WeekNumber = 1, Status = WeekStatus.Published, DatePublished = start }],
            Version = 1,
            DateCreated = start,
        }, cancellationToken: TestContext.Current.CancellationToken);

        await mongo.TrainingPlans.InsertOneAsync(new TrainingPlan
        {
            Id = ObjectId.GenerateNewId(),
            ExternalId = Guid.NewGuid(),
            ClientId = client.UserId,
            TrainerId = coach.UserId,
            Name = "Gate Training Plan",
            Status = TrainingPlanStatus.Active,
            StartDate = start,
            Weeks = [new TrainingWeek { WeekNumber = 1, Status = WeekStatus.Published, DatePublished = start, Days = [] }],
            Version = 1,
            DateCreated = start,
        }, cancellationToken: TestContext.Current.CancellationToken);

        await mongo.MealLogs.InsertOneAsync(new MealLog
        {
            Id = ObjectId.GenerateNewId(),
            ClientId = client.UserId,
            PlanId = Guid.NewGuid(),
            MealId = Guid.NewGuid(),
            EatenAt = DateTime.UtcNow.AddDays(-1),
            FoodsEaten = [],
        }, cancellationToken: TestContext.Current.CancellationToken);

        await mongo.SessionExecutions.InsertOneAsync(new SessionExecution
        {
            Id = ObjectId.GenerateNewId(),
            ExternalId = Guid.NewGuid(),
            ClientId = client.UserId,
            Date = SessionExecution.ToCompletionDateUtc(DateTime.UtcNow.AddDays(-2)),
            Status = SessionExecutionStatus.Completed,
            Performance = new SessionExecutionPerformance
            {
                StartedAt = DateTime.UtcNow.AddDays(-2).AddMinutes(-30),
                CompletedAt = DateTime.UtcNow.AddDays(-2),
                Workouts = [],
            },
            DateCreated = DateTime.UtcNow,
        }, cancellationToken: TestContext.Current.CancellationToken);

        await mongo.PersonalRecords.InsertOneAsync(new PersonalRecord
        {
            Id = ObjectId.GenerateNewId(),
            ExternalId = Guid.NewGuid(),
            ClientId = client.UserId,
            ExerciseExternalId = Guid.NewGuid(),
            ExerciseName = "Squat",
            WeightKg = 120m,
            Reps = 5,
            AchievedAt = DateTime.UtcNow.AddDays(-3),
            WorkoutLogId = Guid.NewGuid(),
            SetNumber = 1,
            Version = 1,
            DateCreated = DateTime.UtcNow,
        }, cancellationToken: TestContext.Current.CancellationToken);

        var onboarding = new ClientOnboardingData
        {
            ClientProfileId = client.ProfileId,
            DateOfBirth = new DateTime(1995, 3, 12, 0, 0, 0, DateTimeKind.Utc),
            Sex = BiologicalSex.Male,
            HeightCm = 182,
            WeightKg = 84,
            TargetWeightKg = 78,
            BodyType = BodyType.Mesomorph,
            PrimaryGoal = PrimaryGoal.LoseFat,
            TimeHorizon = TimeHorizon.SixMonths,
            JobType = JobType.Sedentary,
            SleepHours = 7,
            StressLevel = 3,
            CurrentTrainingFrequency = CurrentTrainingFrequency.Regular,
            DesiredTrainingFrequency = DesiredTrainingFrequency.FourPerWeek,
            FitnessRating = 6,
            GymAccess = GymAccess.Yes,
            PreferredActivities = "strength,cardio",
            Injuries = "none",
            MealsPerDay = MealsPerDay.FourToFive,
            DietaryStyle = DietaryStyle.Standard,
            Allergies = "none",
            DietRating = 4,
            PlanExperience = PlanExperience.TriedFailed,
            PastBlockers = "time",
            PrimaryMotivation = PrimaryMotivation.Appearance,
        };
        db.ClientOnboardingData.Add(onboarding);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);

        db.ClientNutritionTargets.Add(new ClientNutritionTargets
        {
            ClientOnboardingDataId = onboarding.Id,
            DerivedActivityLevel = ActivityLevel.ModeratelyActive,
            DerivedNutritionGoal = NutritionGoal.Cut,
            Bmr = 1780,
            Tdee = 2670,
            AdjustedKcal = 2270,
            ProteinGrams = 190,
            CarbsGrams = 227,
            FatGrams = 63,
            MealDistribution = """{"breakfast":25,"lunch":30,"dinner":25,"snack1":10,"snack2":10}""",
        });
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    // ── effective flags per caller shape ─────────────────────────────────────

    [Theory]
    [InlineData(CoachShape.TrainerOnly, false, true)]
    [InlineData(CoachShape.NutritionistOnly, true, false)]
    [InlineData(CoachShape.DualBothActive, true, true)]
    [InlineData(CoachShape.DualNutritionistRemoved, false, true)]
    [InlineData(CoachShape.DualTrainerRemoved, true, false)]
    public async Task Dashboard_BothFlagsLink_ReturnsOnlyActiveRoleDisciplines(
        CoachShape shape, bool expectNutrition, bool expectTraining)
    {
        var coach = await CreateCoachAsync(shape, "dash");
        var client = await CreateLinkedClientAsync(coach, nutrition: true, training: true);
        await SeedBothDomainsAsync(client, coach);

        var response = await coach.Http.GetAsync(
            $"/trainer/clients/{client.PublicId}", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<GetClientDashboardResponse>(
            JsonOptions, TestContext.Current.CancellationToken);

        body!.CanViewNutritionPlans.Should().Be(expectNutrition);
        body.CanViewTrainingPlans.Should().Be(expectTraining);
        body.Onboarding.Should().NotBeNull();

        var onboarding = body.Onboarding!;

        if (expectNutrition)
        {
            onboarding.Bmr.Should().Be(1780);
            onboarding.DietaryStyle.Should().NotBeNull();
        }
        else
        {
            onboarding.Bmr.Should().BeNull();
            onboarding.Tdee.Should().BeNull();
            onboarding.AdjustedKcal.Should().BeNull();
            onboarding.ProteinGrams.Should().BeNull();
            onboarding.CarbsGrams.Should().BeNull();
            onboarding.FatGrams.Should().BeNull();
            onboarding.MealDistribution.Should().BeNull();
            onboarding.DietaryStyle.Should().BeNull();
            body.NutritionCompliancePercent.Should().BeNull();
        }

        if (expectTraining)
        {
            onboarding.CurrentTrainingFrequency.Should().NotBeNull();
        }
        else
        {
            onboarding.CurrentTrainingFrequency.Should().BeNull();
            onboarding.DesiredTrainingFrequency.Should().BeNull();
            body.TrainingCompliancePercent.Should().BeNull();
            body.SessionsPlannedThisWeek.Should().BeNull();
        }
    }

    [Theory]
    [InlineData(CoachShape.TrainerOnly, false, true)]
    [InlineData(CoachShape.NutritionistOnly, true, false)]
    [InlineData(CoachShape.DualBothActive, true, true)]
    [InlineData(CoachShape.DualNutritionistRemoved, false, true)]
    [InlineData(CoachShape.DualTrainerRemoved, true, false)]
    public async Task Timeline_BothFlagsLink_ReturnsOnlyActiveRoleDisciplines(
        CoachShape shape, bool expectNutrition, bool expectTraining)
    {
        var coach = await CreateCoachAsync(shape, "timeline");
        var client = await CreateLinkedClientAsync(coach, nutrition: true, training: true);
        await SeedBothDomainsAsync(client, coach);

        var response = await coach.Http.GetAsync(
            $"/trainer/clients/{client.PublicId}/timeline?limit=100", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<TimelineResponse>(
            JsonOptions, TestContext.Current.CancellationToken);

        body!.CanViewNutritionPlans.Should().Be(expectNutrition);
        body.CanViewTrainingPlans.Should().Be(expectTraining);

        var types = body.Items.Select(item => item.Type).ToList();

        types.Contains("meal_day").Should().Be(expectNutrition);
        types.Contains("nutrition_plan_published").Should().Be(expectNutrition);
        types.Contains("workout").Should().Be(expectTraining);
        types.Contains("training_plan_published").Should().Be(expectTraining);
        types.Contains("personal_record").Should().Be(expectTraining);
        types.Should().Contain("linked");
    }

    [Theory]
    [InlineData(CoachShape.TrainerOnly, false, true)]
    [InlineData(CoachShape.NutritionistOnly, true, false)]
    [InlineData(CoachShape.DualBothActive, true, true)]
    [InlineData(CoachShape.DualNutritionistRemoved, false, true)]
    [InlineData(CoachShape.DualTrainerRemoved, true, false)]
    public async Task ListPlans_BothFlagsLink_ReturnsOnlyActiveRoleDisciplines(
        CoachShape shape, bool expectNutrition, bool expectTraining)
    {
        var coach = await CreateCoachAsync(shape, "plans");
        var client = await CreateLinkedClientAsync(coach, nutrition: true, training: true);
        await SeedBothDomainsAsync(client, coach);

        var response = await coach.Http.GetAsync(
            $"/trainer/clients/{client.PublicId}/plans", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<PlansResponse>(
            JsonOptions, TestContext.Current.CancellationToken);

        body!.CanViewNutritionPlans.Should().Be(expectNutrition);
        body.CanViewTrainingPlans.Should().Be(expectTraining);

        var planTypes = body.Plans.Select(plan => plan.PlanType).ToList();

        planTypes.Contains("Nutrition").Should().Be(expectNutrition);
        planTypes.Contains("Training").Should().Be(expectTraining);
    }

    // ── 403 when no effective flag remains ───────────────────────────────────

    [Theory]
    [InlineData(CoachShape.TrainerOnly, true, false)]
    [InlineData(CoachShape.NutritionistOnly, false, true)]
    [InlineData(CoachShape.DualNutritionistRemoved, true, false)]
    [InlineData(CoachShape.DualTrainerRemoved, false, true)]
    public async Task Dashboard_LinkGrantsOnlyDisciplineCallerLacks_Returns403(
        CoachShape shape, bool linkNutrition, bool linkTraining)
    {
        var coach = await CreateCoachAsync(shape, "dash-403");
        var client = await CreateLinkedClientAsync(coach, linkNutrition, linkTraining);

        var response = await coach.Http.GetAsync(
            $"/trainer/clients/{client.PublicId}", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Theory]
    [InlineData(CoachShape.TrainerOnly, true, false)]
    [InlineData(CoachShape.NutritionistOnly, false, true)]
    [InlineData(CoachShape.DualNutritionistRemoved, true, false)]
    [InlineData(CoachShape.DualTrainerRemoved, false, true)]
    public async Task Timeline_LinkGrantsOnlyDisciplineCallerLacks_Returns403(
        CoachShape shape, bool linkNutrition, bool linkTraining)
    {
        var coach = await CreateCoachAsync(shape, "timeline-403");
        var client = await CreateLinkedClientAsync(coach, linkNutrition, linkTraining);

        var response = await coach.Http.GetAsync(
            $"/trainer/clients/{client.PublicId}/timeline", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Theory]
    [InlineData(CoachShape.TrainerOnly, true, false)]
    [InlineData(CoachShape.NutritionistOnly, false, true)]
    [InlineData(CoachShape.DualNutritionistRemoved, true, false)]
    [InlineData(CoachShape.DualTrainerRemoved, false, true)]
    public async Task ListPlans_LinkGrantsOnlyDisciplineCallerLacks_Returns403(
        CoachShape shape, bool linkNutrition, bool linkTraining)
    {
        var coach = await CreateCoachAsync(shape, "plans-403");
        var client = await CreateLinkedClientAsync(coach, linkNutrition, linkTraining);

        var response = await coach.Http.GetAsync(
            $"/trainer/clients/{client.PublicId}/plans", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    private record TimelineResponse(List<TimelineItem> Items, bool CanViewNutritionPlans, bool CanViewTrainingPlans);

    private record TimelineItem(string Id, string Type);

    private record PlansResponse(List<PlanItem> Plans, bool CanViewNutritionPlans, bool CanViewTrainingPlans);

    private record PlanItem(Guid PlanId, string PlanType);
}
