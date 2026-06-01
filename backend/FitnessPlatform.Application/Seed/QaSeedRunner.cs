using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Seed;

/// <summary>
/// Deterministic fixture for the docker-compose end-to-end test harness.
/// Idempotent: re-running over an existing fixture is a no-op so qa-tester
/// can hit the same IDs and emails on every run.
///
/// Seeded relationships:
/// - QA Client (11111111-...) has a ClientProfile with PublicId = ClientProfilePublicId.
/// - QA Trainer (22222222-...) has a ProfessionalProfile with PublicId = TrainerProfilePublicId.
/// - A ClientProfessionalLink ties the two with IsActive=true so the trainer
///   dashboard shows "QA Client" without any further setup.
/// - QA Nutri (33333333-...) has a ProfessionalProfile (no client link seeded).
/// - A TrainingPlan (dddddddd-...) is seeded for the QA client with a Published week
///   containing one session with four sections:
///   Section 1 — ForTime + 0 exercises (the #258 bug shape).
///   Section 2 — AMRAP + 2 synthetic exercises (non-regression).
///   Section 3 — Standard (null format) + 2 synthetic exercises (non-regression).
///   Section 4 — Tabata (20s/10s × 8) + 1 synthetic exercise (#327 iOS QA fixture).
/// </summary>
public static class QaSeedRunner
{
    // User IDs are spelled out here so QA fixtures stay stable across rebuilds —
    // qa-tester references them directly in evidence (curl probes, Playwright
    // selectors). Changing them is a fixture-version bump.
    public static readonly Guid ClientUserId    = new("11111111-1111-1111-1111-111111111111");
    public static readonly Guid TrainerUserId   = new("22222222-2222-2222-2222-222222222222");
    public static readonly Guid NutriUserId     = new("33333333-3333-3333-3333-333333333333");

    // Stable PublicIds for profile rows — used by nutrition/training plans and
    // compliance queries that key on ClientProfile.PublicId / ProfessionalProfile.PublicId.
    public static readonly Guid ClientProfilePublicId  = new("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    public static readonly Guid TrainerProfilePublicId = new("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    public static readonly Guid NutriProfilePublicId   = new("cccccccc-cccc-cccc-cccc-cccccccccccc");

    // Stable ExternalId for the seeded training plan (ForTime + 0-exercise fixture).
    // ClientId on the plan = ClientProfilePublicId (NOT ClientUserId) per GetClientPlansEndpoint filter.
    public static readonly Guid QaTrainingPlanExternalId = new("dddddddd-dddd-dddd-dddd-dddddddddddd");

    // -------------------------------------------------------------------------
    // #326 past-dated training plan — exercises three past-session states so
    // Playwright can assert completed/skipped/untouched UI behaviour.
    // -------------------------------------------------------------------------

    /// <summary>
    /// Past-dated Active training plan owned by qa.trainer for qa.client.
    /// StartDate is set to ~4 weeks before the seed instant (anchored to the
    /// preceding Monday) so all sessions in Weeks 1–2 fall in the past.
    /// </summary>
    public static readonly Guid QaPastTrainingPlanExternalId = new("11111111-1111-1111-2222-000000000001");

    /// <summary>
    /// Session in Week 1, DayOfWeek=1 (Monday): a WorkoutLog with IsCompleted=true
    /// exists → web classifies as COMPLETED (read-only).
    /// </summary>
    public static readonly Guid QaPastSessionCompletedId = new("11111111-1111-1111-2222-000000000002");

    /// <summary>
    /// Session in Week 1, DayOfWeek=3 (Wednesday): a WorkoutLog with IsCompleted=false
    /// exists → web classifies as SKIPPED (editable + Mark-finished).
    /// </summary>
    public static readonly Guid QaPastSessionSkippedId = new("11111111-1111-1111-2222-000000000003");

    /// <summary>
    /// Session in Week 2, DayOfWeek=1 (Monday): NO WorkoutLog exists
    /// → web classifies as UNTOUCHED (editable + Mark-finished).
    /// </summary>
    public static readonly Guid QaPastSessionUntouchedId = new("11111111-1111-1111-2222-000000000004");

    // Stable WorkoutLog ExternalIds.
    public static readonly Guid QaPastCompletedWorkoutLogId = new("11111111-1111-1111-2222-000000000005");
    public static readonly Guid QaPastSkippedWorkoutLogId   = new("11111111-1111-1111-2222-000000000006");

    // Section IDs within the three past sessions.
    public static readonly Guid PastCompletedSectionId = new("11111111-1111-1111-3333-000000000001");
    public static readonly Guid PastSkippedSectionId   = new("11111111-1111-1111-3333-000000000002");
    public static readonly Guid PastUntouchedSectionId = new("11111111-1111-1111-3333-000000000003");

    // Stable SectionIds — deterministic for test assertions.
    public static readonly Guid ForTimeSectionId   = new("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");
    public static readonly Guid AmrapSectionId     = new("ffffffff-ffff-ffff-ffff-ffffffffffff");
    public static readonly Guid StandardSectionId  = new("00000000-0000-0000-aaaa-000000000001");

    // Stable SessionId.
    public static readonly Guid QaSessionId = new("00000000-0000-0000-bbbb-000000000001");

    // Stable ExternalIds for the synthetic exercises in AMRAP + Standard + Tabata sections.
    public static readonly Guid AmrapExercise1Id   = new("00000000-0000-0000-cccc-000000000001");
    public static readonly Guid AmrapExercise2Id   = new("00000000-0000-0000-cccc-000000000002");
    public static readonly Guid StandardExercise1Id = new("00000000-0000-0000-dddd-000000000001");
    public static readonly Guid StandardExercise2Id = new("00000000-0000-0000-dddd-000000000002");

    // Stable SectionId + exercise for the Tabata section (Order=3, #327 iOS QA fixture).
    public static readonly Guid TabataSectionId    = new("00000000-0000-0000-aaaa-000000000002");
    public static readonly Guid TabataExercise1Id  = new("00000000-0000-0000-eeee-000000000006");

    // Foods — owned by Nutri (NutritionistId = NutriUserId, the ApplicationUser.Id).
    // CreateFoodEndpoint sets NutritionistId = Guid.Parse(AppClaims.UserId) (the user id, NOT the
    // ProfessionalProfile.PublicId), and the ownership guard in UploadFoodImageUrlEndpoint compares
    // food.NutritionistId against the same user-id claim. Using NutriProfilePublicId here would
    // make the seeded foods fail the ownership check with FOOD_NOT_OWNED (HTTP 400).
    public static readonly Guid QaFood1ExternalId = new("00000000-0000-0000-eeee-000000000001"); // Chicken Breast 100g
    public static readonly Guid QaFood2ExternalId = new("00000000-0000-0000-eeee-000000000002"); // White Rice 100g cooked
    public static readonly Guid QaFood3ExternalId = new("00000000-0000-0000-eeee-000000000003"); // Broccoli 100g
    public static readonly Guid QaFood4ExternalId = new("00000000-0000-0000-eeee-000000000004"); // Banana medium
    public static readonly Guid QaFood5ExternalId = new("00000000-0000-0000-eeee-000000000005"); // Rolled Oats 50g

    // Recipes — owned by Nutri.
    public static readonly Guid QaRecipe1ExternalId = new("00000000-0000-0000-ffff-000000000001"); // Chicken + Rice + Broccoli bowl
    public static readonly Guid QaRecipe2ExternalId = new("00000000-0000-0000-ffff-000000000002"); // Oats + Banana breakfast
    public static readonly Guid QaRecipe3ExternalId = new("00000000-0000-0000-ffff-000000000003"); // Chicken + Broccoli stir-fry

    // Nutrition plan — Author = Nutri, Client = QA Client.
    public static readonly Guid QaNutritionPlanExternalId = new("dddddddd-eeee-ffff-0000-111111111111");

    // MinIO blob keys (deterministic per QA fixture).
    public const string QaAvatarBlobKey    = "avatars/qa-client-11111111.png";
    public const string QaFoodImageBlobKey = "foods/qa-food-1.png";

    public const string ClientEmail   = "qa.client@fitnessplatform.test";
    public const string TrainerEmail  = "qa.trainer@fitnessplatform.test";
    public const string NutriEmail    = "qa.nutri@fitnessplatform.test";

    // Sourced from QA_SEED_PASSWORD via .env.test (gitignored). The harness
    // refuses to seed without it so a missing env file fails fast instead of
    // creating users with a default password.
    private static string Password =>
        Environment.GetEnvironmentVariable("QA_SEED_PASSWORD")
            ?? throw new InvalidOperationException(
                "QA_SEED_PASSWORD is not set. Copy .env.test.example to .env.test and fill it in.");

    /// <summary>
    /// Selects how much of the fixture to seed.
    /// <list type="bullet">
    ///   <item><term>Rich</term><description>(default when QA_SEED_KIND is unset or "rich") — full fixture: users + profiles + link + training plan + foods + recipes + nutrition plan + image blobs.</description></item>
    ///   <item><term>Minimal</term><description>(QA_SEED_KIND=minimal) — users + profiles + trainer↔client link only. No plans, no foods, no blobs. Useful when a test only needs auth/profile and the additional rows just add noise.</description></item>
    /// </list>
    /// Switched via the QA_SEED_KIND env var so callers (compose `seed` service,
    /// `scripts/test-env seed --kind=…`) can opt in to a leaner reset without
    /// recompiling.
    /// </summary>
    public enum SeedKind { Minimal, Rich }

    /// <summary>
    /// Resolves <see cref="SeedKind"/> from the QA_SEED_KIND env var. Unset or
    /// empty → <see cref="SeedKind.Rich"/> (backwards-compatible default —
    /// the prior behaviour was always-rich). Unknown values fail fast so a
    /// typo in `--kind=ritch` doesn't silently fall through to rich.
    /// </summary>
    public static SeedKind ResolveKind()
    {
        var raw = Environment.GetEnvironmentVariable("QA_SEED_KIND");
        if (string.IsNullOrWhiteSpace(raw))
            return SeedKind.Rich;

        return raw.Trim().ToLowerInvariant() switch
        {
            "minimal" => SeedKind.Minimal,
            "rich"    => SeedKind.Rich,
            _ => throw new InvalidOperationException(
                $"QA_SEED_KIND='{raw}' is not a valid value. Expected 'minimal' or 'rich' (unset = rich).")
        };
    }

    public static async Task SeedAsync(IServiceProvider serviceProvider)
    {
        // Resolve the seed kind BEFORE touching the database. A typo in
        // QA_SEED_KIND throws here, so no users / profiles get created on
        // a bad invocation — preserves the "fail-fast on unknown" contract
        // documented on ResolveKind.
        var kind = ResolveKind();

        using var scope = serviceProvider.CreateScope();
        var sp = scope.ServiceProvider;
        var logger = sp.GetRequiredService<ILoggerFactory>().CreateLogger("QaSeed");
        var userManager = sp.GetRequiredService<UserManager<ApplicationUser>>();
        var db = sp.GetRequiredService<ApplicationDbContext>();
        var mongo = sp.GetRequiredService<IMongoContext>();

        await db.Database.MigrateAsync();

        await EnsureUserAsync(userManager, ClientUserId,  ClientEmail,  "QA",  "Client",   UserRole.Client,       logger);
        await EnsureUserAsync(userManager, TrainerUserId, TrainerEmail, "QA",  "Trainer",  UserRole.Trainer,      logger);
        await EnsureUserAsync(userManager, NutriUserId,   NutriEmail,   "QA",  "Nutri",    UserRole.Nutritionist, logger);

        // Profiles — each user requires a role-matching profile row so that
        // trainer endpoints (which look up ProfessionalProfile by UserId) and
        // client endpoints (which look up ClientProfile by UserId) work without
        // the users having gone through the normal registration flow.
        var clientProfile  = await EnsureClientProfileAsync(db, ClientUserId,  ClientProfilePublicId,  logger);
        var trainerProfile = await EnsureProfessionalProfileAsync(db, TrainerUserId, TrainerProfilePublicId, logger);
        var nutriProfile   = await EnsureProfessionalProfileAsync(db, NutriUserId,   NutriProfilePublicId,   logger);

        // Trainer↔client link — without this the trainer dashboard returns an
        // empty client list and Playwright's getByText('QA Client') never resolves.
        await EnsureTrainerClientLinkAsync(db, trainerProfile, clientProfile, logger);

        if (kind == SeedKind.Rich)
        {
            // Training plan — ForTime + 0-exercise fixture for #258 non-regression.
            await EnsureTrainingPlanAsync(mongo, clientProfile.PublicId, trainerProfile.PublicId, logger);

            // Past-dated training plan — three sessions in distinct completion states for #326.
            await EnsurePastTrainingPlanAsync(mongo, clientProfile.PublicId, trainerProfile.PublicId, logger);

            // Foods + Recipes + NutritionPlan.
            // NutriUserId (not nutriProfile.PublicId) — ownership guards in UploadFoodImageUrlEndpoint
            // and UploadRecipeImageUrlEndpoint compare NutritionistId against AppClaims.UserId,
            // which is ApplicationUser.Id. Using the profile PublicId would cause FOOD_NOT_OWNED /
            // RECIPE_NOT_OWNED (HTTP 400) when the e2e flow calls the upload-url endpoint.
            await EnsureFoodsAsync(mongo, NutriUserId, logger);
            await EnsureRecipesAsync(mongo, NutriUserId, logger);
            await EnsureNutritionPlanAsync(mongo, clientProfile.PublicId, nutriProfile.PublicId, logger);

            // Image blobs in MinIO — idempotent, bucket created if absent.
            await EnsureAvatarAsync(sp, logger);
            await EnsureFoodImageAsync(sp, logger);
        }
        else
        {
            logger.LogInformation("QA seed kind=minimal — skipping training plan, foods, recipes, nutrition plan, and blobs.");
        }

        logger.LogInformation("QA seed complete (kind={Kind}) — client={Client} trainer={Trainer} nutri={Nutri}",
            kind, ClientEmail, TrainerEmail, NutriEmail);
    }

    private static async Task EnsureUserAsync(
        UserManager<ApplicationUser> userManager,
        Guid id,
        string email,
        string firstName,
        string lastName,
        UserRole role,
        ILogger logger)
    {
        var existing = await userManager.FindByEmailAsync(email);
        if (existing is not null)
        {
            logger.LogInformation("QA user already present: {Email}", email);
            return;
        }

        var user = new ApplicationUser
        {
            Id = id,
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            FirstName = firstName,
            LastName = lastName,
            GdprConsent = true,
        };

        var result = await userManager.CreateAsync(user, Password);
        if (!result.Succeeded)
        {
            var errors = string.Join("; ", result.Errors.Select(e => $"{e.Code}: {e.Description}"));
            throw new InvalidOperationException($"Failed to create QA user {email}: {errors}");
        }

        var roleResult = await userManager.AddToRoleAsync(user, role.ToString());
        if (!roleResult.Succeeded)
        {
            var errors = string.Join("; ", roleResult.Errors.Select(e => $"{e.Code}: {e.Description}"));
            throw new InvalidOperationException($"Failed to assign role {role} to {email}: {errors}");
        }

        logger.LogInformation("QA user created: {Email} ({Role})", email, role);
    }

    private static async Task<ClientProfile> EnsureClientProfileAsync(
        ApplicationDbContext db,
        Guid userId,
        Guid publicId,
        ILogger logger)
    {
        var existing = await db.ClientProfiles
            .FirstOrDefaultAsync(p => p.UserId == userId);

        if (existing is not null)
        {
            logger.LogInformation("QA ClientProfile already present for userId={UserId}", userId);
            return existing;
        }

        var profile = new ClientProfile
        {
            UserId = userId,
            PublicId = publicId,
            IsOnboardingComplete = true,
            DateCreated = DateTime.UtcNow,
        };

        db.ClientProfiles.Add(profile);
        await db.SaveChangesAsync();

        logger.LogInformation("QA ClientProfile created for userId={UserId} publicId={PublicId}", userId, publicId);
        return profile;
    }

    private static async Task<ProfessionalProfile> EnsureProfessionalProfileAsync(
        ApplicationDbContext db,
        Guid userId,
        Guid publicId,
        ILogger logger)
    {
        var existing = await db.ProfessionalProfiles
            .FirstOrDefaultAsync(p => p.UserId == userId);

        if (existing is not null)
        {
            logger.LogInformation("QA ProfessionalProfile already present for userId={UserId}", userId);
            return existing;
        }

        var profile = new ProfessionalProfile
        {
            UserId = userId,
            PublicId = publicId,
            ShowInSearch = false,
            AcceptNewClients = true,
            DateCreated = DateTime.UtcNow,
        };

        db.ProfessionalProfiles.Add(profile);
        await db.SaveChangesAsync();

        logger.LogInformation("QA ProfessionalProfile created for userId={UserId} publicId={PublicId}", userId, publicId);
        return profile;
    }

    private static async Task EnsureTrainerClientLinkAsync(
        ApplicationDbContext db,
        ProfessionalProfile trainerProfile,
        ClientProfile clientProfile,
        ILogger logger)
    {
        var existing = await db.ClientProfessionalLinks
            .AnyAsync(l =>
                l.ProfessionalProfileId == trainerProfile.Id &&
                l.ClientProfileId == clientProfile.Id);

        if (existing)
        {
            logger.LogInformation(
                "QA trainer↔client link already present: trainerId={TrainerId} clientId={ClientId}",
                trainerProfile.Id, clientProfile.Id);
            return;
        }

        var link = new ClientProfessionalLink
        {
            ProfessionalProfileId = trainerProfile.Id,
            ClientProfileId = clientProfile.Id,
            ProfessionalRole = UserRole.Trainer,
            IsActive = true,
            CanViewTrainingPlans = true,
            CanViewNutritionPlans = false,
            DateCreated = DateTime.UtcNow,
        };

        db.ClientProfessionalLinks.Add(link);
        await db.SaveChangesAsync();

        logger.LogInformation(
            "QA trainer↔client link created: trainerId={TrainerId} clientId={ClientId}",
            trainerProfile.Id, clientProfile.Id);
    }

    /// <summary>
    /// Seeds a deterministic training plan for the QA client.
    ///
    /// The plan contains one Published week with one session with four sections:
    ///   1. ForTime, TimeCapSeconds=1800, Exercises=[] — the #258 bug shape.
    ///   2. AMRAP, TimeCapSeconds=600, two synthetic exercises — non-regression.
    ///   3. Standard (null format), two synthetic exercises — non-regression.
    ///   4. Tabata, WorkSeconds=20, RestSeconds=10, TotalRounds=8, one exercise — #327 iOS QA fixture.
    ///
    /// ClientId = clientProfilePublicId (NOT ClientUserId) — GetClientPlansEndpoint
    /// filters by ClientProfile.PublicId. Using the user id would make the plan
    /// invisible to GET /client/plans.
    ///
    /// The week Status must be WeekStatus.Published — GetClientPlansEndpoint line 142
    /// applies ElemMatch(w => w.Status == WeekStatus.Published). A Draft week silently
    /// excludes the plan.
    /// </summary>
    private static async Task EnsureTrainingPlanAsync(
        IMongoContext mongo,
        Guid clientProfilePublicId,
        Guid trainerProfilePublicId,
        ILogger logger)
    {
        var existing = await mongo.TrainingPlans
            .Find(p => p.ExternalId == QaTrainingPlanExternalId)
            .FirstOrDefaultAsync();

        if (existing is not null)
        {
            logger.LogInformation(
                "QA TrainingPlan already present: externalId={ExternalId}", QaTrainingPlanExternalId);
            return;
        }

        var now = DateTime.UtcNow;

        var plan = new TrainingPlan
        {
            ExternalId      = QaTrainingPlanExternalId,
            ClientId        = clientProfilePublicId,
            // TrainerId is keyed on ApplicationUser.Id (NOT ProfessionalProfile.PublicId) —
            // GetTrainingPlansEndpoint and GetTrainingPlanEndpoint scope by
            // Guid.Parse(User.FindFirstValue(AppClaims.UserId)) which is ApplicationUser.Id.
            // Using trainerProfilePublicId (bbbb...) makes this plan invisible to
            // GET /training/plans and GET /training/plans/{planId} for the trainer.
            TrainerId       = TrainerUserId,
            Name            = "QA Test Plan — ForTime fixture",
            Status          = TrainingPlanStatus.Active,
            DateCreated     = now,
            DatePublished   = now,
            Version         = 1,
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber    = 1,
                    Status        = WeekStatus.Published,
                    DatePublished = now,
                    Sessions =
                    [
                        new TrainingSession
                        {
                            SessionId  = QaSessionId,
                            DayOfWeek  = 1, // Monday
                            Name       = "QA Session",
                            Order      = 1,
                            Sections =
                            [
                                // Section 1 — ForTime + 0 exercises (#258 bug shape)
                                new TrainingSection
                                {
                                    SectionId    = ForTimeSectionId,
                                    Order        = 0,
                                    Name         = "ForTime 30min",
                                    Format       = WorkoutFormat.ForTime,
                                    FormatConfig = new WodConfig { TimeCapSeconds = 1800 },
                                    Exercises    = [],
                                },
                                // Section 2 — AMRAP + 2 synthetic exercises (non-regression)
                                new TrainingSection
                                {
                                    SectionId    = AmrapSectionId,
                                    Order        = 1,
                                    Name         = "AMRAP test",
                                    Format       = WorkoutFormat.AMRAP,
                                    FormatConfig = new WodConfig { TimeCapSeconds = 600 },
                                    Exercises =
                                    [
                                        new SessionExercise
                                        {
                                            ExerciseExternalId = AmrapExercise1Id,
                                            ExerciseName       = "QA Pull-up",
                                            Order              = 1,
                                            MovementType       = MovementType.Reps,
                                        },
                                        new SessionExercise
                                        {
                                            ExerciseExternalId = AmrapExercise2Id,
                                            ExerciseName       = "QA Box Jump",
                                            Order              = 2,
                                            MovementType       = MovementType.Reps,
                                        },
                                    ],
                                },
                                // Section 3 — Standard (null format) + 2 synthetic exercises (non-regression)
                                new TrainingSection
                                {
                                    SectionId    = StandardSectionId,
                                    Order        = 2,
                                    Name         = "Standard test",
                                    Format       = null,
                                    FormatConfig = null,
                                    Exercises =
                                    [
                                        new SessionExercise
                                        {
                                            ExerciseExternalId = StandardExercise1Id,
                                            ExerciseName       = "QA Squat",
                                            Order              = 1,
                                            MovementType       = MovementType.Reps,
                                        },
                                        new SessionExercise
                                        {
                                            ExerciseExternalId = StandardExercise2Id,
                                            ExerciseName       = "QA Deadlift",
                                            Order              = 2,
                                            MovementType       = MovementType.Reps,
                                        },
                                    ],
                                },
                                // Section 4 — Tabata 20s/10s × 8 + 1 exercise (#327 iOS QA fixture)
                                new TrainingSection
                                {
                                    SectionId    = TabataSectionId,
                                    Order        = 3,
                                    Name         = "Tabata test",
                                    Format       = WorkoutFormat.Tabata,
                                    FormatConfig = new WodConfig
                                    {
                                        WorkSeconds  = 20,
                                        RestSeconds  = 10,
                                        TotalRounds  = 8,
                                    },
                                    Exercises =
                                    [
                                        new SessionExercise
                                        {
                                            ExerciseExternalId = TabataExercise1Id,
                                            ExerciseName       = "QA Burpee",
                                            Order              = 1,
                                            MovementType       = MovementType.Reps,
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        };

        await mongo.TrainingPlans.InsertOneAsync(plan);

        logger.LogInformation(
            "QA TrainingPlan created: externalId={ExternalId} clientId={ClientId}",
            QaTrainingPlanExternalId, clientProfilePublicId);
    }

    /// <summary>
    /// Seeds a past-dated training plan for the QA client with three sessions that
    /// represent the three past-session states the web UI classifies:
    ///
    ///   PAST-COMPLETED  (Week 1, Mon) — WorkoutLog exists, IsCompleted=true  → read-only.
    ///   PAST-SKIPPED    (Week 1, Wed) — WorkoutLog exists, IsCompleted=false → editable.
    ///   PAST-UNTOUCHED  (Week 2, Mon) — no WorkoutLog at all               → editable.
    ///
    /// StartDate is set to 28 days before seed-time anchored to the preceding Monday
    /// so all Week 1 + Week 2 sessions are firmly in the past regardless of current day.
    ///
    /// Each session carries a single Standard section with two exercises so the web
    /// can render the full section/exercise/set tree.  The WorkoutLog for COMPLETED
    /// mirrors the section structure with all sets stamped CompletedAt.  The WorkoutLog
    /// for SKIPPED has one set completed on each exercise, the rest absent (incomplete).
    /// </summary>
    private static async Task EnsurePastTrainingPlanAsync(
        IMongoContext mongo,
        Guid clientProfilePublicId,
        Guid trainerProfilePublicId,
        ILogger logger)
    {
        var existingPlan = await mongo.TrainingPlans
            .Find(p => p.ExternalId == QaPastTrainingPlanExternalId)
            .FirstOrDefaultAsync();

        // Anchor StartDate to the Monday that is (at least) 28 days in the past.
        // Using Monday ensures DayOfWeek=1 maps cleanly to that exact Monday.
        var now = DateTime.UtcNow;
        var daysUntilLastMonday = ((int)now.DayOfWeek == 0 ? 7 : (int)now.DayOfWeek) - 1;
        var lastMonday = now.Date.AddDays(-daysUntilLastMonday);
        // Go back 4 full weeks so Week 1 Mon = lastMonday-28 days.
        var startDate = lastMonday.AddDays(-28);

        // Stable dates derived deterministically from startDate.
        var completedSessionDate = startDate;                    // Week 1, Mon (+0d)
        var skippedSessionDate   = startDate.AddDays(2);        // Week 1, Wed (+2d)
        var untouchedSessionDate = startDate.AddDays(7);        // Week 2, Mon (+7d)

        if (existingPlan is null)
        {
            var plan = new TrainingPlan
            {
                ExternalId    = QaPastTrainingPlanExternalId,
                // ClientId is keyed on ClientProfile.PublicId (NOT ApplicationUser.Id) —
                // GetTrainingPlansEndpoint filters by ClientId = ClientProfile.PublicId when
                // the caller passes a clientId query param, and TrainingCompletion.ClientId
                // (written by WorkoutCompletionService) is also keyed on ClientProfile.PublicId.
                // plan.ClientId and TrainingCompletion.ClientId must match for the completions
                // fold-in in GetTrainingPlanEndpoint (line 59 filters by plan.ClientId).
                ClientId      = clientProfilePublicId,
                // TrainerId is keyed on ApplicationUser.Id (NOT ProfessionalProfile.PublicId) —
                // GetTrainingPlansEndpoint and GetTrainingPlanEndpoint scope by
                // Guid.Parse(User.FindFirstValue(AppClaims.UserId)) which is ApplicationUser.Id.
                // Using the profile PublicId (bbbb...) makes this plan invisible to GET /training/plans.
                TrainerId     = TrainerUserId,
                Name          = "QA Past Plan — #326 completion states",
                Status        = TrainingPlanStatus.Active,
                StartDate     = startDate,
                DateCreated   = startDate.AddDays(-3),
                DatePublished = startDate.AddDays(-1),
                Version       = 1,
                Weeks =
                [
                    new TrainingWeek
                    {
                        WeekNumber    = 1,
                        Status        = WeekStatus.Published,
                        DatePublished = startDate.AddDays(-1),
                        Sessions      =
                        [
                            // Session 1 — will have a completed WorkoutLog.
                            new TrainingSession
                            {
                                SessionId = QaPastSessionCompletedId,
                                DayOfWeek = 1, // Monday
                                Name      = "QA Past Session — Completed",
                                Order     = 1,
                                Sections  =
                                [
                                    new TrainingSection
                                    {
                                        SectionId    = PastCompletedSectionId,
                                        Order        = 0,
                                        Name         = "Hlavní",
                                        Format       = null,
                                        FormatConfig = null,
                                        Exercises    =
                                        [
                                            new SessionExercise
                                            {
                                                ExerciseExternalId = new Guid("11111111-1111-1111-4444-000000000001"),
                                                ExerciseName       = "QA Bench Press",
                                                Order              = 1,
                                                MovementType       = MovementType.Reps,
                                            },
                                            new SessionExercise
                                            {
                                                ExerciseExternalId = new Guid("11111111-1111-1111-4444-000000000002"),
                                                ExerciseName       = "QA Overhead Press",
                                                Order              = 2,
                                                MovementType       = MovementType.Reps,
                                            },
                                        ],
                                    },
                                ],
                            },
                            // Session 2 — will have an incomplete (skipped) WorkoutLog.
                            new TrainingSession
                            {
                                SessionId = QaPastSessionSkippedId,
                                DayOfWeek = 3, // Wednesday
                                Name      = "QA Past Session — Skipped",
                                Order     = 2,
                                Sections  =
                                [
                                    new TrainingSection
                                    {
                                        SectionId    = PastSkippedSectionId,
                                        Order        = 0,
                                        Name         = "Hlavní",
                                        Format       = null,
                                        FormatConfig = null,
                                        Exercises    =
                                        [
                                            new SessionExercise
                                            {
                                                ExerciseExternalId = new Guid("11111111-1111-1111-4444-000000000003"),
                                                ExerciseName       = "QA Back Squat",
                                                Order              = 1,
                                                MovementType       = MovementType.Reps,
                                            },
                                            new SessionExercise
                                            {
                                                ExerciseExternalId = new Guid("11111111-1111-1111-4444-000000000004"),
                                                ExerciseName       = "QA Romanian Deadlift",
                                                Order              = 2,
                                                MovementType       = MovementType.Reps,
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                    new TrainingWeek
                    {
                        WeekNumber    = 2,
                        Status        = WeekStatus.Published,
                        DatePublished = startDate.AddDays(6),
                        Sessions      =
                        [
                            // Session 3 — NO WorkoutLog (untouched).
                            new TrainingSession
                            {
                                SessionId = QaPastSessionUntouchedId,
                                DayOfWeek = 1, // Monday
                                Name      = "QA Past Session — Untouched",
                                Order     = 1,
                                Sections  =
                                [
                                    new TrainingSection
                                    {
                                        SectionId    = PastUntouchedSectionId,
                                        Order        = 0,
                                        Name         = "Hlavní",
                                        Format       = null,
                                        FormatConfig = null,
                                        Exercises    =
                                        [
                                            new SessionExercise
                                            {
                                                ExerciseExternalId = new Guid("11111111-1111-1111-4444-000000000005"),
                                                ExerciseName       = "QA Pull-down",
                                                Order              = 1,
                                                MovementType       = MovementType.Reps,
                                            },
                                            new SessionExercise
                                            {
                                                ExerciseExternalId = new Guid("11111111-1111-1111-4444-000000000006"),
                                                ExerciseName       = "QA Seated Row",
                                                Order              = 2,
                                                MovementType       = MovementType.Reps,
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            };

            await mongo.TrainingPlans.InsertOneAsync(plan);
            logger.LogInformation(
                "QA PastTrainingPlan created: externalId={ExternalId} startDate={StartDate}",
                QaPastTrainingPlanExternalId, startDate);
        }
        else
        {
            logger.LogInformation(
                "QA PastTrainingPlan already present: externalId={ExternalId}", QaPastTrainingPlanExternalId);
        }

        // ---------------------------------------------------------------------------
        // WorkoutLog: COMPLETED — IsCompleted=true, all sets stamped CompletedAt.
        // ---------------------------------------------------------------------------
        var existingCompletedLog = await mongo.WorkoutLogs
            .Find(l => l.ExternalId == QaPastCompletedWorkoutLogId)
            .FirstOrDefaultAsync();

        if (existingCompletedLog is null)
        {
            var completedAt = completedSessionDate.AddHours(10); // 10:00 UTC on session day.
            var completedLog = new WorkoutLog
            {
                ExternalId  = QaPastCompletedWorkoutLogId,
                // ClientId is keyed on ApplicationUser.Id (NOT ClientProfile.PublicId) —
                // CompleteWorkoutEndpoint (live client finish) filters WorkoutLogs by
                // ClientId == Guid.Parse(AppClaims.UserId), which is ApplicationUser.Id.
                // WorkoutCompletionService resolves the ClientProfile by cp.UserId == log.ClientId,
                // then uses clientProfile.PublicId for the TrainingCompletion — so the fan-out
                // correctly produces a TrainingCompletion.ClientId = ClientProfile.PublicId.
                ClientId      = ClientUserId,
                PlanId        = QaPastTrainingPlanExternalId,
                SessionId     = QaPastSessionCompletedId,
                StartedAt     = completedAt.AddMinutes(-45),
                CompletedAt   = completedAt,
                // CompletedDate is the calendar-day key required by the partial unique index
                // idx_workoutlog_planId_sessionId_completedDate_unique. Derived via the shared
                // WorkoutLog.ToCompletionDateUtc helper so the key always agrees with
                // WorkoutCompletionService and MongoIndexInitializer.
                CompletedDate = WorkoutLog.ToCompletionDateUtc(completedAt),
                IsCompleted   = true,
                DateCreated   = completedAt.AddMinutes(-45),
                DateUpdated   = completedAt,
                Sections    =
                [
                    new WorkoutSection
                    {
                        SectionId = PastCompletedSectionId,
                        Order     = 0,
                        Name      = "Hlavní",
                        Format    = null,
                        Exercises =
                        [
                            new WorkoutExercise
                            {
                                ExerciseExternalId = new Guid("11111111-1111-1111-4444-000000000001"),
                                ExerciseName       = "QA Bench Press",
                                Sets               =
                                [
                                    new WorkoutSet { SetNumber = 1, Reps = 8, WeightKg = 80m, CompletedAt = completedAt.AddMinutes(-30) },
                                    new WorkoutSet { SetNumber = 2, Reps = 8, WeightKg = 80m, CompletedAt = completedAt.AddMinutes(-25) },
                                    new WorkoutSet { SetNumber = 3, Reps = 7, WeightKg = 80m, CompletedAt = completedAt.AddMinutes(-20) },
                                ],
                            },
                            new WorkoutExercise
                            {
                                ExerciseExternalId = new Guid("11111111-1111-1111-4444-000000000002"),
                                ExerciseName       = "QA Overhead Press",
                                Sets               =
                                [
                                    new WorkoutSet { SetNumber = 1, Reps = 10, WeightKg = 50m, CompletedAt = completedAt.AddMinutes(-15) },
                                    new WorkoutSet { SetNumber = 2, Reps = 10, WeightKg = 50m, CompletedAt = completedAt.AddMinutes(-10) },
                                ],
                            },
                        ],
                    },
                ],
            };

            await mongo.WorkoutLogs.InsertOneAsync(completedLog);
            logger.LogInformation(
                "QA WorkoutLog COMPLETED created: externalId={ExternalId} sessionId={SessionId}",
                QaPastCompletedWorkoutLogId, QaPastSessionCompletedId);
        }
        else
        {
            logger.LogInformation(
                "QA WorkoutLog COMPLETED already present: externalId={ExternalId}", QaPastCompletedWorkoutLogId);
        }

        // ---------------------------------------------------------------------------
        // WorkoutLog: SKIPPED — IsCompleted=false, only one set per exercise logged.
        // The client started but did not finish the session.
        // ---------------------------------------------------------------------------
        var existingSkippedLog = await mongo.WorkoutLogs
            .Find(l => l.ExternalId == QaPastSkippedWorkoutLogId)
            .FirstOrDefaultAsync();

        if (existingSkippedLog is null)
        {
            var skippedStartedAt = skippedSessionDate.AddHours(9); // started at 09:00 UTC.
            var skippedLog = new WorkoutLog
            {
                ExternalId  = QaPastSkippedWorkoutLogId,
                // ClientId = ApplicationUser.Id — same reasoning as the completed log above.
                ClientId    = ClientUserId,
                PlanId      = QaPastTrainingPlanExternalId,
                SessionId   = QaPastSessionSkippedId,
                StartedAt   = skippedStartedAt,
                CompletedAt = null,
                IsCompleted = false,
                DateCreated = skippedStartedAt,
                DateUpdated = skippedStartedAt.AddMinutes(20),
                Sections    =
                [
                    new WorkoutSection
                    {
                        SectionId = PastSkippedSectionId,
                        Order     = 0,
                        Name      = "Hlavní",
                        Format    = null,
                        Exercises =
                        [
                            new WorkoutExercise
                            {
                                ExerciseExternalId = new Guid("11111111-1111-1111-4444-000000000003"),
                                ExerciseName       = "QA Back Squat",
                                Sets               =
                                [
                                    // Only 1 of 3 planned sets was recorded before the client stopped.
                                    new WorkoutSet { SetNumber = 1, Reps = 5, WeightKg = 100m, CompletedAt = skippedStartedAt.AddMinutes(15) },
                                ],
                            },
                            new WorkoutExercise
                            {
                                ExerciseExternalId = new Guid("11111111-1111-1111-4444-000000000004"),
                                ExerciseName       = "QA Romanian Deadlift",
                                Sets               = [], // exercise was never started
                            },
                        ],
                    },
                ],
            };

            await mongo.WorkoutLogs.InsertOneAsync(skippedLog);
            logger.LogInformation(
                "QA WorkoutLog SKIPPED created: externalId={ExternalId} sessionId={SessionId}",
                QaPastSkippedWorkoutLogId, QaPastSessionSkippedId);
        }
        else
        {
            logger.LogInformation(
                "QA WorkoutLog SKIPPED already present: externalId={ExternalId}", QaPastSkippedWorkoutLogId);
        }

        // PAST-UNTOUCHED: deliberately no WorkoutLog for QaPastSessionUntouchedId.
        logger.LogInformation(
            "QA PastTrainingPlan fixture complete: planId={PlanId} startDate={StartDate} " +
            "completed={CompletedId} skipped={SkippedId} untouched={UntouchedId}",
            QaPastTrainingPlanExternalId, startDate,
            QaPastSessionCompletedId, QaPastSessionSkippedId, QaPastSessionUntouchedId);
    }

    private static async Task EnsureFoodsAsync(
        IMongoContext mongo,
        Guid nutriUserId,
        ILogger logger)
    {
        var foodIds = new[]
        {
            QaFood1ExternalId, QaFood2ExternalId, QaFood3ExternalId,
            QaFood4ExternalId, QaFood5ExternalId,
        };

        var existingCount = await mongo.Foods
            .CountDocumentsAsync(Builders<Food>.Filter.In(f => f.ExternalId, foodIds));

        if (existingCount == foodIds.Length)
        {
            logger.LogInformation("QA Foods already present ({Count}), skipping.", existingCount);
            return;
        }

        var now = DateTime.UtcNow;

        var foods = new List<Food>
        {
            new()
            {
                ExternalId    = QaFood1ExternalId,
                Name          = "Chicken Breast",
                NutritionistId = nutriUserId,
                Visibility    = FoodVisibility.Public,
                Category      = FoodCategory.Meat,
                DateCreated   = now,
                NutrientValue = new NutrientValue { Kcal = 165m, Protein = 31m, Fat = 3.6m, Carbs = 0m },
            },
            new()
            {
                ExternalId    = QaFood2ExternalId,
                Name          = "White Rice (cooked)",
                NutritionistId = nutriUserId,
                Visibility    = FoodVisibility.Public,
                Category      = FoodCategory.GrainsAndCereals,
                DateCreated   = now,
                NutrientValue = new NutrientValue { Kcal = 130m, Protein = 2.7m, Fat = 0.3m, Carbs = 28m },
            },
            new()
            {
                ExternalId    = QaFood3ExternalId,
                Name          = "Broccoli",
                NutritionistId = nutriUserId,
                Visibility    = FoodVisibility.Public,
                Category      = FoodCategory.Vegetables,
                DateCreated   = now,
                NutrientValue = new NutrientValue { Kcal = 34m, Protein = 2.8m, Fat = 0.4m, Carbs = 7m },
            },
            new()
            {
                ExternalId    = QaFood4ExternalId,
                Name          = "Banana (medium)",
                NutritionistId = nutriUserId,
                Visibility    = FoodVisibility.Public,
                Category      = FoodCategory.Fruit,
                DateCreated   = now,
                NutrientValue = new NutrientValue { Kcal = 89m, Protein = 1.1m, Fat = 0.3m, Carbs = 23m },
            },
            new()
            {
                ExternalId    = QaFood5ExternalId,
                Name          = "Rolled Oats",
                NutritionistId = nutriUserId,
                Visibility    = FoodVisibility.Public,
                Category      = FoodCategory.GrainsAndCereals,
                DateCreated   = now,
                NutrientValue = new NutrientValue { Kcal = 389m, Protein = 13.2m, Fat = 6.5m, Carbs = 68m },
            },
        };

        // Insert only those that are missing (partial re-run after partial seed).
        var existingIds = (await mongo.Foods
            .Find(Builders<Food>.Filter.In(f => f.ExternalId, foodIds))
            .Project(f => f.ExternalId)
            .ToListAsync())
            .ToHashSet();

        var toInsert = foods.Where(f => !existingIds.Contains(f.ExternalId)).ToList();
        if (toInsert.Count > 0)
        {
            await mongo.Foods.InsertManyAsync(toInsert);
        }

        logger.LogInformation("QA Foods created: {Count} inserted.", toInsert.Count);
    }

    private static async Task EnsureRecipesAsync(
        IMongoContext mongo,
        Guid nutriUserId,
        ILogger logger)
    {
        var recipeIds = new[] { QaRecipe1ExternalId, QaRecipe2ExternalId, QaRecipe3ExternalId };

        var existingCount = await mongo.Recipes
            .CountDocumentsAsync(Builders<Recipe>.Filter.In(r => r.ExternalId, recipeIds));

        if (existingCount == recipeIds.Length)
        {
            logger.LogInformation("QA Recipes already present ({Count}), skipping.", existingCount);
            return;
        }

        var now = DateTime.UtcNow;

        var recipes = new List<Recipe>
        {
            new()
            {
                ExternalId      = QaRecipe1ExternalId,
                NutritionistId  = nutriUserId,
                Name            = "Chicken, Rice & Broccoli Bowl",
                Description     = "Classic high-protein post-workout meal.",
                PrepTimeMinutes = 20,
                Visibility      = RecipeVisibility.Public,
                DateCreated     = now,
                Foods =
                [
                    new MealFood { FoodExternalId = QaFood1ExternalId, FoodName = "Chicken Breast", AmountGrams = 150m,
                        NutrientValuePer100Grams = new NutrientValue { Kcal = 165m, Protein = 31m, Fat = 3.6m, Carbs = 0m } },
                    new MealFood { FoodExternalId = QaFood2ExternalId, FoodName = "White Rice (cooked)", AmountGrams = 200m,
                        NutrientValuePer100Grams = new NutrientValue { Kcal = 130m, Protein = 2.7m, Fat = 0.3m, Carbs = 28m } },
                    new MealFood { FoodExternalId = QaFood3ExternalId, FoodName = "Broccoli", AmountGrams = 100m,
                        NutrientValuePer100Grams = new NutrientValue { Kcal = 34m, Protein = 2.8m, Fat = 0.4m, Carbs = 7m } },
                ],
            },
            new()
            {
                ExternalId      = QaRecipe2ExternalId,
                NutritionistId  = nutriUserId,
                Name            = "Oats & Banana Breakfast",
                Description     = "Simple overnight oats with banana.",
                PrepTimeMinutes = 5,
                Visibility      = RecipeVisibility.Public,
                DateCreated     = now,
                Foods =
                [
                    new MealFood { FoodExternalId = QaFood5ExternalId, FoodName = "Rolled Oats", AmountGrams = 50m,
                        NutrientValuePer100Grams = new NutrientValue { Kcal = 389m, Protein = 13.2m, Fat = 6.5m, Carbs = 68m } },
                    new MealFood { FoodExternalId = QaFood4ExternalId, FoodName = "Banana (medium)", AmountGrams = 120m,
                        NutrientValuePer100Grams = new NutrientValue { Kcal = 89m, Protein = 1.1m, Fat = 0.3m, Carbs = 23m } },
                ],
            },
            new()
            {
                ExternalId      = QaRecipe3ExternalId,
                NutritionistId  = nutriUserId,
                Name            = "Chicken & Broccoli Stir-fry",
                Description     = "Quick lean stir-fry, no rice.",
                PrepTimeMinutes = 15,
                Visibility      = RecipeVisibility.Public,
                DateCreated     = now,
                Foods =
                [
                    new MealFood { FoodExternalId = QaFood1ExternalId, FoodName = "Chicken Breast", AmountGrams = 180m,
                        NutrientValuePer100Grams = new NutrientValue { Kcal = 165m, Protein = 31m, Fat = 3.6m, Carbs = 0m } },
                    new MealFood { FoodExternalId = QaFood3ExternalId, FoodName = "Broccoli", AmountGrams = 150m,
                        NutrientValuePer100Grams = new NutrientValue { Kcal = 34m, Protein = 2.8m, Fat = 0.4m, Carbs = 7m } },
                ],
            },
        };

        // Insert only those that are missing.
        var existingIds = (await mongo.Recipes
            .Find(Builders<Recipe>.Filter.In(r => r.ExternalId, recipeIds))
            .Project(r => r.ExternalId)
            .ToListAsync())
            .ToHashSet();

        var toInsert = recipes.Where(r => !existingIds.Contains(r.ExternalId)).ToList();
        if (toInsert.Count > 0)
        {
            await mongo.Recipes.InsertManyAsync(toInsert);
        }

        logger.LogInformation("QA Recipes created: {Count} inserted.", toInsert.Count);
    }

    /// <summary>
    /// Seeds one published NutritionPlan assigned to the QA client by the QA nutri.
    /// The plan has 1 week (Status=Published) with 1 day (Monday) containing
    /// Breakfast, Lunch, and Dinner meals.
    /// </summary>
    private static async Task EnsureNutritionPlanAsync(
        IMongoContext mongo,
        Guid clientProfilePublicId,
        Guid nutriProfilePublicId,
        ILogger logger)
    {
        var existing = await mongo.NutritionPlans
            .Find(p => p.ExternalId == QaNutritionPlanExternalId)
            .FirstOrDefaultAsync();

        if (existing is not null)
        {
            logger.LogInformation(
                "QA NutritionPlan already present: externalId={ExternalId}", QaNutritionPlanExternalId);
            return;
        }

        var now = DateTime.UtcNow;

        var plan = new NutritionPlan
        {
            ExternalId     = QaNutritionPlanExternalId,
            ClientId       = clientProfilePublicId,
            NutritionistId = nutriProfilePublicId,
            Name           = "QA Test Nutrition Plan",
            Status         = NutritionPlanStatus.Active,
            DateCreated    = now,
            DatePublished  = now,
            Version        = 1,
            Weeks =
            [
                new PlanWeek
                {
                    WeekNumber    = 1,
                    Status        = WeekStatus.Published,
                    DatePublished = now,
                    Days =
                    [
                        new PlanDay
                        {
                            DayOfWeek = 1, // Monday
                            Meals =
                            [
                                new PlanMeal
                                {
                                    MealId = new Guid("00000000-0000-0000-1111-000000000001"),
                                    Kind   = MealKind.Breakfast,
                                    Order  = 1,
                                    Time   = "08:00",
                                    Foods  = [],
                                },
                                new PlanMeal
                                {
                                    MealId = new Guid("00000000-0000-0000-1111-000000000002"),
                                    Kind   = MealKind.Lunch,
                                    Order  = 2,
                                    Time   = "12:00",
                                    Foods  = [],
                                },
                                new PlanMeal
                                {
                                    MealId = new Guid("00000000-0000-0000-1111-000000000003"),
                                    Kind   = MealKind.Dinner,
                                    Order  = 3,
                                    Time   = "18:00",
                                    Foods  = [],
                                },
                            ],
                        },
                    ],
                },
            ],
        };

        await mongo.NutritionPlans.InsertOneAsync(plan);

        logger.LogInformation(
            "QA NutritionPlan created: externalId={ExternalId} clientId={ClientId}",
            QaNutritionPlanExternalId, clientProfilePublicId);
    }

    private static async Task EnsureAvatarAsync(IServiceProvider sp, ILogger logger)
    {
        var blobStorage = sp.GetRequiredService<IBlobStorageService>();

        if (await blobStorage.ObjectExistsAsync(QaAvatarBlobKey, CancellationToken.None))
        {
            logger.LogInformation("QA avatar blob already present at {Key}, skipping.", QaAvatarBlobKey);
            return;
        }

        var bytes = LoadEmbeddedAsset("qa-avatar.png");
        await blobStorage.UploadAsync(QaAvatarBlobKey, bytes, "image/png", CancellationToken.None);
        logger.LogInformation("QA avatar blob uploaded to {Key} ({Bytes} bytes).", QaAvatarBlobKey, bytes.Length);
    }

    private static async Task EnsureFoodImageAsync(IServiceProvider sp, ILogger logger)
    {
        var blobStorage = sp.GetRequiredService<IBlobStorageService>();

        if (await blobStorage.ObjectExistsAsync(QaFoodImageBlobKey, CancellationToken.None))
        {
            logger.LogInformation("QA food image blob already present at {Key}, skipping.", QaFoodImageBlobKey);
            return;
        }

        var bytes = LoadEmbeddedAsset("qa-food.png");
        await blobStorage.UploadAsync(QaFoodImageBlobKey, bytes, "image/png", CancellationToken.None);
        logger.LogInformation("QA food image blob uploaded to {Key} ({Bytes} bytes).", QaFoodImageBlobKey, bytes.Length);
    }

    private static byte[] LoadEmbeddedAsset(string fileName)
    {
        var asm = typeof(QaSeedRunner).Assembly;
        var resourceName = asm.GetManifestResourceNames()
            .FirstOrDefault(n => n.EndsWith(fileName, StringComparison.Ordinal));
        if (resourceName is null)
            throw new InvalidOperationException(
                $"Embedded asset {fileName} not found. Did the .csproj <EmbeddedResource> entry land?");
        using var stream = asm.GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException(
                $"Could not open embedded asset stream for {fileName}.");
        using var ms = new MemoryStream();
        stream.CopyTo(ms);
        return ms.ToArray();
    }
}
