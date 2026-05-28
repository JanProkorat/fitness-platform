using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using FitnessPlatform.Tests.Infrastructure;

namespace FitnessPlatform.Tests.Endpoints.Users;

/// <summary>
/// Integration tests for <c>POST /users/me/roles</c> using a real PostgreSQL instance
/// (Testcontainers). Covers the defense-in-depth allow-list introduced in issue #308:
/// <list type="bullet">
///   <item>AC2 — Trainer-token cannot self-promote to Admin (400).</item>
///   <item>AC3 — Nutritionist-token cannot add Client role (400).</item>
///   <item>Positive path — Trainer may add Nutritionist (200 + fresh tokens).</item>
/// </list>
/// </summary>
[Collection(TestCollection.Name)]
public class AddRoleEndpointIntegrationTests(FitnessApiFactory factory)
{
    private static string UniqueEmail() => $"{Guid.NewGuid():N}@addrole-test.com";
    private const string TestPassword = "TestPass1!";

    // ── AC2: Trainer cannot add Admin role ───────────────────────────────────

    [Fact]
    public async Task Post_RolesMe_AsTrainer_WithAdminRole_Returns400()
    {
        var client = factory.CreateClient();
        var email = UniqueEmail();

        await TestHelpers.RegisterAsync(client, email, TestPassword, "Alice", "Trainer", "Trainer");
        var (token, _) = await TestHelpers.LoginAsync(client, email, TestPassword);
        TestHelpers.SetBearerToken(client, token);

        var resp = await client.PostAsJsonAsync(
            "/users/me/roles",
            new { Role = "Admin" },
            TestContext.Current.CancellationToken);

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ── AC3: Nutritionist cannot add Client role ─────────────────────────────

    [Fact]
    public async Task Post_RolesMe_AsNutritionist_WithClientRole_Returns400()
    {
        var client = factory.CreateClient();
        var email = UniqueEmail();

        await TestHelpers.RegisterAsync(client, email, TestPassword, "Bob", "Nutri", "Nutritionist");
        var (token, _) = await TestHelpers.LoginAsync(client, email, TestPassword);
        TestHelpers.SetBearerToken(client, token);

        var resp = await client.PostAsJsonAsync(
            "/users/me/roles",
            new { Role = "Client" },
            TestContext.Current.CancellationToken);

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ── Positive path: Trainer may add Nutritionist ──────────────────────────

    [Fact]
    public async Task Post_RolesMe_AsTrainer_WithNutritionist_Returns200()
    {
        var client = factory.CreateClient();
        var email = UniqueEmail();

        await TestHelpers.RegisterAsync(client, email, TestPassword, "Carol", "Trainer", "Trainer");
        var (token, _) = await TestHelpers.LoginAsync(client, email, TestPassword);
        TestHelpers.SetBearerToken(client, token);

        var resp = await client.PostAsJsonAsync(
            "/users/me/roles",
            new { Role = "Nutritionist" },
            TestContext.Current.CancellationToken);

        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await resp.Content.ReadFromJsonAsync<AddRoleResult>(
            cancellationToken: TestContext.Current.CancellationToken);

        body.Should().NotBeNull();
        body!.AddedRole.Should().Be("Nutritionist");
        body.AccessToken.Should().NotBeNullOrEmpty();
    }

    // ── Local response DTO (per slice rules — no cross-feature imports) ──────

    private record AddRoleResult(string AddedRole, string AccessToken, string RefreshToken, DateTime ExpiresAt);
}
