using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.WeeklyCheckIns;

/// <summary>
/// Integration tests for GET /trainer/weekly-check-ins/overrides.
/// Uses Testcontainers PostgreSQL (Docker required). Excluded from CI — see backend.yml.
/// </summary>
[Collection(TestCollection.Name)]
public class GetOverridesEndpointTests(FitnessApiFactory factory)
{
    private static string UniqueEmail(string tag = "get-overrides") =>
        $"{Guid.NewGuid():N}@{tag}.com";

    private async Task<(HttpClient Http, Guid TrainerUserId, long ProfessionalProfileId)>
        SetupTrainerAsync(string role = "Trainer")
    {
        var http = factory.CreateClient();
        var email = UniqueEmail();

        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "Get", "Trainer", role);
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

    [Fact]
    public async Task GetOverrides_Unauthenticated_Returns401()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync(
            "/trainer/weekly-check-ins/overrides",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetOverrides_ClientRole_Returns403()
    {
        var client = factory.CreateClient();
        var email = UniqueEmail();

        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Test", "Client", "Client");
        var (accessToken, _) = await TestHelpers.LoginAsync(client, email, "TestPass1!");
        TestHelpers.SetBearerToken(client, accessToken);

        var response = await client.GetAsync(
            "/trainer/weekly-check-ins/overrides",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetOverrides_NoOverrides_ReturnsEmptyList()
    {
        var (http, _, _) = await SetupTrainerAsync();

        var response = await http.GetAsync(
            "/trainer/weekly-check-ins/overrides",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<OverridesResponse>(
            cancellationToken: TestContext.Current.CancellationToken);

        body.Should().NotBeNull();
        body!.Overrides.Should().BeEmpty();
    }

    [Fact]
    public async Task GetOverrides_AfterPutOverride_ReturnsOverride()
    {
        var (http, trainerUserId, trainerProfileId) = await SetupTrainerAsync();
        var (clientUserId, clientProfileId) = await SetupClientAsync();
        await LinkTrainerToClientAsync(trainerProfileId, clientProfileId);

        // Create an override
        await http.PutAsJsonAsync(
            $"/trainer/weekly-check-ins/overrides/{clientUserId}/Training",
            new { DayOfWeek = 2, TimeOfDay = "10:00:00", Enabled = (bool?)false, Addendum = (string?)null },
            TestContext.Current.CancellationToken);

        var response = await http.GetAsync(
            "/trainer/weekly-check-ins/overrides",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<OverridesResponse>(
            cancellationToken: TestContext.Current.CancellationToken);

        body.Should().NotBeNull();
        body!.Overrides.Should().ContainSingle(o =>
            o.ClientUserId == clientUserId && o.Profession == "Training");
    }

    [Fact]
    public async Task GetOverrides_ReturnsDeadlineOffsetHoursField()
    {
        var (http, _, trainerProfileId) = await SetupTrainerAsync();
        var (clientUserId, clientProfileId) = await SetupClientAsync();
        await LinkTrainerToClientAsync(trainerProfileId, clientProfileId);

        // Create override with a specific deadline offset.
        await http.PutAsJsonAsync(
            $"/trainer/weekly-check-ins/overrides/{clientUserId}/Training",
            new { DayOfWeek = (int?)null, TimeOfDay = (string?)null, Enabled = (bool?)null, Addendum = (string?)null, DeadlineOffsetHours = 72 },
            TestContext.Current.CancellationToken);

        var response = await http.GetAsync(
            "/trainer/weekly-check-ins/overrides",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<OverridesResponseFull>(
            cancellationToken: TestContext.Current.CancellationToken);

        body.Should().NotBeNull();
        var match = body!.Overrides.Should().ContainSingle(o =>
            o.ClientUserId == clientUserId && o.Profession == "Training").Which;
        match.DeadlineOffsetHours.Should().Be(72);
    }

    [Fact]
    public async Task GetOverrides_NullDeadlineOffset_ReturnsNullInField()
    {
        var (http, _, trainerProfileId) = await SetupTrainerAsync();
        var (clientUserId, clientProfileId) = await SetupClientAsync();
        await LinkTrainerToClientAsync(trainerProfileId, clientProfileId);

        // Create override without specifying deadline offset (will be null).
        await http.PutAsJsonAsync(
            $"/trainer/weekly-check-ins/overrides/{clientUserId}/Training",
            new { DayOfWeek = (int?)null, TimeOfDay = (string?)null, Enabled = (bool?)null, Addendum = (string?)null, DeadlineOffsetHours = (int?)null },
            TestContext.Current.CancellationToken);

        var response = await http.GetAsync(
            "/trainer/weekly-check-ins/overrides",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<OverridesResponseFull>(
            cancellationToken: TestContext.Current.CancellationToken);

        body.Should().NotBeNull();
        var match = body!.Overrides.Should().ContainSingle(o =>
            o.ClientUserId == clientUserId && o.Profession == "Training").Which;
        match.DeadlineOffsetHours.Should().BeNull();
    }

    // ── Local DTOs ───────────────────────────────────────────────────────────

    private record OverridesResponse(List<OverrideDto> Overrides);
    private record OverrideDto(Guid Id, Guid ClientUserId, string Profession, int? DayOfWeek, bool? Enabled, string? Addendum);

    private record OverridesResponseFull(List<OverrideDtoFull> Overrides);
    private record OverrideDtoFull(Guid Id, Guid ClientUserId, string Profession, int? DayOfWeek, bool? Enabled, string? Addendum, int? DeadlineOffsetHours);
}
