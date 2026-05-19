using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

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

    public static async Task SeedAsync(IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var sp = scope.ServiceProvider;
        var logger = sp.GetRequiredService<ILoggerFactory>().CreateLogger("QaSeed");
        var userManager = sp.GetRequiredService<UserManager<ApplicationUser>>();
        var db = sp.GetRequiredService<ApplicationDbContext>();

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
        await EnsureProfessionalProfileAsync(db, NutriUserId, NutriProfilePublicId, logger);

        // Trainer↔client link — without this the trainer dashboard returns an
        // empty client list and Playwright's getByText('QA Client') never resolves.
        await EnsureTrainerClientLinkAsync(db, trainerProfile, clientProfile, logger);

        logger.LogInformation("QA seed complete — client={Client} trainer={Trainer} nutri={Nutri}",
            ClientEmail, TrainerEmail, NutriEmail);
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
}
