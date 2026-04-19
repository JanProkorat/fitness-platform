using System.Net;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Net.Http.Json;

namespace FitnessPlatform.Tests.Endpoints.WeeklyCheckIns;

/// <summary>
/// Integration tests for DELETE /trainer/weekly-check-ins/overrides/{clientUserId}/{profession}.
/// Uses Testcontainers PostgreSQL (Docker required). Excluded from CI — see backend.yml.
/// </summary>
[Collection(TestCollection.Name)]
public class DeleteOverrideEndpointTests(FitnessApiFactory factory)
{
    private static string UniqueEmail(string tag = "del-override") =>
        $"{Guid.NewGuid():N}@{tag}.com";

    private async Task<(HttpClient Http, Guid TrainerUserId, long ProfessionalProfileId)>
        SetupTrainerAsync()
    {
        var http = factory.CreateClient();
        var email = UniqueEmail();

        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "Del", "Trainer", "Trainer");
        var (token, _) = await TestHelpers.LoginAsync(http, email, "TestPass1!");
        TestHelpers.SetBearerToken(http, token);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.FirstAsync(u => u.Email == email, TestContext.Current.CancellationToken);
        var profile = await db.ProfessionalProfiles.FirstAsync(p => p.UserId == user.Id, TestContext.Current.CancellationToken);

        return (http, user.Id, profile.Id);
    }

    private async Task<(Guid ClientUserId, long ClientProfileId)> SetupClientAsync()
    {
        var http = factory.CreateClient();
        var email = UniqueEmail("client");

        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "Test", "Client", "Client");

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.FirstAsync(u => u.Email == email, TestContext.Current.CancellationToken);
        var profile = await db.ClientProfiles.FirstAsync(cp => cp.UserId == user.Id, TestContext.Current.CancellationToken);

        return (user.Id, profile.Id);
    }

    private async Task LinkTrainerToClientAsync(long trainerProfileId, long clientProfileId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        db.ClientProfessionalLinks.Add(new ClientProfessionalLink
        {
            PublicId = Guid.NewGuid(),
            ProfessionalProfileId = trainerProfileId,
            ClientProfileId = clientProfileId,
            ProfessionalRole = UserRole.Trainer,
            IsActive = true,
            CanViewTrainingPlans = true,
            CanViewNutritionPlans = false,
            DateCreated = DateTime.UtcNow
        });

        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    // ── Authentication / authorization ───────────────────────────────────────

    [Fact]
    public async Task DeleteOverride_Unauthenticated_Returns401()
    {
        var client = factory.CreateClient();

        var response = await client.DeleteAsync(
            $"/trainer/weekly-check-ins/overrides/{Guid.NewGuid()}/Training",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task DeleteOverride_ClientRole_Returns403()
    {
        var client = factory.CreateClient();
        var email = UniqueEmail();

        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Test", "Client", "Client");
        var (accessToken, _) = await TestHelpers.LoginAsync(client, email, "TestPass1!");
        TestHelpers.SetBearerToken(client, accessToken);

        var response = await client.DeleteAsync(
            $"/trainer/weekly-check-ins/overrides/{Guid.NewGuid()}/Training",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task DeleteOverride_NotLinkedToClient_Returns403WithNotLinkedToClient()
    {
        var (http, _, _) = await SetupTrainerAsync();
        var (clientUserId, _) = await SetupClientAsync();
        // Deliberately NOT linking

        var response = await http.DeleteAsync(
            $"/trainer/weekly-check-ins/overrides/{clientUserId}/Training",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        var raw = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        raw.Should().Contain("NOT_LINKED_TO_CLIENT");
    }

    [Fact]
    public async Task DeleteOverride_NoOverrideExists_Returns404()
    {
        var (http, _, trainerProfileId) = await SetupTrainerAsync();
        var (clientUserId, clientProfileId) = await SetupClientAsync();
        await LinkTrainerToClientAsync(trainerProfileId, clientProfileId);
        // Don't create an override first

        var response = await http.DeleteAsync(
            $"/trainer/weekly-check-ins/overrides/{clientUserId}/Training",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Happy path ───────────────────────────────────────────────────────────

    [Fact]
    public async Task DeleteOverride_ExistingOverride_Returns204AndRemovesRow()
    {
        var (http, _, trainerProfileId) = await SetupTrainerAsync();
        var (clientUserId, clientProfileId) = await SetupClientAsync();
        await LinkTrainerToClientAsync(trainerProfileId, clientProfileId);

        // Create override
        await http.PutAsJsonAsync(
            $"/trainer/weekly-check-ins/overrides/{clientUserId}/Training",
            new { DayOfWeek = (int?)2, TimeOfDay = (string?)"08:00:00", Enabled = (bool?)true, Addendum = (string?)null },
            TestContext.Current.CancellationToken);

        // Delete it
        var deleteResponse = await http.DeleteAsync(
            $"/trainer/weekly-check-ins/overrides/{clientUserId}/Training",
            TestContext.Current.CancellationToken);

        deleteResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Confirm it's gone from GET overrides
        var listResponse = await http.GetAsync(
            "/trainer/weekly-check-ins/overrides",
            TestContext.Current.CancellationToken);
        var body = await listResponse.Content.ReadFromJsonAsync<OverridesListResponse>(
            cancellationToken: TestContext.Current.CancellationToken);

        body!.Overrides.Should().NotContain(o =>
            o.ClientUserId == clientUserId && o.Profession == "Training");
    }

    [Fact]
    public async Task DeleteOverride_InvalidProfession_Returns400()
    {
        var (http, _, trainerProfileId) = await SetupTrainerAsync();
        var (clientUserId, clientProfileId) = await SetupClientAsync();
        await LinkTrainerToClientAsync(trainerProfileId, clientProfileId);

        var response = await http.DeleteAsync(
            $"/trainer/weekly-check-ins/overrides/{clientUserId}/InvalidProfession",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ── Local DTOs ───────────────────────────────────────────────────────────

    private record OverridesListResponse(List<OverrideItemDto> Overrides);
    private record OverrideItemDto(Guid ClientUserId, string Profession);
}
