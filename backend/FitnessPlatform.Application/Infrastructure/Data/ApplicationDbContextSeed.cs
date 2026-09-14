using System.Security.Cryptography;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Application.Infrastructure.Data;

/// <summary>
/// Seeds the database with initial data (roles, system admin user).
/// </summary>
public static class ApplicationDbContextSeed
{
    /// <summary>
    /// Applies pending migrations and seeds the default roles + system admin user.
    /// </summary>
    /// <param name="serviceProvider">The application service provider.</param>
    public static async Task SeedAsync(IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<ApplicationRole>>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        await context.Database.MigrateAsync();

        foreach (var role in Enum.GetValues<UserRole>())
        {
            var roleName = role.ToString();
            if (!await roleManager.RoleExistsAsync(roleName))
            {
                await roleManager.CreateAsync(new ApplicationRole
                {
                    Name = roleName,
                    Description = $"{roleName} role"
                });
            }
        }

        await EnsureSystemAdminAsync(userManager);
        await EnsureSubscriptionPlansAsync(context);
    }

    /// <summary>
    /// Ensures the non-loginable system admin account (<see cref="SystemUsers.AdminId"/>) exists
    /// and is a member of the <see cref="UserRole.Admin"/> role. This account owns seeded catalog
    /// content (recipes, workout templates) where an owner is structurally required — it is never
    /// meant to authenticate: the password is cryptographically random and is never logged or
    /// otherwise revealed. Idempotent — safe to call on every startup.
    /// </summary>
    private static async Task EnsureSystemAdminAsync(UserManager<ApplicationUser> userManager)
    {
        var admin = await userManager.FindByIdAsync(SystemUsers.AdminId.ToString());

        if (admin is null)
        {
            admin = new ApplicationUser
            {
                Id = SystemUsers.AdminId,
                UserName = SystemUsers.AdminEmail,
                Email = SystemUsers.AdminEmail,
                EmailConfirmed = true,
                IsActive = true,
                FirstName = "GoodFellas",
                LastName = "System",
                GdprConsent = true,
            };

            var createResult = await userManager.CreateAsync(admin, GenerateRandomPassword());
            if (!createResult.Succeeded)
            {
                var errors = string.Join("; ", createResult.Errors.Select(e => $"{e.Code}: {e.Description}"));
                throw new InvalidOperationException($"Failed to create system admin user: {errors}");
            }
        }

        if (!await userManager.IsInRoleAsync(admin, UserRole.Admin.ToString()))
        {
            var roleResult = await userManager.AddToRoleAsync(admin, UserRole.Admin.ToString());
            if (!roleResult.Succeeded)
            {
                var errors = string.Join("; ", roleResult.Errors.Select(e => $"{e.Code}: {e.Description}"));
                throw new InvalidOperationException($"Failed to assign Admin role to system user: {errors}");
            }
        }
    }

    /// <summary>
    /// Seeds a placeholder set of subscription tiers (Free/Small/Medium/Big) so the Admin
    /// management UI (#595, #596) has rows to display on first boot. Upserts by <c>Code</c> —
    /// a plan that already exists is left untouched, so Admin edits made through the CRUD
    /// endpoints are never clobbered by a later boot re-running this seeder. Caps and prices
    /// are intentionally placeholder values; exact figures are a post-consult data change via
    /// the Admin UI, not a code change (#595).
    /// </summary>
    private static async Task EnsureSubscriptionPlansAsync(ApplicationDbContext context)
    {
        var existingCodes = await context.SubscriptionPlans
            .Select(p => p.Code)
            .ToListAsync();

        var placeholderPlans = new[]
        {
            new SubscriptionPlan
            {
                Code = "free",
                NameCs = "Zdarma",
                NameEn = "Free",
                NameDe = "Kostenlos",
                ApplicableRoles = ApplicableRoles.Both,
                CanCreatePlans = false,
                CanMessage = false,
                CanSendQuestionnaires = false,
                CanUseWeeklyCheckIns = false,
                CanUsePerClientCheckInConfig = false,
                MaxActiveClients = 3,
                PriceMinorUnits = 0,
                Currency = SupportedCurrencies.Czk,
                BillingInterval = BillingInterval.Monthly,
                ExternalPriceId = null,
                IsActive = true,
            },
            new SubscriptionPlan
            {
                Code = "small",
                NameCs = "Malý",
                NameEn = "Small",
                NameDe = "Klein",
                ApplicableRoles = ApplicableRoles.Both,
                CanCreatePlans = true,
                CanMessage = true,
                CanSendQuestionnaires = false,
                CanUseWeeklyCheckIns = false,
                CanUsePerClientCheckInConfig = false,
                MaxActiveClients = 10,
                PriceMinorUnits = 29900,
                Currency = SupportedCurrencies.Czk,
                BillingInterval = BillingInterval.Monthly,
                ExternalPriceId = null,
                IsActive = true,
            },
            new SubscriptionPlan
            {
                Code = "medium",
                NameCs = "Střední",
                NameEn = "Medium",
                NameDe = "Mittel",
                ApplicableRoles = ApplicableRoles.Both,
                CanCreatePlans = true,
                CanMessage = true,
                CanSendQuestionnaires = true,
                CanUseWeeklyCheckIns = true,
                CanUsePerClientCheckInConfig = false,
                MaxActiveClients = 30,
                PriceMinorUnits = 59900,
                Currency = SupportedCurrencies.Czk,
                BillingInterval = BillingInterval.Monthly,
                ExternalPriceId = null,
                IsActive = true,
            },
            new SubscriptionPlan
            {
                Code = "big",
                NameCs = "Velký",
                NameEn = "Big",
                NameDe = "Groß",
                ApplicableRoles = ApplicableRoles.Both,
                CanCreatePlans = true,
                CanMessage = true,
                CanSendQuestionnaires = true,
                CanUseWeeklyCheckIns = true,
                CanUsePerClientCheckInConfig = true,
                MaxActiveClients = null,
                PriceMinorUnits = 99900,
                Currency = SupportedCurrencies.Czk,
                BillingInterval = BillingInterval.Monthly,
                ExternalPriceId = null,
                IsActive = true,
            },
        };

        foreach (var plan in placeholderPlans)
        {
            if (!existingCodes.Contains(plan.Code))
            {
                context.SubscriptionPlans.Add(plan);
            }
        }

        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Generates a cryptographically random password satisfying the configured Identity password
    /// policy (min length 8, requires digit + lowercase + uppercase). Never logged or persisted
    /// anywhere but the Identity password hash — the system admin account is not meant to log in.
    /// </summary>
    private static string GenerateRandomPassword()
    {
        const string lower = "abcdefghijkmnopqrstuvwxyz";
        const string upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        const string digits = "23456789";
        const string all = lower + upper + digits;

        var buffer = RandomNumberGenerator.GetBytes(32);
        var chars = new char[32];

        chars[0] = lower[buffer[0] % lower.Length];
        chars[1] = upper[buffer[1] % upper.Length];
        chars[2] = digits[buffer[2] % digits.Length];

        for (var i = 3; i < chars.Length; i++)
        {
            chars[i] = all[buffer[i] % all.Length];
        }

        return new string(chars);
    }
}
