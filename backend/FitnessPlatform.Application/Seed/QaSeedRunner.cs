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
/// </summary>
public static class QaSeedRunner
{
    // IDs are spelled out here so QA fixtures stay stable across rebuilds —
    // qa-tester references them directly in evidence (curl probes, Playwright
    // selectors). Changing them is a fixture-version bump.
    public static readonly Guid ClientUserId    = new("11111111-1111-1111-1111-111111111111");
    public static readonly Guid TrainerUserId   = new("22222222-2222-2222-2222-222222222222");
    public static readonly Guid NutriUserId     = new("33333333-3333-3333-3333-333333333333");

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
}
