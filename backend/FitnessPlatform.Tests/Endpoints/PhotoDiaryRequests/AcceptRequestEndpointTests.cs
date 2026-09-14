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
/// Integration tests for POST /client/photo-diary-requests/{id}/accept.
/// </summary>
[Collection(TestCollection.Name)]
public class AcceptRequestEndpointTests(FitnessApiFactory factory)
{
    private static string UniqueEmail(string tag = "accept") =>
        $"{Guid.NewGuid():N}@{tag}-diary.com";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() },
    };

    // ── Setup helpers ──────────────────────────────────────────────────────────

    private async Task<(HttpClient Http, Guid UserId)> SetupProfessionalAsync()
    {
        var http = factory.CreateClient();
        var email = UniqueEmail("prof");
        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "Prof", "Accept", "Nutritionist");
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
        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "Client", "Accept", "Client");
        var (token, _) = await TestHelpers.LoginAsync(http, email, "TestPass1!");
        TestHelpers.SetBearerToken(http, token);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.FirstAsync(u => u.Email == email, TestContext.Current.CancellationToken);
        return (http, user.Id, email);
    }

    private async Task<long> InsertLinkAsync(Guid clientUserId, Guid professionalUserId, bool isActive = true)
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
            IsActive = isActive,
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

    private async Task<Guid> InsertPendingDiaryRequestViaInviteAsync(
        Guid profUserId, long inviteId,
        PhotoDiaryStatus status = PhotoDiaryStatus.Pending)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var request = new PhotoDiaryRequest
        {
            Id = Guid.NewGuid(),
            ProfessionalId = profUserId,
            PendingInviteId = inviteId,
            DurationDays = 7,
            Status = status,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };
        db.PhotoDiaryRequests.Add(request);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        return request.Id;
    }

    private async Task<Guid> InsertPendingDiaryRequestViaLinkAsync(
        Guid profUserId, long linkId,
        PhotoDiaryStatus status = PhotoDiaryStatus.Pending)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var request = new PhotoDiaryRequest
        {
            Id = Guid.NewGuid(),
            ProfessionalId = profUserId,
            LinkId = linkId,
            DurationDays = 7,
            Status = status,
            Mode = status is PhotoDiaryStatus.Accepted or PhotoDiaryStatus.InProgress or PhotoDiaryStatus.Completed
                ? PhotoDiaryMode.Workflow : null,
            AcceptedAt = status is PhotoDiaryStatus.Accepted or PhotoDiaryStatus.InProgress or PhotoDiaryStatus.Completed
                ? DateTimeOffset.UtcNow : null,
            CompletedAt = status == PhotoDiaryStatus.Completed ? DateTimeOffset.UtcNow : null,
            DismissReason = status == PhotoDiaryStatus.Dismissed ? "Not interested" : null,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };
        db.PhotoDiaryRequests.Add(request);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        return request.Id;
    }

    // ── Auth ──────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Accept_Unauthenticated_Returns401()
    {
        var http = factory.CreateClient();
        var response = await http.PostAsJsonAsync(
            $"/client/photo-diary-requests/{Guid.NewGuid()}/accept",
            new { Mode = 1 },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Accept_TrainerRole_Returns403()
    {
        var (http, _) = await SetupProfessionalAsync();
        var response = await http.PostAsJsonAsync(
            $"/client/photo-diary-requests/{Guid.NewGuid()}/accept",
            new { Mode = 1 },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ── Not found / IDOR ──────────────────────────────────────────────────────

    [Fact]
    public async Task Accept_UnknownId_Returns404()
    {
        var (http, _, _) = await SetupClientAsync();
        var response = await http.PostAsJsonAsync(
            $"/client/photo-diary-requests/{Guid.NewGuid()}/accept",
            new { Mode = PhotoDiaryMode.Bulk },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Accept_OtherClientsRequest_Returns404()
    {
        var (_, profId) = await SetupProfessionalAsync();
        var (_, client1Id, _) = await SetupClientAsync();
        var (http, _, _) = await SetupClientAsync(); // client 2

        var linkId = await InsertLinkAsync(client1Id, profId);
        var requestId = await InsertPendingDiaryRequestViaLinkAsync(profId, linkId);

        var response = await http.PostAsJsonAsync(
            $"/client/photo-diary-requests/{requestId}/accept",
            new { Mode = PhotoDiaryMode.Bulk },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Accept_ViaDeactivatedLink_Returns404()
    {
        var (_, profId) = await SetupProfessionalAsync();
        var (http, clientId, _) = await SetupClientAsync();

        var linkId = await InsertLinkAsync(clientId, profId, isActive: false);
        var requestId = await InsertPendingDiaryRequestViaLinkAsync(profId, linkId);

        var response = await http.PostAsJsonAsync(
            $"/client/photo-diary-requests/{requestId}/accept",
            new { Mode = PhotoDiaryMode.Bulk },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Accept_ViaDeactivatedLinkAlreadyAccepted_Returns404_NotConflict()
    {
        // Ordering guard: ownership must be checked BEFORE the status check, otherwise a
        // 409 on a non-transitionable status would leak the request's existence to a
        // client whose link has since been deactivated.
        var (_, profId) = await SetupProfessionalAsync();
        var (http, clientId, _) = await SetupClientAsync();

        var linkId = await InsertLinkAsync(clientId, profId, isActive: false);
        var requestId = await InsertPendingDiaryRequestViaLinkAsync(profId, linkId, PhotoDiaryStatus.Accepted);

        var response = await http.PostAsJsonAsync(
            $"/client/photo-diary-requests/{requestId}/accept",
            new { Mode = PhotoDiaryMode.Bulk },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Happy path ────────────────────────────────────────────────────────────

    [Fact]
    public async Task Accept_Pending_Returns200_AndTransitions()
    {
        var (_, profId) = await SetupProfessionalAsync();
        var (http, clientId, _) = await SetupClientAsync();

        var linkId = await InsertLinkAsync(clientId, profId);
        var requestId = await InsertPendingDiaryRequestViaLinkAsync(profId, linkId);

        var response = await http.PostAsJsonAsync(
            $"/client/photo-diary-requests/{requestId}/accept",
            new { Mode = PhotoDiaryMode.Workflow },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<AcceptResponseBody>(
            JsonOptions, TestContext.Current.CancellationToken);
        body!.Status.Should().Be(PhotoDiaryStatus.Accepted);
        body.Mode.Should().Be(PhotoDiaryMode.Workflow);
        body.AcceptedAt.Should().NotBeNull();

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var persisted = await db.PhotoDiaryRequests
            .FirstAsync(r => r.Id == requestId, TestContext.Current.CancellationToken);
        persisted.Status.Should().Be(PhotoDiaryStatus.Accepted);
        persisted.Mode.Should().Be(PhotoDiaryMode.Workflow);
        persisted.AcceptedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task Accept_WithBulkMode_Returns200_AndModeIsPersisted()
    {
        var (_, profId) = await SetupProfessionalAsync();
        var (http, clientId, _) = await SetupClientAsync();

        var linkId = await InsertLinkAsync(clientId, profId);
        var requestId = await InsertPendingDiaryRequestViaLinkAsync(profId, linkId);

        var response = await http.PostAsJsonAsync(
            $"/client/photo-diary-requests/{requestId}/accept",
            new { Mode = PhotoDiaryMode.Bulk },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var persisted = await db.PhotoDiaryRequests
            .FirstAsync(r => r.Id == requestId, TestContext.Current.CancellationToken);
        persisted.Mode.Should().Be(PhotoDiaryMode.Bulk);
    }

    [Fact]
    public async Task Accept_ViaPendingInvite_Returns200_AndTransitions()
    {
        // Invite-routed requests (LinkId null, PendingInviteId set) must remain
        // unaffected by the IsActive check, which only applies to the Link branch.
        var (_, profId) = await SetupProfessionalAsync();
        var (http, _, clientEmail) = await SetupClientAsync();

        var inviteId = await InsertPendingInviteAsync(profId, clientEmail);
        var requestId = await InsertPendingDiaryRequestViaInviteAsync(profId, inviteId);

        var response = await http.PostAsJsonAsync(
            $"/client/photo-diary-requests/{requestId}/accept",
            new { Mode = PhotoDiaryMode.Workflow },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var persisted = await db.PhotoDiaryRequests
            .FirstAsync(r => r.Id == requestId, TestContext.Current.CancellationToken);
        persisted.Status.Should().Be(PhotoDiaryStatus.Accepted);
    }

    // ── Conflict — wrong status ────────────────────────────────────────────────

    [Fact]
    public async Task Accept_AlreadyAccepted_Returns409()
    {
        var (_, profId) = await SetupProfessionalAsync();
        var (http, clientId, _) = await SetupClientAsync();

        var linkId = await InsertLinkAsync(clientId, profId);
        var requestId = await InsertPendingDiaryRequestViaLinkAsync(profId, linkId, PhotoDiaryStatus.Accepted);

        var response = await http.PostAsJsonAsync(
            $"/client/photo-diary-requests/{requestId}/accept",
            new { Mode = PhotoDiaryMode.Bulk },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Accept_Dismissed_Returns409()
    {
        var (_, profId) = await SetupProfessionalAsync();
        var (http, clientId, _) = await SetupClientAsync();

        var linkId = await InsertLinkAsync(clientId, profId);
        var requestId = await InsertPendingDiaryRequestViaLinkAsync(profId, linkId, PhotoDiaryStatus.Dismissed);

        var response = await http.PostAsJsonAsync(
            $"/client/photo-diary-requests/{requestId}/accept",
            new { Mode = PhotoDiaryMode.Bulk },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    // ── Response shape helpers ─────────────────────────────────────────────────

    private record AcceptResponseBody(
        Guid Id,
        PhotoDiaryStatus Status,
        PhotoDiaryMode? Mode,
        DateTimeOffset? AcceptedAt);
}
