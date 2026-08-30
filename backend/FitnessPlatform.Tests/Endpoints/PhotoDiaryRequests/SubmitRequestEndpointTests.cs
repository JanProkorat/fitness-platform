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
/// Integration tests for POST /client/photo-diary-requests/{id}/submit.
/// </summary>
[Collection(TestCollection.Name)]
public class SubmitRequestEndpointTests(FitnessApiFactory factory)
{
    private static string UniqueEmail(string tag = "submit") =>
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
        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "Prof", "Submit", "Nutritionist");
        var (token, _) = await TestHelpers.LoginAsync(http, email, "TestPass1!");
        TestHelpers.SetBearerToken(http, token);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.FirstAsync(u => u.Email == email, TestContext.Current.CancellationToken);
        return (http, user.Id);
    }

    private async Task<(HttpClient Http, Guid UserId)> SetupClientAsync()
    {
        var http = factory.CreateClient();
        var email = UniqueEmail("client");
        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "Client", "Submit", "Client");
        var (token, _) = await TestHelpers.LoginAsync(http, email, "TestPass1!");
        TestHelpers.SetBearerToken(http, token);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.FirstAsync(u => u.Email == email, TestContext.Current.CancellationToken);
        return (http, user.Id);
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

    private async Task<Guid> InsertDiaryRequestAsync(
        Guid profUserId, long linkId,
        PhotoDiaryStatus status)
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
    public async Task Submit_Unauthenticated_Returns401()
    {
        var http = factory.CreateClient();
        var response = await http.PostAsJsonAsync(
            $"/client/photo-diary-requests/{Guid.NewGuid()}/submit",
            new { },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Submit_TrainerRole_Returns403()
    {
        var (http, _) = await SetupProfessionalAsync();
        var response = await http.PostAsJsonAsync(
            $"/client/photo-diary-requests/{Guid.NewGuid()}/submit",
            new { },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ── Not found / IDOR ──────────────────────────────────────────────────────

    [Fact]
    public async Task Submit_UnknownId_Returns404()
    {
        var (http, _) = await SetupClientAsync();
        var response = await http.PostAsJsonAsync(
            $"/client/photo-diary-requests/{Guid.NewGuid()}/submit",
            new { },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Submit_OtherClientsRequest_Returns404()
    {
        var (_, profId) = await SetupProfessionalAsync();
        var (_, client1Id) = await SetupClientAsync();
        var (http, _) = await SetupClientAsync();

        var linkId = await InsertLinkAsync(client1Id, profId);
        var requestId = await InsertDiaryRequestAsync(profId, linkId, PhotoDiaryStatus.Accepted);

        var response = await http.PostAsJsonAsync(
            $"/client/photo-diary-requests/{requestId}/submit",
            new { },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Submit_ViaDeactivatedLink_Returns404()
    {
        var (_, profId) = await SetupProfessionalAsync();
        var (http, clientId) = await SetupClientAsync();

        var linkId = await InsertLinkAsync(clientId, profId, isActive: false);
        var requestId = await InsertDiaryRequestAsync(profId, linkId, PhotoDiaryStatus.Accepted);

        var response = await http.PostAsJsonAsync(
            $"/client/photo-diary-requests/{requestId}/submit",
            new { },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Happy path — Accepted → Completed ─────────────────────────────────────

    [Fact]
    public async Task Submit_FromAccepted_Returns200_AndCompletedAtPersisted()
    {
        var (_, profId) = await SetupProfessionalAsync();
        var (http, clientId) = await SetupClientAsync();

        var linkId = await InsertLinkAsync(clientId, profId);
        var requestId = await InsertDiaryRequestAsync(profId, linkId, PhotoDiaryStatus.Accepted);

        var response = await http.PostAsJsonAsync(
            $"/client/photo-diary-requests/{requestId}/submit",
            new { },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<SubmitResponseBody>(
            JsonOptions, TestContext.Current.CancellationToken);
        body!.Status.Should().Be(PhotoDiaryStatus.Completed);
        body.CompletedAt.Should().NotBeNull();

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var persisted = await db.PhotoDiaryRequests
            .FirstAsync(r => r.Id == requestId, TestContext.Current.CancellationToken);
        persisted.Status.Should().Be(PhotoDiaryStatus.Completed);
        persisted.CompletedAt.Should().NotBeNull();
    }

    // ── Happy path — InProgress → Completed ──────────────────────────────────

    [Fact]
    public async Task Submit_FromInProgress_Returns200_AndCompletes()
    {
        var (_, profId) = await SetupProfessionalAsync();
        var (http, clientId) = await SetupClientAsync();

        var linkId = await InsertLinkAsync(clientId, profId);
        var requestId = await InsertDiaryRequestAsync(profId, linkId, PhotoDiaryStatus.InProgress);

        var response = await http.PostAsJsonAsync(
            $"/client/photo-diary-requests/{requestId}/submit",
            new { },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var persisted = await db.PhotoDiaryRequests
            .FirstAsync(r => r.Id == requestId, TestContext.Current.CancellationToken);
        persisted.Status.Should().Be(PhotoDiaryStatus.Completed);
    }

    // ── Conflict — wrong status ────────────────────────────────────────────────

    [Fact]
    public async Task Submit_FromPending_Returns409()
    {
        var (_, profId) = await SetupProfessionalAsync();
        var (http, clientId) = await SetupClientAsync();

        var linkId = await InsertLinkAsync(clientId, profId);
        var requestId = await InsertDiaryRequestAsync(profId, linkId, PhotoDiaryStatus.Pending);

        var response = await http.PostAsJsonAsync(
            $"/client/photo-diary-requests/{requestId}/submit",
            new { },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Submit_AlreadyCompleted_Returns409()
    {
        var (_, profId) = await SetupProfessionalAsync();
        var (http, clientId) = await SetupClientAsync();

        var linkId = await InsertLinkAsync(clientId, profId);
        var requestId = await InsertDiaryRequestAsync(profId, linkId, PhotoDiaryStatus.Completed);

        var response = await http.PostAsJsonAsync(
            $"/client/photo-diary-requests/{requestId}/submit",
            new { },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Submit_Dismissed_Returns409()
    {
        var (_, profId) = await SetupProfessionalAsync();
        var (http, clientId) = await SetupClientAsync();

        var linkId = await InsertLinkAsync(clientId, profId);
        var requestId = await InsertDiaryRequestAsync(profId, linkId, PhotoDiaryStatus.Dismissed);

        var response = await http.PostAsJsonAsync(
            $"/client/photo-diary-requests/{requestId}/submit",
            new { },
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    // ── Response shape helpers ─────────────────────────────────────────────────

    private record SubmitResponseBody(Guid Id, PhotoDiaryStatus Status, DateTimeOffset? CompletedAt);
}
