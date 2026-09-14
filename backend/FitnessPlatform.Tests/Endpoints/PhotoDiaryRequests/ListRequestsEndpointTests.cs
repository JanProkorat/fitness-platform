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
/// Integration tests for GET /trainer/photo-diary-requests and GET /client/photo-diary-requests.
/// </summary>
[Collection(TestCollection.Name)]
public class ListRequestsEndpointTests(FitnessApiFactory factory)
{
    private static string UniqueEmail(string tag = "list") =>
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
        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "Prof", "List", "Nutritionist");
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
        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "Client", "List", "Client");
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

    private async Task<Guid> InsertDiaryRequestAsync(
        Guid profUserId, long? linkId = null, long? inviteId = null,
        PhotoDiaryStatus status = PhotoDiaryStatus.Pending)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var request = new PhotoDiaryRequest
        {
            Id = Guid.NewGuid(),
            ProfessionalId = profUserId,
            LinkId = linkId,
            PendingInviteId = inviteId,
            DurationDays = 7,
            Status = status,
            Mode = status is PhotoDiaryStatus.Accepted or PhotoDiaryStatus.InProgress or PhotoDiaryStatus.Completed
                ? PhotoDiaryMode.Bulk : null,
            AcceptedAt = status is PhotoDiaryStatus.Accepted or PhotoDiaryStatus.InProgress or PhotoDiaryStatus.Completed
                ? DateTimeOffset.UtcNow : null,
            CompletedAt = status == PhotoDiaryStatus.Completed ? DateTimeOffset.UtcNow : null,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };
        db.PhotoDiaryRequests.Add(request);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        return request.Id;
    }

    // ── Trainer list ───────────────────────────────────────────────────────────

    [Fact]
    public async Task ListTrainer_Unauthenticated_Returns401()
    {
        var http = factory.CreateClient();
        var response = await http.GetAsync(
            "/trainer/photo-diary-requests",
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ListTrainer_ClientRole_Returns403()
    {
        var (http, _, _) = await SetupClientAsync();
        var response = await http.GetAsync(
            "/trainer/photo-diary-requests",
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task ListTrainer_ReturnsOnlyOwnRequests()
    {
        var (http, profId) = await SetupProfessionalAsync();
        var (_, otherProfId) = await SetupProfessionalAsync();
        var (_, clientUserId, _) = await SetupClientAsync();

        var linkId = await InsertLinkAsync(clientUserId, profId);
        var otherLinkId = await InsertLinkAsync(clientUserId, otherProfId);

        var myRequestId = await InsertDiaryRequestAsync(profId, linkId: linkId);
        await InsertDiaryRequestAsync(otherProfId, linkId: otherLinkId);

        var response = await http.GetAsync(
            "/trainer/photo-diary-requests",
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<ListResponseBody>(
            JsonOptions, TestContext.Current.CancellationToken);
        body.Should().NotBeNull();
        body!.Items.Should().Contain(i => i.Id == myRequestId);
        body.Items.Should().NotContain(i => i.ProfessionalId == otherProfId);
    }

    [Fact]
    public async Task ListTrainer_StatusFilter_Works()
    {
        var (http, profId) = await SetupProfessionalAsync();
        var (_, clientUserId, _) = await SetupClientAsync();

        var linkId = await InsertLinkAsync(clientUserId, profId);

        await InsertDiaryRequestAsync(profId, linkId: linkId, status: PhotoDiaryStatus.Pending);
        await InsertDiaryRequestAsync(profId, linkId: linkId, status: PhotoDiaryStatus.Accepted);

        var response = await http.GetAsync(
            "/trainer/photo-diary-requests?status=1", // Pending = 1
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<ListResponseBody>(
            JsonOptions, TestContext.Current.CancellationToken);
        body!.Items.Should().OnlyContain(i => i.Status == PhotoDiaryStatus.Pending);
    }

    [Fact]
    public async Task ListTrainer_XTotalCountHeader_IsSet()
    {
        var (http, profId) = await SetupProfessionalAsync();
        var (_, clientUserId, _) = await SetupClientAsync();
        var linkId = await InsertLinkAsync(clientUserId, profId);

        await InsertDiaryRequestAsync(profId, linkId: linkId);
        await InsertDiaryRequestAsync(profId, linkId: linkId);

        var response = await http.GetAsync(
            "/trainer/photo-diary-requests?pageSize=1",
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Headers.Contains("X-Total-Count").Should().BeTrue();
        var total = int.Parse(response.Headers.GetValues("X-Total-Count").First());
        total.Should().BeGreaterThanOrEqualTo(2);
    }

    // ── Client list ────────────────────────────────────────────────────────────

    [Fact]
    public async Task ListClient_Unauthenticated_Returns401()
    {
        var http = factory.CreateClient();
        var response = await http.GetAsync(
            "/client/photo-diary-requests",
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ListClient_TrainerRole_Returns403()
    {
        var (http, _) = await SetupProfessionalAsync();
        var response = await http.GetAsync(
            "/client/photo-diary-requests",
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task ListClient_ReturnsOwnRequestsViaLink()
    {
        var (_, profId) = await SetupProfessionalAsync();
        var (http, clientUserId, _) = await SetupClientAsync();
        var (_, otherClientId, _) = await SetupClientAsync();

        var myLinkId = await InsertLinkAsync(clientUserId, profId);
        var otherLinkId = await InsertLinkAsync(otherClientId, profId);

        var myRequestId = await InsertDiaryRequestAsync(profId, linkId: myLinkId);
        var otherRequestId = await InsertDiaryRequestAsync(profId, linkId: otherLinkId);

        var response = await http.GetAsync(
            "/client/photo-diary-requests",
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<ListResponseBody>(
            JsonOptions, TestContext.Current.CancellationToken);
        body!.Items.Should().Contain(i => i.Id == myRequestId);
        body.Items.Should().NotContain(i => i.Id == otherRequestId);
    }

    [Fact]
    public async Task ListClient_ViaDeactivatedLink_NotReturnedAndExcludedFromTotalCount()
    {
        var (_, profId) = await SetupProfessionalAsync();
        var (http, clientUserId, _) = await SetupClientAsync();

        var deactivatedLinkId = await InsertLinkAsync(clientUserId, profId, isActive: false);
        var requestId = await InsertDiaryRequestAsync(profId, linkId: deactivatedLinkId);

        var response = await http.GetAsync(
            "/client/photo-diary-requests",
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var total = int.Parse(response.Headers.GetValues("X-Total-Count").First());
        total.Should().Be(0);

        var body = await response.Content.ReadFromJsonAsync<ListResponseBody>(
            JsonOptions, TestContext.Current.CancellationToken);
        body!.Items.Should().NotContain(i => i.Id == requestId);
    }

    [Fact]
    public async Task ListClient_DeactivatedLinkWithMatchingInvite_OnlyInviteRoutedRequestReturned()
    {
        var (_, profId) = await SetupProfessionalAsync();
        var (http, clientUserId, clientEmail) = await SetupClientAsync();

        var deactivatedLinkId = await InsertLinkAsync(clientUserId, profId, isActive: false);
        var inviteId = await InsertPendingInviteAsync(profId, clientEmail);

        var linkRoutedRequestId = await InsertDiaryRequestAsync(profId, linkId: deactivatedLinkId);
        var inviteRoutedRequestId = await InsertDiaryRequestAsync(profId, inviteId: inviteId);

        var response = await http.GetAsync(
            "/client/photo-diary-requests",
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<ListResponseBody>(
            JsonOptions, TestContext.Current.CancellationToken);
        body!.Items.Should().Contain(i => i.Id == inviteRoutedRequestId);
        body.Items.Should().NotContain(i => i.Id == linkRoutedRequestId);
    }

    [Fact]
    public async Task ListClient_ReturnsOwnRequestsViaInvite()
    {
        var (_, profId) = await SetupProfessionalAsync();
        var (http, _, clientEmail) = await SetupClientAsync();
        var otherEmail = UniqueEmail("other-invite");

        var myInviteId = await InsertPendingInviteAsync(profId, clientEmail);
        var otherInviteId = await InsertPendingInviteAsync(profId, otherEmail);

        var myRequestId = await InsertDiaryRequestAsync(profId, inviteId: myInviteId);
        var otherRequestId = await InsertDiaryRequestAsync(profId, inviteId: otherInviteId);

        var response = await http.GetAsync(
            "/client/photo-diary-requests",
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<ListResponseBody>(
            JsonOptions, TestContext.Current.CancellationToken);
        body!.Items.Should().Contain(i => i.Id == myRequestId);
        body.Items.Should().NotContain(i => i.Id == otherRequestId);
    }

    // ── Response shape helpers ─────────────────────────────────────────────────

    private record ListItem(Guid Id, Guid ProfessionalId, PhotoDiaryStatus Status);
    private record ListResponseBody(List<ListItem> Items);
}
