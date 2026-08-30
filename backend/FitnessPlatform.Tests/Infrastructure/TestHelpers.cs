using System.Net.Http.Headers;
using System.Net.Http.Json;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Infrastructure;

/// <summary>
/// Helper methods for integration tests.
/// </summary>
public static class TestHelpers
{
    /// <summary>
    /// Registers a user and returns the HTTP response.
    /// HealthDataConsent defaults to true for the Client role and null for coach roles.
    /// </summary>
    public static Task<HttpResponseMessage> RegisterAsync(
        HttpClient client, string email, string password, string firstName, string lastName, string role)
    {
        var isClient = string.Equals(role, "Client", StringComparison.OrdinalIgnoreCase);
        return RegisterAsync(client, email, password, firstName, lastName, new[] { role },
            gdprConsent: true, healthDataConsent: isClient ? true : null);
    }

    /// <summary>
    /// Registers a user with explicit consent values and returns the HTTP response.
    /// </summary>
    public static Task<HttpResponseMessage> RegisterAsync(
        HttpClient client, string email, string password, string firstName, string lastName,
        string[] roles, bool gdprConsent = true, bool? healthDataConsent = null)
    {
        return client.PostAsJsonAsync("/auth/register", new
        {
            Email = email,
            Password = password,
            ConfirmPassword = password,
            FirstName = firstName,
            LastName = lastName,
            Roles = roles,
            GdprConsent = gdprConsent,
            HealthDataConsent = healthDataConsent
        });
    }

    /// <summary>
    /// Logs in a user and returns the access and refresh tokens.
    /// </summary>
    public static async Task<(string AccessToken, string RefreshToken)> LoginAsync(
        HttpClient client, string email, string password)
    {
        var response = await client.PostAsJsonAsync("/auth/login", new
        {
            Email = email,
            Password = password
        });

        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<LoginResult>();
        return (result!.AccessToken, result.RefreshToken);
    }

    /// <summary>
    /// Sets the Authorization header with a Bearer token.
    /// </summary>
    public static void SetBearerToken(HttpClient client, string token)
    {
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
    }

    /// <summary>
    /// Registers a client and gives the named professional an active
    /// <see cref="ClientProfessionalLink"/> to them carrying both plan capabilities. Returns the
    /// client's <c>ApplicationUser.Id</c> — the key every Mongo plan document's <c>ClientId</c>
    /// carries since #840.
    /// </summary>
    /// <remarks>
    /// Plan-addressed routes authorize on the caller's live link, not on the plan document's
    /// author field, so a fixture that seeds a plan against a fabricated
    /// <c>ClientId = Guid.NewGuid()</c> now gets a 404 before its own subject is reached. Such
    /// fixtures call this instead: the link is what the endpoint asks about, so the link is what
    /// the fixture must provide.
    /// </remarks>
    public static Task<Guid> RegisterLinkedClientAsync(
        FitnessApiFactory factory, Guid professionalUserId, CancellationToken ct) =>
        RegisterLinkedClientAsync(
            factory, professionalUserId, ct, canViewNutritionPlans: true, canViewTrainingPlans: true);

    /// <summary>
    /// Overload allowing the caller to pin the link's per-domain capability flags — used by
    /// mirror-site regression tests that must prove a link granting only one domain is denied on
    /// the other domain's route (a trainer-only link on a nutrition route, and vice versa).
    /// </summary>
    public static async Task<Guid> RegisterLinkedClientAsync(
        FitnessApiFactory factory, Guid professionalUserId, CancellationToken ct,
        bool canViewNutritionPlans, bool canViewTrainingPlans)
    {
        var httpClient = factory.CreateClient();
        var email = $"{Guid.NewGuid():N}@linked-client-fixture.com";
        await RegisterAsync(httpClient, email, "TestPass1!", "Linked", "Client", "Client");

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var user = await db.Users.FirstAsync(u => u.Email == email, ct);
        var clientProfile = await db.ClientProfiles.FirstAsync(cp => cp.UserId == user.Id, ct);
        var professionalProfile = await db.ProfessionalProfiles.FirstAsync(
            pp => pp.UserId == professionalUserId, ct);

        db.ClientProfessionalLinks.Add(new ClientProfessionalLink
        {
            PublicId = Guid.NewGuid(),
            ProfessionalProfileId = professionalProfile.Id,
            ClientProfileId = clientProfile.Id,
            ProfessionalRole = UserRole.Trainer,
            IsActive = true,
            CanViewNutritionPlans = canViewNutritionPlans,
            CanViewTrainingPlans = canViewTrainingPlans,
            DateCreated = DateTime.UtcNow
        });

        await db.SaveChangesAsync(ct);

        return user.Id;
    }

    private record LoginResult(string AccessToken, string RefreshToken, DateTime ExpiresAt);
}
