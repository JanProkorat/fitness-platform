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

namespace FitnessPlatform.Tests.Endpoints.Questionnaires;

/// <summary>
/// Integration tests for GET /client/questionnaires/pending —
/// verifies that both PendingDiaryRequests and Items are correctly populated,
/// and that ordering (diary first, questionnaire second) is respected.
/// </summary>
[Collection(TestCollection.Name)]
public class GetClientPendingQuestionnairesEndpointTests(FitnessApiFactory factory)
{
    private static string UniqueEmail(string tag = "pq") =>
        $"{Guid.NewGuid():N}@{tag}-pending.com";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() },
    };

    // ── Setup helpers ──────────────────────────────────────────────────────────

    private async Task<(HttpClient Http, Guid UserId, string Email)> SetupClientAsync()
    {
        var http = factory.CreateClient();
        var email = UniqueEmail("client");
        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "Client", "BannerTest", "Client");
        var (token, _) = await TestHelpers.LoginAsync(http, email, "TestPass1!");
        TestHelpers.SetBearerToken(http, token);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.FirstAsync(u => u.Email == email, TestContext.Current.CancellationToken);
        return (http, user.Id, email);
    }

    private async Task<(HttpClient Http, Guid UserId)> SetupNutritionistAsync()
    {
        var http = factory.CreateClient();
        var email = UniqueEmail("nutr");
        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "Nutr", "BannerTest", "Nutritionist");
        var (token, _) = await TestHelpers.LoginAsync(http, email, "TestPass1!");
        TestHelpers.SetBearerToken(http, token);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.FirstAsync(u => u.Email == email, TestContext.Current.CancellationToken);
        return (http, user.Id);
    }

    private async Task<long> InsertLinkAsync(Guid clientUserId, Guid professionalUserId,
        UserRole role = UserRole.Nutritionist, bool isActive = true)
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
            ProfessionalRole = role,
            IsActive = isActive,
            CanViewNutritionPlans = role == UserRole.Nutritionist,
            CanViewTrainingPlans = role == UserRole.Trainer,
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
            FirstName = "Test",
            LastName = "Client",
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
        Guid profUserId,
        long? linkId = null,
        long? inviteId = null,
        PhotoDiaryStatus status = PhotoDiaryStatus.Pending,
        DateTimeOffset? createdAt = null)
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
            CreatedAt = createdAt ?? DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };
        db.PhotoDiaryRequests.Add(request);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        return request.Id;
    }

    // ── Diary request via active link → returned in PendingDiaryRequests ──────

    [Fact]
    public async Task DiaryRequest_ViaActiveLink_AppearsInPendingDiaryRequests()
    {
        var (_, profId) = await SetupNutritionistAsync();
        var (clientHttp, clientUserId, _) = await SetupClientAsync();

        var linkId = await InsertLinkAsync(clientUserId, profId);
        var requestId = await InsertDiaryRequestAsync(profId, linkId: linkId);

        var response = await clientHttp.GetAsync(
            "/client/questionnaires/pending",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<BannerResponse>(
            JsonOptions, TestContext.Current.CancellationToken);

        body.Should().NotBeNull();
        var diaryItem = body!.PendingDiaryRequests.Should()
            .ContainSingle(i => i.RequestPublicId == requestId).Which;
        diaryItem.DurationDays.Should().Be(7);
        diaryItem.Status.Should().Be("Pending");
        diaryItem.ProfessionalRole.Should().Be("Nutritionist");
        diaryItem.ProfessionalName.Should().NotBeNullOrEmpty();
    }

    // ── Diary request via deactivated link → NOT returned ──────────────────────

    [Fact]
    public async Task DiaryRequest_ViaDeactivatedLink_NotReturned()
    {
        var (_, profId) = await SetupNutritionistAsync();
        var (clientHttp, clientUserId, _) = await SetupClientAsync();

        var linkId = await InsertLinkAsync(clientUserId, profId, isActive: false);
        var requestId = await InsertDiaryRequestAsync(profId, linkId: linkId);

        var response = await clientHttp.GetAsync(
            "/client/questionnaires/pending",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<BannerResponse>(
            JsonOptions, TestContext.Current.CancellationToken);

        body!.PendingDiaryRequests.Should().NotContain(i => i.RequestPublicId == requestId);
    }

    // ── Deactivated link + matching pending invite → invite request survives ──

    [Fact]
    public async Task DiaryRequest_DeactivatedLinkWithMatchingInvite_OnlyInviteRoutedRequestReturned()
    {
        var (_, profId) = await SetupNutritionistAsync();
        var (clientHttp, clientUserId, clientEmail) = await SetupClientAsync();

        var deactivatedLinkId = await InsertLinkAsync(clientUserId, profId, isActive: false);
        var inviteId = await InsertPendingInviteAsync(profId, clientEmail);

        var linkRoutedRequestId = await InsertDiaryRequestAsync(profId, linkId: deactivatedLinkId);
        var inviteRoutedRequestId = await InsertDiaryRequestAsync(profId, inviteId: inviteId);

        var response = await clientHttp.GetAsync(
            "/client/questionnaires/pending",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<BannerResponse>(
            JsonOptions, TestContext.Current.CancellationToken);

        body!.PendingDiaryRequests.Should().Contain(i => i.RequestPublicId == inviteRoutedRequestId);
        body.PendingDiaryRequests.Should().NotContain(i => i.RequestPublicId == linkRoutedRequestId);
    }

    // ── Diary request via pending invite → returned (email-matched) ───────────

    [Fact]
    public async Task DiaryRequest_ViaPendingInvite_AppearsInPendingDiaryRequests()
    {
        var (_, profId) = await SetupNutritionistAsync();
        var (clientHttp, _, clientEmail) = await SetupClientAsync();

        var inviteId = await InsertPendingInviteAsync(profId, clientEmail);
        var requestId = await InsertDiaryRequestAsync(profId, inviteId: inviteId);

        var response = await clientHttp.GetAsync(
            "/client/questionnaires/pending",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<BannerResponse>(
            JsonOptions, TestContext.Current.CancellationToken);

        body!.PendingDiaryRequests.Should().Contain(i => i.RequestPublicId == requestId);
    }

    // ── Non-pending statuses are excluded ─────────────────────────────────────

    [Fact]
    public async Task DiaryRequest_NonPendingStatus_NotReturned()
    {
        var (_, profId) = await SetupNutritionistAsync();
        var (clientHttp, clientUserId, _) = await SetupClientAsync();

        var linkId = await InsertLinkAsync(clientUserId, profId);

        var acceptedId = await InsertDiaryRequestAsync(profId, linkId: linkId, status: PhotoDiaryStatus.Accepted);
        var dismissedId = await InsertDiaryRequestAsync(profId, linkId: linkId, status: PhotoDiaryStatus.Dismissed);
        var inProgressId = await InsertDiaryRequestAsync(profId, linkId: linkId, status: PhotoDiaryStatus.InProgress);
        var completedId = await InsertDiaryRequestAsync(profId, linkId: linkId, status: PhotoDiaryStatus.Completed);

        var response = await clientHttp.GetAsync(
            "/client/questionnaires/pending",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<BannerResponse>(
            JsonOptions, TestContext.Current.CancellationToken);

        var ids = body!.PendingDiaryRequests.Select(i => i.RequestPublicId).ToList();
        ids.Should().NotContain(acceptedId);
        ids.Should().NotContain(dismissedId);
        ids.Should().NotContain(inProgressId);
        ids.Should().NotContain(completedId);
    }

    // ── IDOR: diary request for another client is not returned ────────────────

    [Fact]
    public async Task DiaryRequest_BelongingToAnotherClient_NotReturned()
    {
        var (_, profId) = await SetupNutritionistAsync();
        var (clientHttp, _, _) = await SetupClientAsync();
        var (_, otherClientId, _) = await SetupClientAsync();

        var otherLinkId = await InsertLinkAsync(otherClientId, profId);
        var otherRequestId = await InsertDiaryRequestAsync(profId, linkId: otherLinkId);

        var response = await clientHttp.GetAsync(
            "/client/questionnaires/pending",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<BannerResponse>(
            JsonOptions, TestContext.Current.CancellationToken);

        body!.PendingDiaryRequests.Should().NotContain(i => i.RequestPublicId == otherRequestId);
    }

    // ── Mixed: both a diary request and a questionnaire → both returned ───────

    [Fact]
    public async Task Mixed_PendingDiaryAndQuestionnaire_BothReturned()
    {
        var (_, profId) = await SetupNutritionistAsync();
        var (clientHttp, clientUserId, _) = await SetupClientAsync();

        var linkId = await InsertLinkAsync(clientUserId, profId);
        var diaryRequestId = await InsertDiaryRequestAsync(profId, linkId: linkId);

        // Seed a questionnaire for this professional so the pending questionnaire list is non-empty
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var questionnaire = new Questionnaire
            {
                PublicId = Guid.NewGuid(),
                ProfessionalId = profId,
                Title = "Onboarding",
                IsDefault = true,
                IsActive = true,
                DateCreated = DateTime.UtcNow,
            };
            db.Questionnaires.Add(questionnaire);
            await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var response = await clientHttp.GetAsync(
            "/client/questionnaires/pending",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<BannerResponse>(
            JsonOptions, TestContext.Current.CancellationToken);

        body!.PendingDiaryRequests.Should().Contain(i => i.RequestPublicId == diaryRequestId);
        body.Items.Should().NotBeEmpty("the questionnaire seeded for this professional should appear");
    }

    // ── Empty: no pending of either type → both arrays are empty ─────────────

    [Fact]
    public async Task EmptyClient_NoPendingOfEitherType_BothArraysEmpty()
    {
        var (clientHttp, _, _) = await SetupClientAsync();

        var response = await clientHttp.GetAsync(
            "/client/questionnaires/pending",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<BannerResponse>(
            JsonOptions, TestContext.Current.CancellationToken);

        body.Should().NotBeNull();
        body!.PendingDiaryRequests.Should().BeEmpty();
        body.Items.Should().BeEmpty();
    }

    // ── Ordering: diary CreatedAt DESC ────────────────────────────────────────

    [Fact]
    public async Task DiaryRequests_OrderedByCreatedAtDescending()
    {
        var (_, profId) = await SetupNutritionistAsync();
        var (clientHttp, clientUserId, _) = await SetupClientAsync();

        var linkId = await InsertLinkAsync(clientUserId, profId);

        var olderTime = DateTimeOffset.UtcNow.AddDays(-2);
        var newerTime = DateTimeOffset.UtcNow.AddDays(-1);

        var olderRequestId = await InsertDiaryRequestAsync(profId, linkId: linkId, createdAt: olderTime);
        var newerRequestId = await InsertDiaryRequestAsync(profId, linkId: linkId, createdAt: newerTime);

        var response = await clientHttp.GetAsync(
            "/client/questionnaires/pending",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<BannerResponse>(
            JsonOptions, TestContext.Current.CancellationToken);

        var diaryIds = body!.PendingDiaryRequests
            .Select(i => i.RequestPublicId)
            .ToList();

        // newerRequestId should appear before olderRequestId
        diaryIds.Should().Contain(newerRequestId);
        diaryIds.Should().Contain(olderRequestId);
        diaryIds.IndexOf(newerRequestId).Should().BeLessThan(diaryIds.IndexOf(olderRequestId));
    }

    // ── Response shape helpers ─────────────────────────────────────────────────

    private record DiaryItem(
        Guid RequestPublicId,
        string ProfessionalName,
        string? ProfessionalRole,
        int DurationDays,
        string Status,
        Guid? PlanId,
        DateTimeOffset CreatedAt);

    private record QuestionnaireItem(
        Guid LinkPublicId,
        string ProfessionalName,
        string? ProfessionalRole);

    private record BannerResponse(
        List<DiaryItem> PendingDiaryRequests,
        List<QuestionnaireItem> Items);
}
