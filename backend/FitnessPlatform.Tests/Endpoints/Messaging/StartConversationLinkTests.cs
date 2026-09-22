using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.Messaging;

/// <summary>
/// Integration tests for the link-liveness gate <c>StartConversationEndpoint</c> now enforces
/// (#1095): a first message requires a currently live link, but reopening an existing
/// conversation never checks link liveness — closes the pre-existing hole where any trainer
/// could open a thread with any client.
/// </summary>
[Collection(TestCollection.Name)]
public class StartConversationLinkTests(FitnessApiFactory factory)
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };
    private static string UniqueEmail(string tag) => $"{Guid.NewGuid():N}@start-conv-link-{tag}.com";
    private const string Password = "TestPass1!";

    [Fact]
    public async Task StartConversation_UnknownClientPublicId_Returns404()
    {
        var (trainerHttp, _) = await SetupTrainerAsync();

        var resp = await trainerHttp.PostAsJsonAsync(
            "/conversations", new { ParticipantId = Guid.NewGuid() }, TestContext.Current.CancellationToken);

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task StartConversation_UnknownProfessionalPublicId_Returns404()
    {
        var (clientHttp, _) = await SetupUnlinkedClientAsync();

        var resp = await clientHttp.PostAsJsonAsync(
            "/conversations", new { ParticipantId = Guid.NewGuid() }, TestContext.Current.CancellationToken);

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task StartConversation_ProfessionalCaller_NoConversationAndNoLiveLink_Returns404WithNotLinkedCode()
    {
        var (trainerHttp, _) = await SetupTrainerAsync();
        var (_, clientPublicId) = await SetupUnlinkedClientAsync();

        var resp = await trainerHttp.PostAsJsonAsync(
            "/conversations", new { ParticipantId = clientPublicId }, TestContext.Current.CancellationToken);

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
        var problem = await resp.Content.ReadFromJsonAsync<ProblemDetailsDto>(
            JsonOptions, TestContext.Current.CancellationToken);
        problem!.ErrorCode.Should().Be("NOT_LINKED_TO_CLIENT");
    }

    [Fact]
    public async Task StartConversation_ClientCaller_NoConversationAndNoLiveLink_Returns404WithNotLinkedCode()
    {
        // Symmetric direction — the client is the caller, the professional is the participant.
        var (_, trainerUserId, trainerPublicId) = await SetupTrainerWithIdsAsync();
        _ = trainerUserId;
        var (clientHttp, _) = await SetupUnlinkedClientAsync();

        var resp = await clientHttp.PostAsJsonAsync(
            "/conversations", new { ParticipantId = trainerPublicId }, TestContext.Current.CancellationToken);

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
        var problem = await resp.Content.ReadFromJsonAsync<ProblemDetailsDto>(
            JsonOptions, TestContext.Current.CancellationToken);
        problem!.ErrorCode.Should().Be("NOT_LINKED_TO_CLIENT");
    }

    [Fact]
    public async Task StartConversation_LiveLink_NoConversation_CreatesOne()
    {
        var (trainerHttp, trainerUserId) = await SetupTrainerAsync();
        var (_, clientPublicId) = await SetupLinkedClientAsync(trainerUserId);

        var resp = await trainerHttp.PostAsJsonAsync(
            "/conversations", new { ParticipantId = clientPublicId }, TestContext.Current.CancellationToken);

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task StartConversation_ExistingConversation_FormerLink_StillReturnsExisting()
    {
        var (trainerHttp, trainerUserId) = await SetupTrainerAsync();
        var (_, clientPublicId) = await SetupLinkedClientAsync(trainerUserId);

        // First call, while the link is live, creates the conversation.
        var createResp = await trainerHttp.PostAsJsonAsync(
            "/conversations", new { ParticipantId = clientPublicId }, TestContext.Current.CancellationToken);
        createResp.StatusCode.Should().Be(HttpStatusCode.OK);

        // Deactivate the link — simulates a former collaboration.
        await SetLinkActiveAsync(clientPublicId, false);

        // Reopening the existing thread must succeed regardless of link liveness.
        var reopenResp = await trainerHttp.PostAsJsonAsync(
            "/conversations", new { ParticipantId = clientPublicId }, TestContext.Current.CancellationToken);
        reopenResp.StatusCode.Should().Be(HttpStatusCode.OK,
            "an existing conversation must always be reopenable, even after the link ends");
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private async Task<(HttpClient Http, Guid UserId)> SetupTrainerAsync()
    {
        var http = factory.CreateClient();
        var email = UniqueEmail("trainer");

        await TestHelpers.RegisterAsync(http, email, Password, "Test", "Trainer", "Trainer");
        var (token, _) = await TestHelpers.LoginAsync(http, email, Password);
        TestHelpers.SetBearerToken(http, token);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.AsNoTracking()
            .FirstAsync(u => u.Email == email, TestContext.Current.CancellationToken);

        return (http, user.Id);
    }

    private async Task<(HttpClient Http, Guid UserId, Guid PublicId)> SetupTrainerWithIdsAsync()
    {
        var (http, userId) = await SetupTrainerAsync();

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var profile = await db.ProfessionalProfiles.AsNoTracking()
            .FirstAsync(pp => pp.UserId == userId, TestContext.Current.CancellationToken);

        return (http, userId, profile.PublicId);
    }

    private async Task<(HttpClient Http, Guid PublicId)> SetupUnlinkedClientAsync()
    {
        var http = factory.CreateClient();
        var email = UniqueEmail("client");

        await TestHelpers.RegisterAsync(http, email, Password, "Test", "Client", "Client");
        var (token, _) = await TestHelpers.LoginAsync(http, email, Password);
        TestHelpers.SetBearerToken(http, token);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.AsNoTracking()
            .FirstAsync(u => u.Email == email, TestContext.Current.CancellationToken);
        var profile = await db.ClientProfiles.AsNoTracking()
            .FirstAsync(cp => cp.UserId == user.Id, TestContext.Current.CancellationToken);

        return (http, profile.PublicId);
    }

    private async Task<(Guid ClientUserId, Guid ClientPublicId)> SetupLinkedClientAsync(Guid trainerUserId)
    {
        var clientUserId = await TestHelpers.RegisterLinkedClientAsync(
            factory, trainerUserId, TestContext.Current.CancellationToken);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var clientProfile = await db.ClientProfiles.AsNoTracking()
            .FirstAsync(cp => cp.UserId == clientUserId, TestContext.Current.CancellationToken);

        return (clientUserId, clientProfile.PublicId);
    }

    private async Task SetLinkActiveAsync(Guid clientPublicId, bool isActive)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var clientProfile = await db.ClientProfiles
            .FirstAsync(cp => cp.PublicId == clientPublicId, TestContext.Current.CancellationToken);
        var link = await db.ClientProfessionalLinks
            .FirstAsync(l => l.ClientProfileId == clientProfile.Id, TestContext.Current.CancellationToken);
        link.IsActive = isActive;
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    // ── Local response DTOs (per slice rules — no cross-feature imports) ─────

    private sealed class ProblemDetailsDto
    {
        public string? ErrorCode { get; set; }
    }
}
