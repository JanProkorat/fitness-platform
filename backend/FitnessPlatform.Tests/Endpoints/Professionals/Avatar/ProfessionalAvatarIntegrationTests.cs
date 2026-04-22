using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.Professionals.Avatar;

/// <summary>
/// Integration tests for the professional avatar endpoints using a real PostgreSQL instance
/// (Testcontainers). Covers:
/// - PUT /professionals/me/avatar  — persist and return
/// - DELETE /professionals/me/avatar — clear
/// - GET /professionals/search — avatarBlobUrl present in list response
/// - GET /professionals/{id}   — avatarBlobUrl present in detail response
/// - Unauthenticated access — 401
/// - Client (non-professional) — blocked by role policy
/// </summary>
[Collection(TestCollection.Name)]
public class ProfessionalAvatarIntegrationTests(FitnessApiFactory factory)
{
    private static string UniqueEmail() => $"{Guid.NewGuid():N}@prof-avatar-test.com";
    private const string TestPassword = "TestPass1!";

    // ── PUT /professionals/me/avatar ─────────────────────────────────────────

    [Fact]
    public async Task PutAvatar_AuthenticatedTrainer_Returns204_AndStoresUrl()
    {
        var client = factory.CreateClient();
        var email = UniqueEmail();

        await TestHelpers.RegisterAsync(client, email, TestPassword, "Alice", "Trainer", "Trainer");
        var (token, _) = await TestHelpers.LoginAsync(client, email, TestPassword);
        TestHelpers.SetBearerToken(client, token);

        const string blobUrl = "avatars/prof-99.jpg";

        var putResp = await client.PutAsJsonAsync(
            "/professionals/me/avatar",
            new { BlobUrl = blobUrl },
            TestContext.Current.CancellationToken);

        putResp.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify it's persisted in Postgres
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var userId = (await db.Users.FirstAsync(
            u => u.Email == email,
            TestContext.Current.CancellationToken)).Id;
        var profile = await db.ProfessionalProfiles.FirstAsync(
            p => p.UserId == userId,
            TestContext.Current.CancellationToken);

        profile.AvatarBlobUrl.Should().Be(blobUrl);
    }

    [Fact]
    public async Task PutAvatar_Unauthenticated_Returns401()
    {
        var client = factory.CreateClient();

        var resp = await client.PutAsJsonAsync(
            "/professionals/me/avatar",
            new { BlobUrl = "avatars/some.jpg" },
            TestContext.Current.CancellationToken);

        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task PutAvatar_ClientRole_Returns403()
    {
        var client = factory.CreateClient();
        var email = UniqueEmail();

        await TestHelpers.RegisterAsync(client, email, TestPassword, "Bob", "Client", "Client");
        var (token, _) = await TestHelpers.LoginAsync(client, email, TestPassword);
        TestHelpers.SetBearerToken(client, token);

        var resp = await client.PutAsJsonAsync(
            "/professionals/me/avatar",
            new { BlobUrl = "avatars/some.jpg" },
            TestContext.Current.CancellationToken);

        resp.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ── DELETE /professionals/me/avatar ─────────────────────────────────────

    [Fact]
    public async Task DeleteAvatar_AuthenticatedTrainer_Returns204_AndClearsUrl()
    {
        var client = factory.CreateClient();
        var email = UniqueEmail();

        await TestHelpers.RegisterAsync(client, email, TestPassword, "Carol", "Trainer", "Trainer");
        var (token, _) = await TestHelpers.LoginAsync(client, email, TestPassword);
        TestHelpers.SetBearerToken(client, token);

        // Set an avatar first
        await client.PutAsJsonAsync(
            "/professionals/me/avatar",
            new { BlobUrl = "avatars/prof-delete-test.jpg" },
            TestContext.Current.CancellationToken);

        // Then delete it
        var delResp = await client.DeleteAsync(
            "/professionals/me/avatar",
            TestContext.Current.CancellationToken);

        delResp.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify it's null in Postgres
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var userId = (await db.Users.FirstAsync(
            u => u.Email == email,
            TestContext.Current.CancellationToken)).Id;
        var profile = await db.ProfessionalProfiles.FirstAsync(
            p => p.UserId == userId,
            TestContext.Current.CancellationToken);

        profile.AvatarBlobUrl.Should().BeNull();
    }

    [Fact]
    public async Task DeleteAvatar_Unauthenticated_Returns401()
    {
        var client = factory.CreateClient();

        var resp = await client.DeleteAsync(
            "/professionals/me/avatar",
            TestContext.Current.CancellationToken);

        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── GET /professionals/search — avatarBlobUrl in list ───────────────────

    [Fact]
    public async Task SearchProfessionals_TrainerWithAvatar_IncludesAvatarBlobUrl()
    {
        var trainerClient = factory.CreateClient();
        var trainerEmail = UniqueEmail();

        await TestHelpers.RegisterAsync(trainerClient, trainerEmail, TestPassword, "Dan", "SearchAvatar", "Trainer");
        var (trainerToken, _) = await TestHelpers.LoginAsync(trainerClient, trainerEmail, TestPassword);
        TestHelpers.SetBearerToken(trainerClient, trainerToken);

        const string blobUrl = "avatars/prof-search-test.jpg";
        await trainerClient.PutAsJsonAsync(
            "/professionals/me/avatar",
            new { BlobUrl = blobUrl },
            TestContext.Current.CancellationToken);

        // Register a client who will perform the search
        var searchClient = factory.CreateClient();
        var clientEmail = UniqueEmail();
        await TestHelpers.RegisterAsync(searchClient, clientEmail, TestPassword, "Eve", "Seeker", "Client");
        var (clientToken, _) = await TestHelpers.LoginAsync(searchClient, clientEmail, TestPassword);
        TestHelpers.SetBearerToken(searchClient, clientToken);

        var searchResp = await searchClient.GetAsync(
            "/professionals/search",
            TestContext.Current.CancellationToken);

        searchResp.StatusCode.Should().Be(HttpStatusCode.OK);

        var raw = await searchResp.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        raw.Should().Contain("avatarBlobUrl");
    }

    [Fact]
    public async Task SearchProfessionals_TrainerWithAvatar_ResponseContainsCorrectUrl()
    {
        var trainerClient = factory.CreateClient();
        var trainerEmail = UniqueEmail();

        await TestHelpers.RegisterAsync(trainerClient, trainerEmail, TestPassword, "Frank", "AvatarTrainer", "Trainer");
        var (trainerToken, _) = await TestHelpers.LoginAsync(trainerClient, trainerEmail, TestPassword);
        TestHelpers.SetBearerToken(trainerClient, trainerToken);

        const string blobUrl = "avatars/prof-frank.png";
        await trainerClient.PutAsJsonAsync(
            "/professionals/me/avatar",
            new { BlobUrl = blobUrl },
            TestContext.Current.CancellationToken);

        // Register a client searcher
        var searchClient = factory.CreateClient();
        var clientEmail = UniqueEmail();
        await TestHelpers.RegisterAsync(searchClient, clientEmail, TestPassword, "Grace", "Finder", "Client");
        var (clientToken, _) = await TestHelpers.LoginAsync(searchClient, clientEmail, TestPassword);
        TestHelpers.SetBearerToken(searchClient, clientToken);

        var searchResp = await searchClient.GetAsync(
            "/professionals/search",
            TestContext.Current.CancellationToken);

        searchResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var raw = await searchResp.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        raw.Should().Contain(blobUrl);
    }

    // ── GET /professionals/{publicId} — avatarBlobUrl in detail ─────────────

    [Fact]
    public async Task GetPublicProfile_TrainerWithAvatar_IncludesAvatarBlobUrl()
    {
        var trainerClient = factory.CreateClient();
        var trainerEmail = UniqueEmail();

        await TestHelpers.RegisterAsync(trainerClient, trainerEmail, TestPassword, "Hank", "DetailAvatar", "Trainer");
        var (trainerToken, _) = await TestHelpers.LoginAsync(trainerClient, trainerEmail, TestPassword);
        TestHelpers.SetBearerToken(trainerClient, trainerToken);

        const string blobUrl = "avatars/prof-hank-detail.jpg";
        await trainerClient.PutAsJsonAsync(
            "/professionals/me/avatar",
            new { BlobUrl = blobUrl },
            TestContext.Current.CancellationToken);

        // Resolve the trainer's publicId from Postgres
        Guid publicId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var userId = (await db.Users.FirstAsync(
                u => u.Email == trainerEmail,
                TestContext.Current.CancellationToken)).Id;
            var profile = await db.ProfessionalProfiles.FirstAsync(
                p => p.UserId == userId,
                TestContext.Current.CancellationToken);
            publicId = profile.PublicId;
        }

        // Register a client who will view the profile
        var viewClient = factory.CreateClient();
        var clientEmail = UniqueEmail();
        await TestHelpers.RegisterAsync(viewClient, clientEmail, TestPassword, "Iris", "Viewer", "Client");
        var (clientToken, _) = await TestHelpers.LoginAsync(viewClient, clientEmail, TestPassword);
        TestHelpers.SetBearerToken(viewClient, clientToken);

        var detailResp = await viewClient.GetAsync(
            $"/professionals/{publicId}",
            TestContext.Current.CancellationToken);

        detailResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var raw = await detailResp.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        raw.Should().Contain("avatarBlobUrl");
        raw.Should().Contain(blobUrl);
    }

    [Fact]
    public async Task GetPublicProfile_TrainerWithoutAvatar_AvatarBlobUrlIsNull()
    {
        var trainerClient = factory.CreateClient();
        var trainerEmail = UniqueEmail();

        await TestHelpers.RegisterAsync(trainerClient, trainerEmail, TestPassword, "Jack", "NoAvatarTrainer", "Trainer");

        // Resolve publicId
        Guid publicId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var userId = (await db.Users.FirstAsync(
                u => u.Email == trainerEmail,
                TestContext.Current.CancellationToken)).Id;
            var profile = await db.ProfessionalProfiles.FirstAsync(
                p => p.UserId == userId,
                TestContext.Current.CancellationToken);
            publicId = profile.PublicId;
        }

        // Register a client viewer
        var viewClient = factory.CreateClient();
        var clientEmail = UniqueEmail();
        await TestHelpers.RegisterAsync(viewClient, clientEmail, TestPassword, "Kate", "Looker", "Client");
        var (clientToken, _) = await TestHelpers.LoginAsync(viewClient, clientEmail, TestPassword);
        TestHelpers.SetBearerToken(viewClient, clientToken);

        var detailResp = await viewClient.GetAsync(
            $"/professionals/{publicId}",
            TestContext.Current.CancellationToken);

        detailResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await detailResp.Content.ReadFromJsonAsync<PublicProfileResponse>(
            cancellationToken: TestContext.Current.CancellationToken);

        body.Should().NotBeNull();
        body!.AvatarBlobUrl.Should().BeNull();
    }

    // ── Local response DTOs (per slice rules — no cross-feature imports) ─────

    private record PublicProfileResponse(string? AvatarBlobUrl);
}
