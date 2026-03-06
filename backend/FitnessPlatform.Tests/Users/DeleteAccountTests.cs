using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using FitnessPlatform.Tests.Infrastructure;

namespace FitnessPlatform.Tests.Users;

/// <summary>
/// Integration tests for GDPR account deletion (DELETE /users/me).
/// </summary>
[Collection(TestCollection.Name)]
public class DeleteAccountTests(FitnessApiFactory factory)
{
    private static string UniqueEmail() => $"{Guid.NewGuid():N}@test.com";

    [Fact]
    public async Task DeleteAccount_AuthenticatedUser_Returns204()
    {
        var client = factory.CreateClient();
        var email = UniqueEmail();

        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "John", "Doe", "Client");
        var (accessToken, _) = await TestHelpers.LoginAsync(client, email, "TestPass1!");

        TestHelpers.SetBearerToken(client, accessToken);

        var response = await client.DeleteAsync("/users/me", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task DeleteAccount_CannotLoginAfterDeletion()
    {
        var client = factory.CreateClient();
        var email = UniqueEmail();

        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "John", "Doe", "Client");
        var (accessToken, _) = await TestHelpers.LoginAsync(client, email, "TestPass1!");

        TestHelpers.SetBearerToken(client, accessToken);
        await client.DeleteAsync("/users/me", TestContext.Current.CancellationToken);

        // Clear bearer token
        client.DefaultRequestHeaders.Authorization = null;

        var loginResponse = await client.PostAsJsonAsync("/auth/login", new
        {
            Email = email,
            Password = "TestPass1!"
        }, cancellationToken: TestContext.Current.CancellationToken);

        loginResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task DeleteAccount_WithoutToken_Returns401()
    {
        var client = factory.CreateClient();

        var response = await client.DeleteAsync("/users/me", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task DeleteAccount_ProfileEndpointReturns401AfterDeletion()
    {
        var client = factory.CreateClient();
        var email = UniqueEmail();

        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "John", "Doe", "Client");
        var (accessToken, _) = await TestHelpers.LoginAsync(client, email, "TestPass1!");

        TestHelpers.SetBearerToken(client, accessToken);
        await client.DeleteAsync("/users/me", TestContext.Current.CancellationToken);

        // The old token still passes JWT validation but user no longer exists
        var profileResponse = await client.GetAsync("/users/me", TestContext.Current.CancellationToken);

        profileResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
