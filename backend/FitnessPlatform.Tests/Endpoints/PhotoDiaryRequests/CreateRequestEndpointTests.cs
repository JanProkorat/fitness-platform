using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.PhotoDiaryRequests;

/// <summary>
/// Integration tests for POST /trainer/photo-diary-requests.
/// </summary>
[Collection(TestCollection.Name)]
public class CreateRequestEndpointTests(FitnessApiFactory factory)
{
    private static string UniqueEmail(string tag = "trainer") =>
        $"{Guid.NewGuid():N}@{tag}-create-diary.com";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() },
    };

    // ── Setup helpers ──────────────────────────────────────────────────────────

    private async Task<(HttpClient Http, Guid UserId)> SetupProfessionalAsync(string role = "Nutritionist")
    {
        var http = factory.CreateClient();
        var email = UniqueEmail(role.ToLower());
        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "Prof", "Test", role);
        var (token, _) = await TestHelpers.LoginAsync(http, email, "TestPass1!");
        TestHelpers.SetBearerToken(http, token);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.FirstAsync(u => u.Email == email, TestContext.Current.CancellationToken);
        return (http, user.Id);
    }

    private async Task<(HttpClient Http, Guid UserId, string Email)> SetupClientAsync()
    {
        var http = factory.CreateClient();
        var email = UniqueEmail("client");
        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "Client", "Test", "Client");
        var (token, _) = await TestHelpers.LoginAsync(http, email, "TestPass1!");
        TestHelpers.SetBearerToken(http, token);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.FirstAsync(u => u.Email == email, TestContext.Current.CancellationToken);
        return (http, user.Id, email);
    }

    private async Task<long> InsertLinkAsync(Guid clientUserId, Guid professionalUserId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var profProfile = await db.ProfessionalProfiles
            .FirstAsync(p => p.UserId == professionalUserId, TestContext.Current.CancellationToken);
        var clientProfile = await db.ClientProfiles
            .FirstAsync(p => p.UserId == clientUserId, TestContext.Current.CancellationToken);

        var link = new ClientProfessionalLink
        {
            ClientProfileId = clientProfile.Id,
            ProfessionalProfileId = profProfile.Id,
            ProfessionalRole = UserRole.Nutritionist,
            IsActive = true,
            CanViewNutritionPlans = true,
            CanViewTrainingPlans = false,
            PublicId = Guid.NewGuid(),
            DateCreated = DateTime.UtcNow,
        };
        db.ClientProfessionalLinks.Add(link);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        return link.Id;
    }

    private async Task<long> InsertPendingInviteAsync(Guid professionalUserId, string inviteeEmail)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var profProfile = await db.ProfessionalProfiles
            .FirstAsync(p => p.UserId == professionalUserId, TestContext.Current.CancellationToken);

        var invite = new PendingInvite
        {
            ProfessionalProfileId = profProfile.Id,
            FirstName = "Jane",
            LastName = "Doe",
            Email = inviteeEmail,
            SentAt = DateTime.UtcNow,
            IsAccepted = false,
            PublicId = Guid.NewGuid(),
            DateCreated = DateTime.UtcNow,
        };
        db.PendingInvites.Add(invite);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        return invite.Id;
    }

    // ── Auth ──────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Create_Unauthenticated_Returns401()
    {
        var http = factory.CreateClient();
        var response = await http.PostAsJsonAsync(
            "/trainer/photo-diary-requests",
            new { LinkId = 1L },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Create_ClientRole_Returns403()
    {
        var (http, _, _) = await SetupClientAsync();
        var response = await http.PostAsJsonAsync(
            "/trainer/photo-diary-requests",
            new { LinkId = 1L },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ── Validation ────────────────────────────────────────────────────────────

    [Fact]
    public async Task Create_BothLinkAndInvite_Returns400()
    {
        var (http, _) = await SetupProfessionalAsync();
        var response = await http.PostAsJsonAsync(
            "/trainer/photo-diary-requests",
            new { LinkId = 1L, PendingInviteId = 2L, DurationDays = 7 },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Create_NeitherLinkNorInvite_Returns400()
    {
        var (http, _) = await SetupProfessionalAsync();
        var response = await http.PostAsJsonAsync(
            "/trainer/photo-diary-requests",
            new { DurationDays = 7 },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Create_DurationDaysZero_Returns400()
    {
        var (http, _) = await SetupProfessionalAsync();
        var response = await http.PostAsJsonAsync(
            "/trainer/photo-diary-requests",
            new { LinkId = 1L, DurationDays = 0 },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Create_DurationDays31_Returns400()
    {
        var (http, _) = await SetupProfessionalAsync();
        var response = await http.PostAsJsonAsync(
            "/trainer/photo-diary-requests",
            new { LinkId = 1L, DurationDays = 31 },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ── Ownership ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Create_LinkOwnedByAnotherProfessional_Returns404()
    {
        var (http, _) = await SetupProfessionalAsync();
        var (_, otherProfId) = await SetupProfessionalAsync();
        var (_, clientUserId, _) = await SetupClientAsync();

        // Link belongs to otherProf, not http's user
        var linkId = await InsertLinkAsync(clientUserId, otherProfId);

        var response = await http.PostAsJsonAsync(
            "/trainer/photo-diary-requests",
            new { LinkId = linkId, DurationDays = 7 },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Create_InviteOwnedByAnotherProfessional_Returns404()
    {
        var (http, _) = await SetupProfessionalAsync();
        var (_, otherProfId) = await SetupProfessionalAsync();

        var inviteId = await InsertPendingInviteAsync(otherProfId, "someone@example.com");

        var response = await http.PostAsJsonAsync(
            "/trainer/photo-diary-requests",
            new { PendingInviteId = inviteId, DurationDays = 7 },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Happy path — link-based ───────────────────────────────────────────────

    [Fact]
    public async Task Create_WithValidLink_Returns201_AndPersists()
    {
        var (http, profId) = await SetupProfessionalAsync();
        var (_, clientUserId, _) = await SetupClientAsync();
        var linkId = await InsertLinkAsync(clientUserId, profId);

        var response = await http.PostAsJsonAsync(
            "/trainer/photo-diary-requests",
            new { LinkId = linkId, DurationDays = 14 },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var body = await response.Content.ReadFromJsonAsync<CreateResponseBody>(
            JsonOptions, TestContext.Current.CancellationToken);
        body.Should().NotBeNull();
        body!.Status.Should().Be(PhotoDiaryStatus.Pending);
        body.DurationDays.Should().Be(14);
        body.LinkId.Should().Be(linkId);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var persisted = await db.PhotoDiaryRequests
            .FirstOrDefaultAsync(r => r.Id == body.Id, TestContext.Current.CancellationToken);
        persisted.Should().NotBeNull();
        persisted!.ProfessionalId.Should().Be(profId);
        persisted.Status.Should().Be(PhotoDiaryStatus.Pending);
    }

    // ── Happy path — invite-based ─────────────────────────────────────────────

    [Fact]
    public async Task Create_WithValidInvite_Returns201_AndPersists()
    {
        var (http, profId) = await SetupProfessionalAsync();
        var inviteId = await InsertPendingInviteAsync(profId, "invite-test@example.com");

        var response = await http.PostAsJsonAsync(
            "/trainer/photo-diary-requests",
            new { PendingInviteId = inviteId, DurationDays = 7 },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var body = await response.Content.ReadFromJsonAsync<CreateResponseBody>(
            JsonOptions, TestContext.Current.CancellationToken);
        body.Should().NotBeNull();
        body!.PendingInviteId.Should().Be(inviteId);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var persisted = await db.PhotoDiaryRequests
            .FirstOrDefaultAsync(r => r.Id == body.Id, TestContext.Current.CancellationToken);
        persisted.Should().NotBeNull();
        persisted!.LinkId.Should().BeNull();
        persisted.PendingInviteId.Should().Be(inviteId);
    }

    // ── Response shape helper ──────────────────────────────────────────────────

    private record CreateResponseBody(
        Guid Id,
        Guid ProfessionalId,
        long? LinkId,
        long? PendingInviteId,
        Guid? PlanId,
        int DurationDays,
        PhotoDiaryStatus Status,
        DateTimeOffset CreatedAt);
}
