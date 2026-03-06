using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace FitnessPlatform.Tests.Infrastructure;

/// <summary>
/// Helper methods for integration tests.
/// </summary>
public static class TestHelpers
{
    /// <summary>
    /// Registers a user and returns the HTTP response.
    /// </summary>
    public static Task<HttpResponseMessage> RegisterAsync(
        HttpClient client, string email, string password, string firstName, string lastName, string role)
    {
        return client.PostAsJsonAsync("/auth/register", new
        {
            Email = email,
            Password = password,
            ConfirmPassword = password,
            FirstName = firstName,
            LastName = lastName,
            Role = role,
            GdprConsent = true
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

    private record LoginResult(string AccessToken, string RefreshToken, DateTime ExpiresAt);
}
