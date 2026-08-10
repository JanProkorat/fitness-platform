using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Bson;

namespace FitnessPlatform.Tests.Endpoints.Authorization;

/// <summary>
/// Regression tests for #916 — three trainer-facing endpoints
/// (<c>ListClientPlansEndpoint</c>, <c>GetClientTimelineEndpoint</c>,
/// <c>GetClientDashboardEndpoint</c>) gated on <see cref="ClientProfessionalLink.IsActive"/>
/// alone and returned both nutrition- and training-domain data regardless of the link's
/// <c>CanViewNutritionPlans</c> / <c>CanViewTrainingPlans</c> flags. A professional whose
/// link carries only one capability flag must never receive the other domain's data.
/// <para>
/// Mirrors the fixture shape of <see cref="CrossRoleLinkAccessTests"/> (#903) — register a
/// professional and a client, stamp a <see cref="ClientProfessionalLink"/> with explicit
/// capability flags, then assert what each endpoint returns.
/// </para>
/// </summary>
[Collection(TestCollection.Name)]
public class CrossDomainPlanAccessTests(FitnessApiFactory factory)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private static string UniqueEmail(string tag) => $"{Guid.NewGuid():N}@cross-domain-{tag}.com";

    // ── shared fixture helpers (mirrors CrossRoleLinkAccessTests) ────────────

    private async Task<(HttpClient Http, long ProfessionalProfileId, Guid ProfessionalUserId)> RegisterProfessionalAsync(string tag)
    {
        var client = factory.CreateClient();
        var email = UniqueEmail(tag);
        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Test", "Trainer", "Trainer");
        var (token, _) = await TestHelpers.LoginAsync(client, email, "TestPass1!");
        TestHelpers.SetBearerToken(client, token);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.FirstAsync(u => u.Email == email, TestContext.Current.CancellationToken);
        var profile = await db.ProfessionalProfiles.FirstAsync(
            p => p.UserId == user.Id, TestContext.Current.CancellationToken);

        return (client, profile.Id, user.Id);
    }

    private async Task<(Guid ClientPublicId, long ClientProfileId, Guid ClientUserId)> RegisterClientAsync(string tag)
    {
        var client = factory.CreateClient();
        var email = UniqueEmail(tag);
        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Test", "Client", "Client");
        await TestHelpers.LoginAsync(client, email, "TestPass1!");

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.FirstAsync(u => u.Email == email, TestContext.Current.CancellationToken);
        var profile = await db.ClientProfiles.FirstAsync(
            cp => cp.UserId == user.Id, TestContext.Current.CancellationToken);

        return (profile.PublicId, profile.Id, user.Id);
    }

    /// <summary>
    /// Inserts an active <see cref="ClientProfessionalLink"/> directly with the given
    /// capability flags and returns the created link's internal id (needed for
    /// <see cref="QuestionnaireResponse.LinkId"/> seeding).
    /// </summary>
    private async Task<long> LinkAsync(
        long professionalProfileId, long clientProfileId, bool canViewNutritionPlans, bool canViewTrainingPlans)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var link = new ClientProfessionalLink
        {
            PublicId = Guid.NewGuid(),
            ProfessionalProfileId = professionalProfileId,
            ClientProfileId = clientProfileId,
            ProfessionalRole = UserRole.Trainer,
            IsActive = true,
            CanViewNutritionPlans = canViewNutritionPlans,
            CanViewTrainingPlans = canViewTrainingPlans,
            DateCreated = DateTime.UtcNow
        };
        db.ClientProfessionalLinks.Add(link);

        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        return link.Id;
    }

    /// <summary>
    /// Seeds one nutrition plan, one training plan, a meal log, a completed workout
    /// (SessionExecution), a personal record, a body measurement, and a submitted
    /// questionnaire response for the given client — enough source data for every
    /// timeline entry type and both ListClientPlans plan types to be exercised.
    /// </summary>
    private async Task SeedBothDomainsAsync(
        Guid clientUserId, long clientProfileId, Guid professionalUserId, long linkId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();

        var start = DateTime.UtcNow.Date.AddDays(-14);

        await mongo.NutritionPlans.InsertOneAsync(new NutritionPlan
        {
            Id = ObjectId.GenerateNewId(),
            ExternalId = Guid.NewGuid(),
            ClientId = clientUserId,
            NutritionistId = professionalUserId,
            Name = "Cross-Domain Nutrition Plan",
            Status = NutritionPlanStatus.Active,
            StartDate = start,
            DatePublished = start,
            Weeks = [],
            Version = 1,
            DateCreated = start,
        }, cancellationToken: TestContext.Current.CancellationToken);

        await mongo.TrainingPlans.InsertOneAsync(new TrainingPlan
        {
            Id = ObjectId.GenerateNewId(),
            ExternalId = Guid.NewGuid(),
            ClientId = clientUserId,
            TrainerId = professionalUserId,
            Name = "Cross-Domain Training Plan",
            Status = TrainingPlanStatus.Active,
            StartDate = start,
            DatePublished = start,
            Weeks = [],
            Version = 1,
            DateCreated = start,
        }, cancellationToken: TestContext.Current.CancellationToken);

        await mongo.MealLogs.InsertOneAsync(new MealLog
        {
            Id = ObjectId.GenerateNewId(),
            ClientId = clientUserId,
            PlanId = Guid.NewGuid(),
            MealId = Guid.NewGuid(),
            EatenAt = DateTime.UtcNow.AddDays(-1),
            FoodsEaten = [],
        }, cancellationToken: TestContext.Current.CancellationToken);

        await mongo.SessionExecutions.InsertOneAsync(new SessionExecution
        {
            Id = ObjectId.GenerateNewId(),
            ExternalId = Guid.NewGuid(),
            ClientId = clientUserId,
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
            ClientId = clientUserId,
            ExerciseExternalId = Guid.NewGuid(),
            ExerciseName = "Bench Press",
            WeightKg = 100m,
            Reps = 5,
            AchievedAt = DateTime.UtcNow.AddDays(-3),
            WorkoutLogId = Guid.NewGuid(),
            SetNumber = 1,
            Version = 1,
            DateCreated = DateTime.UtcNow,
        }, cancellationToken: TestContext.Current.CancellationToken);

        db.BodyMeasurements.Add(new BodyMeasurement
        {
            PublicId = Guid.NewGuid(),
            ClientProfileId = clientProfileId,
            MeasuredAt = DateTime.UtcNow.AddDays(-4),
            WeightKg = 78m,
        });

        var questionnaire = new Questionnaire
        {
            PublicId = Guid.NewGuid(),
            ProfessionalId = professionalUserId,
            Title = "Cross-Domain Questionnaire",
            IsActive = true,
            DateCreated = DateTime.UtcNow,
        };
        db.Questionnaires.Add(questionnaire);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);

        db.QuestionnaireResponses.Add(new QuestionnaireResponse
        {
            PublicId = Guid.NewGuid(),
            QuestionnaireId = questionnaire.Id,
            ClientId = clientUserId,
            ProfessionalId = professionalUserId,
            LinkId = linkId,
            Status = QuestionnaireResponseStatus.Submitted,
            SubmittedAt = DateTime.UtcNow.AddDays(-5),
            DateCreated = DateTime.UtcNow,
        });

        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    // ── neither-flag denial (AC4) ─────────────────────────────────────────────

    [Fact]
    public async Task ActiveLinkWithNeitherCapability_ListClientPlans_Returns403()
    {
        var (professional, professionalProfileId, professionalUserId) = await RegisterProfessionalAsync("neither-list");
        var (clientPublicId, clientProfileId, _) = await RegisterClientAsync("neither-list");
        await LinkAsync(professionalProfileId, clientProfileId, canViewNutritionPlans: false, canViewTrainingPlans: false);

        var response = await professional.GetAsync($"/trainer/clients/{clientPublicId}/plans");

        response.StatusCode.Should().Be(
            HttpStatusCode.Forbidden,
            "an active link granting neither capability flag must deny outright, matching HasAnyPlanAccessAsync semantics from #903");
    }

    [Fact]
    public async Task ActiveLinkWithNeitherCapability_GetClientTimeline_Returns403()
    {
        var (professional, professionalProfileId, professionalUserId) = await RegisterProfessionalAsync("neither-timeline");
        var (clientPublicId, clientProfileId, _) = await RegisterClientAsync("neither-timeline");
        await LinkAsync(professionalProfileId, clientProfileId, canViewNutritionPlans: false, canViewTrainingPlans: false);

        var response = await professional.GetAsync($"/trainer/clients/{clientPublicId}/timeline");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task ActiveLinkWithNeitherCapability_GetClientDashboard_Returns403()
    {
        var (professional, professionalProfileId, professionalUserId) = await RegisterProfessionalAsync("neither-dashboard");
        var (clientPublicId, clientProfileId, _) = await RegisterClientAsync("neither-dashboard");
        await LinkAsync(professionalProfileId, clientProfileId, canViewNutritionPlans: false, canViewTrainingPlans: false);

        var response = await professional.GetAsync($"/trainer/clients/{clientPublicId}");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ── ListClientPlans — single-flag domain filtering ────────────────────────

    [Fact]
    public async Task NutritionOnlyLink_ListClientPlans_ReturnsOnlyNutritionPlans()
    {
        var (professional, professionalProfileId, professionalUserId) = await RegisterProfessionalAsync("nutrition-only-list");
        var (clientPublicId, clientProfileId, clientUserId) = await RegisterClientAsync("nutrition-only-list");
        var linkId = await LinkAsync(professionalProfileId, clientProfileId, canViewNutritionPlans: true, canViewTrainingPlans: false);

        await SeedBothDomainsAsync(clientUserId, clientProfileId, professionalUserId, linkId);

        var response = await professional.GetAsync($"/trainer/clients/{clientPublicId}/plans");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<PlansResponse>(
            JsonOptions, TestContext.Current.CancellationToken);

        body!.CanViewNutritionPlans.Should().BeTrue();
        body.CanViewTrainingPlans.Should().BeFalse();
        body.Plans.Should().NotBeEmpty();
        body.Plans.Should().OnlyContain(p => p.PlanType == "Nutrition",
            "a nutrition-only link must never receive training plan items");
    }

    [Fact]
    public async Task TrainingOnlyLink_ListClientPlans_ReturnsOnlyTrainingPlans()
    {
        var (professional, professionalProfileId, professionalUserId) = await RegisterProfessionalAsync("training-only-list");
        var (clientPublicId, clientProfileId, clientUserId) = await RegisterClientAsync("training-only-list");
        var linkId = await LinkAsync(professionalProfileId, clientProfileId, canViewNutritionPlans: false, canViewTrainingPlans: true);

        await SeedBothDomainsAsync(clientUserId, clientProfileId, professionalUserId, linkId);

        var response = await professional.GetAsync($"/trainer/clients/{clientPublicId}/plans");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<PlansResponse>(
            JsonOptions, TestContext.Current.CancellationToken);

        body!.CanViewNutritionPlans.Should().BeFalse();
        body.CanViewTrainingPlans.Should().BeTrue();
        body.Plans.Should().NotBeEmpty();
        body.Plans.Should().OnlyContain(p => p.PlanType == "Training",
            "a training-only link must never receive nutrition plan items");
    }

    [Fact]
    public async Task BothFlagsLink_ListClientPlans_ReturnsBothPlanTypes()
    {
        // Regression guard — a fully-entitled caller's response must be additive/unchanged.
        var (professional, professionalProfileId, professionalUserId) = await RegisterProfessionalAsync("both-flags-list");
        var (clientPublicId, clientProfileId, clientUserId) = await RegisterClientAsync("both-flags-list");
        var linkId = await LinkAsync(professionalProfileId, clientProfileId, canViewNutritionPlans: true, canViewTrainingPlans: true);

        await SeedBothDomainsAsync(clientUserId, clientProfileId, professionalUserId, linkId);

        var response = await professional.GetAsync($"/trainer/clients/{clientPublicId}/plans");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<PlansResponse>(
            JsonOptions, TestContext.Current.CancellationToken);

        body!.CanViewNutritionPlans.Should().BeTrue();
        body.CanViewTrainingPlans.Should().BeTrue();
        body.Plans.Should().Contain(p => p.PlanType == "Nutrition");
        body.Plans.Should().Contain(p => p.PlanType == "Training");
    }

    // ── GetClientTimeline — single-flag domain filtering + dual-readable classification ──

    [Fact]
    public async Task NutritionOnlyLink_GetClientTimeline_ExcludesTrainingEntries_KeepsDualReadableEntries()
    {
        var (professional, professionalProfileId, professionalUserId) = await RegisterProfessionalAsync("nutrition-only-timeline");
        var (clientPublicId, clientProfileId, clientUserId) = await RegisterClientAsync("nutrition-only-timeline");
        var linkId = await LinkAsync(professionalProfileId, clientProfileId, canViewNutritionPlans: true, canViewTrainingPlans: false);

        await SeedBothDomainsAsync(clientUserId, clientProfileId, professionalUserId, linkId);

        var response = await professional.GetAsync($"/trainer/clients/{clientPublicId}/timeline?limit=100");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<TimelineResponse>(
            JsonOptions, TestContext.Current.CancellationToken);

        body!.CanViewNutritionPlans.Should().BeTrue();
        body.CanViewTrainingPlans.Should().BeFalse();

        var types = body.Items.Select(i => i.Type).ToList();

        types.Should().Contain("meal_day");
        types.Should().Contain("nutrition_plan_published");
        types.Should().NotContain("workout", "training-domain entries must not leak to a nutrition-only link");
        types.Should().NotContain("training_plan_published", "training-domain entries must not leak to a nutrition-only link");
        types.Should().NotContain("personal_record", "training-domain entries must not leak to a nutrition-only link");

        // Dual-readable standalone entries — classification rule (#916): these are NOT
        // attached to a nutrition or training item, so they survive in BOTH directions.
        types.Should().Contain("measurement", "measurements are dual-readable, not nutrition-scoped");
        types.Should().Contain("questionnaire", "questionnaire responses are dual-readable");
        types.Should().Contain("linked", "the link event is dual-readable");
    }

    [Fact]
    public async Task TrainingOnlyLink_GetClientTimeline_ExcludesNutritionEntries_KeepsDualReadableEntries()
    {
        var (professional, professionalProfileId, professionalUserId) = await RegisterProfessionalAsync("training-only-timeline");
        var (clientPublicId, clientProfileId, clientUserId) = await RegisterClientAsync("training-only-timeline");
        var linkId = await LinkAsync(professionalProfileId, clientProfileId, canViewNutritionPlans: false, canViewTrainingPlans: true);

        await SeedBothDomainsAsync(clientUserId, clientProfileId, professionalUserId, linkId);

        var response = await professional.GetAsync($"/trainer/clients/{clientPublicId}/timeline?limit=100");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<TimelineResponse>(
            JsonOptions, TestContext.Current.CancellationToken);

        body!.CanViewNutritionPlans.Should().BeFalse();
        body.CanViewTrainingPlans.Should().BeTrue();

        var types = body.Items.Select(i => i.Type).ToList();

        types.Should().Contain("workout");
        types.Should().Contain("training_plan_published");
        types.Should().Contain("personal_record");
        types.Should().NotContain("meal_day", "nutrition-domain entries must not leak to a training-only link");
        types.Should().NotContain("nutrition_plan_published", "nutrition-domain entries must not leak to a training-only link");

        // Dual-readable standalone entries — classification rule (#916): must remain
        // visible in this direction too.
        types.Should().Contain("measurement", "measurements are dual-readable, not training-scoped");
        types.Should().Contain("questionnaire", "questionnaire responses are dual-readable");
        types.Should().Contain("linked", "the link event is dual-readable");
    }

    [Fact]
    public async Task BothFlagsLink_GetClientTimeline_ReturnsAllEightEntryTypes()
    {
        // Regression guard — a fully-entitled caller's timeline must be unchanged.
        var (professional, professionalProfileId, professionalUserId) = await RegisterProfessionalAsync("both-flags-timeline");
        var (clientPublicId, clientProfileId, clientUserId) = await RegisterClientAsync("both-flags-timeline");
        var linkId = await LinkAsync(professionalProfileId, clientProfileId, canViewNutritionPlans: true, canViewTrainingPlans: true);

        await SeedBothDomainsAsync(clientUserId, clientProfileId, professionalUserId, linkId);

        var response = await professional.GetAsync($"/trainer/clients/{clientPublicId}/timeline?limit=100");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<TimelineResponse>(
            JsonOptions, TestContext.Current.CancellationToken);

        body!.CanViewNutritionPlans.Should().BeTrue();
        body.CanViewTrainingPlans.Should().BeTrue();

        var types = body.Items.Select(i => i.Type).ToHashSet();
        types.Should().Contain(new[]
        {
            "meal_day", "nutrition_plan_published",
            "workout", "training_plan_published", "personal_record",
            "measurement", "questionnaire", "linked"
        });
    }

    // ── local response DTOs ────────────────────────────────────────────────────

    private record PlansResponse(List<PlanItem> Plans, bool CanViewNutritionPlans, bool CanViewTrainingPlans);

    private record PlanItem(Guid PlanId, string PlanType, string Name, string Status);

    private record TimelineResponse(List<TimelineItem> Items, bool CanViewNutritionPlans, bool CanViewTrainingPlans);

    private record TimelineItem(string Id, string Type, DateTime OccurredAt);
}
