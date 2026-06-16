using FluentAssertions;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Driver;
using Npgsql;
using Testcontainers.MongoDb;
using Testcontainers.PostgreSql;

namespace FitnessPlatform.Tests.Services;

/// <summary>
/// Testcontainers integration tests for <see cref="PlanGoalBackfillService"/>.
///
/// Boots real PostgreSQL (all EF migrations applied) and MongoDB containers,
/// seeds minimal data, then verifies that the backfill correctly copies
/// <c>PrimaryGoal</c> and <c>TargetWeightKg</c> from
/// <c>ClientOnboardingData</c> into <c>NutritionPlan</c> and
/// <c>TrainingPlan</c> documents, and that a second run is a no-op.
///
/// Join key: <c>plan.ClientId</c> == <c>ClientProfile.PublicId</c> — NOT
/// <c>ClientProfile.UserId</c> (ApplicationUser.Id). Plans are written by
/// <c>CreatePlanEndpoint</c> with <c>plan.ClientId = clientProfile.PublicId</c>.
/// </summary>
public class PlanGoalBackfillServiceTests : IAsyncLifetime
{
    // Wide timeout to tolerate Docker contention on the dev machine (see #336).
    private static readonly TimeSpan StartupTimeout = TimeSpan.FromSeconds(180);

    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:16").Build();
    private readonly MongoDbContainer   _mongo    = new MongoDbBuilder("mongo:7").Build();

    private ApplicationDbContext _db       = null!;
    private IMongoContext        _mongoCtx = null!;

    // ── IAsyncLifetime ────────────────────────────────────────────────────────

    public async ValueTask InitializeAsync()
    {
        using var cts = new CancellationTokenSource(StartupTimeout);
        await Task.WhenAll(_postgres.StartAsync(cts.Token), _mongo.StartAsync(cts.Token));

        _db = BuildDbContext(_postgres.GetConnectionString());
        await _db.Database.MigrateAsync(TestContext.Current.CancellationToken);

        var mongoClient = new MongoClient(_mongo.GetConnectionString());
        var mongoDb     = mongoClient.GetDatabase("fitness_plan_goal_backfill_test");
        _mongoCtx = new MongoContext(mongoDb);
    }

    public async ValueTask DisposeAsync()
    {
        await _db.DisposeAsync();
        await Task.WhenAll(
            _postgres.DisposeAsync().AsTask(),
            _mongo.DisposeAsync().AsTask());
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private static ApplicationDbContext BuildDbContext(string connectionString)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(connectionString)
            .UseSnakeCaseNamingConvention()
            .ConfigureWarnings(w =>
                w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning))
            .Options;
        return new ApplicationDbContext(options);
    }

    /// <summary>
    /// Inserts a minimal user + client_profile + client_onboarding_data row via raw SQL.
    /// Returns (UserId, PublicId, ClientProfileId) so callers can seed Mongo plans with
    /// the correct <c>plan.ClientId = publicId</c> (matching what CreatePlanEndpoint writes).
    /// </summary>
    private async Task<(Guid UserId, Guid PublicId, long ClientProfileId)> SeedUserWithOnboardingAsync(
        PrimaryGoal goal,
        decimal? targetWeightKg)
    {
        var ct       = TestContext.Current.CancellationToken;
        var userId   = Guid.NewGuid();
        var publicId = Guid.NewGuid();

        await using var conn = new NpgsqlConnection(_postgres.GetConnectionString());
        await conn.OpenAsync(ct);

        // Insert user
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = @"
                INSERT INTO users (
                    id, user_name, normalized_user_name,
                    email, normalized_email, email_confirmed,
                    password_hash, security_stamp, concurrency_stamp,
                    phone_number_confirmed, two_factor_enabled,
                    lockout_enabled, access_failed_count,
                    first_name, last_name, is_active, date_created,
                    gdpr_consent, verification_emails_sent, time_zone
                ) VALUES (
                    @id, @email, @emailUpper,
                    @email, @emailUpper, true,
                    '', gen_random_uuid()::text, gen_random_uuid()::text,
                    false, false,
                    true, 0,
                    'Test', 'User', true, now(),
                    true, 0, 'Europe/Prague'
                )";
            cmd.Parameters.AddWithValue("id",         userId);
            cmd.Parameters.AddWithValue("email",      $"{userId:N}@goal-backfill-test.com");
            cmd.Parameters.AddWithValue("emailUpper", $"{userId:N}@GOAL-BACKFILL-TEST.COM");
            await cmd.ExecuteNonQueryAsync(ct);
        }

        // Insert client_profile — capture the generated public_id
        long clientProfileId;
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = @"
                INSERT INTO client_profiles (user_id, public_id, date_created, is_onboarding_complete)
                VALUES (@userId, @publicId, now(), true)
                RETURNING id";
            cmd.Parameters.AddWithValue("userId",   userId);
            cmd.Parameters.AddWithValue("publicId", publicId);
            clientProfileId = (long)(await cmd.ExecuteScalarAsync(ct))!;
        }

        // Insert client_onboarding_data (many NOT NULL columns)
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = @"
                INSERT INTO client_onboarding_data (
                    client_profile_id, date_of_birth, sex, height_cm, weight_kg,
                    body_type, primary_goal, time_horizon, job_type, sleep_hours,
                    stress_level, current_training_frequency, desired_training_frequency,
                    fitness_rating, gym_access, preferred_activities, injuries,
                    meals_per_day, dietary_style, allergies, diet_rating,
                    plan_experience, past_blockers, primary_motivation,
                    derived_activity_level, derived_nutrition_goal,
                    bmr, tdee, adjusted_kcal, protein_grams, carbs_grams, fat_grams,
                    target_weight_kg, date_created
                ) VALUES (
                    @clientProfileId, '2000-01-01', 0, 175, 75,
                    0, @goal, 0, 0, 7,
                    3, 0, 0,
                    6, 0, 'strength', 'none',
                    0, 0, 'none', 3,
                    0, 'none', 0,
                    0, 0,
                    1800, 2200, 2000, 150, 220, 60,
                    @targetWeightKg, now()
                )";
            cmd.Parameters.AddWithValue("clientProfileId", clientProfileId);
            cmd.Parameters.AddWithValue("goal",            (int)goal);
            cmd.Parameters.AddWithValue("targetWeightKg",
                targetWeightKg.HasValue ? (object)targetWeightKg.Value : DBNull.Value);
            await cmd.ExecuteNonQueryAsync(ct);
        }

        return (userId, publicId, clientProfileId);
    }

    private PlanGoalBackfillService BuildSut()
    {
        // Rebuild DbContext for a clean tracked-entity cache each call.
        _db.Dispose();
        _db = BuildDbContext(_postgres.GetConnectionString());

        return new PlanGoalBackfillService(
            _db,
            _mongoCtx,
            NullLogger<PlanGoalBackfillService>.Instance);
    }

    // ── tests ─────────────────────────────────────────────────────────────────

    /// <summary>
    /// A NutritionPlan with null Goal/TargetWeightKg and a matching client
    /// onboarding entry → backfill populates both fields, second run is a no-op.
    /// Join key is PublicId (not UserId).
    /// </summary>
    [Fact]
    public async Task BackfillAsync_NutritionPlan_CopiesGoalAndTarget_AndIsIdempotent()
    {
        var ct = TestContext.Current.CancellationToken;

        var (_, publicId, _) = await SeedUserWithOnboardingAsync(PrimaryGoal.LoseFat, 70.0m);

        // Insert a NutritionPlan with null goal/targetWeightKg.
        // plan.ClientId = publicId, matching what CreatePlanEndpoint writes.
        var plan = new NutritionPlan
        {
            ExternalId    = Guid.NewGuid(),
            ClientId      = publicId,        // CRITICAL: must equal ClientProfile.PublicId
            NutritionistId = Guid.NewGuid(),
            Name          = "Backfill Test Plan",
            Status        = NutritionPlanStatus.Draft,
            Goal          = null,
            TargetWeightKg = null,
            Weeks         = [],
            Version       = 1,
            DateCreated   = DateTime.UtcNow
        };
        await _mongoCtx.NutritionPlans.InsertOneAsync(plan, cancellationToken: ct);

        // First backfill
        var sut = BuildSut();
        var (nutrition1, training1) = await sut.BackfillAsync(ct);

        nutrition1.Should().Be(1, "one nutrition plan should be updated");
        training1.Should().Be(0, "no training plans to update");

        // Verify the Mongo document was updated
        var filter  = Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, plan.ExternalId);
        var updated = await _mongoCtx.NutritionPlans.Find(filter).FirstOrDefaultAsync(ct);

        updated.Should().NotBeNull();
        updated!.Goal.Should().Be(PrimaryGoal.LoseFat);
        updated.TargetWeightKg.Should().Be(70.0m);

        // Idempotency: second run must not touch the already-backfilled document
        var sut2 = BuildSut();
        var (nutrition2, training2) = await sut2.BackfillAsync(ct);

        nutrition2.Should().Be(0, "already backfilled — second run must be a no-op");
        training2.Should().Be(0);

        // Document values unchanged
        var afterSecond = await _mongoCtx.NutritionPlans.Find(filter).FirstOrDefaultAsync(ct);
        afterSecond!.Goal.Should().Be(PrimaryGoal.LoseFat);
        afterSecond.TargetWeightKg.Should().Be(70.0m);
    }

    /// <summary>
    /// A TrainingPlan with null Goal/TargetWeightKg and a matching onboarding
    /// entry → backfill populates both fields, second run is a no-op.
    /// </summary>
    [Fact]
    public async Task BackfillAsync_TrainingPlan_CopiesGoalAndTarget_AndIsIdempotent()
    {
        var ct = TestContext.Current.CancellationToken;

        var (_, publicId, _) = await SeedUserWithOnboardingAsync(PrimaryGoal.GainMuscle, 85.0m);

        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId   = publicId,   // CRITICAL: must equal ClientProfile.PublicId
            TrainerId  = Guid.NewGuid(),
            Name       = "Backfill Training Plan",
            Status     = TrainingPlanStatus.Draft,
            Goal       = null,
            TargetWeightKg = null,
            Weeks      = [],
            Version    = 1,
            DateCreated = DateTime.UtcNow
        };
        await _mongoCtx.TrainingPlans.InsertOneAsync(plan, cancellationToken: ct);

        // First backfill
        var sut = BuildSut();
        var (nutrition1, training1) = await sut.BackfillAsync(ct);

        training1.Should().Be(1, "one training plan should be updated");
        // nutrition1 may be 0 or higher from other parallel test seeding — we only care about training

        // Verify document
        var filter  = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, plan.ExternalId);
        var updated = await _mongoCtx.TrainingPlans.Find(filter).FirstOrDefaultAsync(ct);

        updated.Should().NotBeNull();
        updated!.Goal.Should().Be(PrimaryGoal.GainMuscle);
        updated.TargetWeightKg.Should().Be(85.0m);

        // Idempotency
        var sut2 = BuildSut();
        var (_, training2) = await sut2.BackfillAsync(ct);

        training2.Should().Be(0, "already backfilled");
    }

    /// <summary>
    /// A plan whose client has no onboarding data must be skipped (no crash,
    /// no update).
    /// </summary>
    [Fact]
    public async Task BackfillAsync_NoOnboardingData_SkipsPlan()
    {
        var ct = TestContext.Current.CancellationToken;

        // Insert user+profile but NO onboarding data
        var userId = Guid.NewGuid();
        await using var conn = new NpgsqlConnection(_postgres.GetConnectionString());
        await conn.OpenAsync(ct);

        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = @"
                INSERT INTO users (
                    id, user_name, normalized_user_name,
                    email, normalized_email, email_confirmed,
                    password_hash, security_stamp, concurrency_stamp,
                    phone_number_confirmed, two_factor_enabled,
                    lockout_enabled, access_failed_count,
                    first_name, last_name, is_active, date_created,
                    gdpr_consent, verification_emails_sent, time_zone
                ) VALUES (
                    @id, @email, @emailUpper,
                    @email, @emailUpper, true,
                    '', gen_random_uuid()::text, gen_random_uuid()::text,
                    false, false, true, 0,
                    'No', 'Onboarding', true, now(),
                    true, 0, 'Europe/Prague'
                )";
            cmd.Parameters.AddWithValue("id",         userId);
            cmd.Parameters.AddWithValue("email",      $"{userId:N}@no-onboarding.com");
            cmd.Parameters.AddWithValue("emailUpper", $"{userId:N}@NO-ONBOARDING.COM");
            await cmd.ExecuteNonQueryAsync(ct);
        }

        var noOnboardingPublicId = Guid.NewGuid();
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = @"
                INSERT INTO client_profiles (user_id, public_id, date_created, is_onboarding_complete)
                VALUES (@userId, @publicId, now(), false)";
            cmd.Parameters.AddWithValue("userId",   userId);
            cmd.Parameters.AddWithValue("publicId", noOnboardingPublicId);
            await cmd.ExecuteNonQueryAsync(ct);
        }

        // Plan with null goal for this client — seeded with PublicId as the join key
        var plan = new NutritionPlan
        {
            ExternalId     = Guid.NewGuid(),
            ClientId       = noOnboardingPublicId,   // PublicId join key, no onboarding data
            NutritionistId = Guid.NewGuid(),
            Name           = "No-onboarding Plan",
            Status         = NutritionPlanStatus.Draft,
            Goal           = null,
            TargetWeightKg = null,
            Weeks          = [],
            Version        = 1,
            DateCreated    = DateTime.UtcNow
        };
        await _mongoCtx.NutritionPlans.InsertOneAsync(plan, cancellationToken: ct);

        var sut = BuildSut();
        await sut.BackfillAsync(ct);

        // Document must remain untouched (still null)
        var filter  = Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, plan.ExternalId);
        var fetched = await _mongoCtx.NutritionPlans.Find(filter).FirstOrDefaultAsync(ct);

        fetched.Should().NotBeNull();
        fetched!.Goal.Should().BeNull("no onboarding data means nothing to copy");
        fetched.TargetWeightKg.Should().BeNull();
    }

    /// <summary>
    /// A plan that already has both Goal and TargetWeightKg set must be
    /// skipped entirely — backfill never overwrites existing data.
    /// </summary>
    [Fact]
    public async Task BackfillAsync_AlreadyBackfilled_DoesNotOverwrite()
    {
        var ct = TestContext.Current.CancellationToken;

        var (_, publicId, _) = await SeedUserWithOnboardingAsync(PrimaryGoal.LoseFat, 60.0m);

        // Plan already has goal set — should not be touched
        var plan = new NutritionPlan
        {
            ExternalId     = Guid.NewGuid(),
            ClientId       = publicId,   // PublicId join key
            NutritionistId = Guid.NewGuid(),
            Name           = "Pre-backfilled Plan",
            Status         = NutritionPlanStatus.Active,
            Goal           = PrimaryGoal.GainMuscle,   // already set
            TargetWeightKg = 90.0m,                    // already set
            Weeks          = [],
            Version        = 1,
            DateCreated    = DateTime.UtcNow
        };
        await _mongoCtx.NutritionPlans.InsertOneAsync(plan, cancellationToken: ct);

        var sut = BuildSut();
        await sut.BackfillAsync(ct);

        // Values must remain as-is (not overwritten by onboarding WeightLoss/60.0)
        var filter  = Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, plan.ExternalId);
        var fetched = await _mongoCtx.NutritionPlans.Find(filter).FirstOrDefaultAsync(ct);

        fetched.Should().NotBeNull();
        fetched!.Goal.Should().Be(PrimaryGoal.GainMuscle, "pre-existing value must not be overwritten");
        fetched.TargetWeightKg.Should().Be(90.0m, "pre-existing value must not be overwritten");
    }
}
