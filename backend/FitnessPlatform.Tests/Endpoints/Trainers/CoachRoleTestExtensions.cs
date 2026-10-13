using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.Trainers;

/// <summary>
/// Gives a registered coach the other coach role, so a test that registers through <c>/auth/register</c>
/// (one role per account) can still read both disciplines of a both-flags link.
/// </summary>
public static class CoachRoleTestExtensions
{
    /// <summary>
    /// Adds <paramref name="role"/> to the user with <paramref name="email"/>. Call before logging in so the
    /// token carries it.
    /// </summary>
    public static async Task GrantRoleAsync(this FitnessApiFactory factory, string email, string role)
    {
        using var scope = factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await userManager.FindByEmailAsync(email);

        var result = await userManager.AddToRoleAsync(user!, role);

        if (!result.Succeeded)
        {
            throw new InvalidOperationException(
                $"Granting {role} failed: {string.Join(", ", result.Errors.Select(e => e.Description))}");
        }
    }
}
