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
/// Integration tests for PUT /trainer/weekly-check-ins/overrides/{clientUserId}/{profession}.
/// Uses Testcontainers PostgreSQL (Docker required). Excluded from CI — see backend.yml.
/// </summary>
[Collection(TestCollection.Name)]
public class PutOverrideEndpointTests(FitnessApiFactory factory)
{
    private static string UniqueEmail(string tag = "put-override") =>
        $"{Guid.NewGuid():N}@{tag}.com";

    private async Task<(HttpClient Http, Guid TrainerUserId, long ProfessionalProfileId)>
        SetupTrainerAsync(string role = "Trainer")
    {
        var http = factory.CreateClient();
        var email = UniqueEmail();

        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "Put", "Trainer", role);
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
    public async Task PutOverride_Unauthenticated_Returns401()
    {
        var client = factory.CreateClient();
        var clientUserId = Guid.NewGuid();

        var response = await client.PutAsJsonAsync(
            $"/trainer/weekly-check-ins/overrides/{clientUserId}/Training",
            new { DayOfWeek = (int?)1, TimeOfDay = (string?)"18:00:00", Enabled = (bool?)true, Addendum = (string?)null },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task PutOverride_ClientRole_Returns403()
    {
        var client = factory.CreateClient();
        var email = UniqueEmail();

        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Test", "Client", "Client");
        var (accessToken, _) = await TestHelpers.LoginAsync(client, email, "TestPass1!");
        TestHelpers.SetBearerToken(client, accessToken);

        var response = await client.PutAsJsonAsync(
            $"/trainer/weekly-check-ins/overrides/{Guid.NewGuid()}/Training",
            new { DayOfWeek = (int?)1, TimeOfDay = (string?)"18:00:00", Enabled = (bool?)true, Addendum = (string?)null },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task PutOverride_NoLinkToClient_Returns403WithNotLinkedToClient()
    {
        var (http, _, _) = await SetupTrainerAsync();
        var (clientUserId, _) = await SetupClientAsync();
        // Deliberately NOT linking trainer to client

        var response = await http.PutAsJsonAsync(
            $"/trainer/weekly-check-ins/overrides/{clientUserId}/Training",
            new { DayOfWeek = (int?)1, TimeOfDay = (string?)"18:00:00", Enabled = (bool?)true, Addendum = (string?)null },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        var raw = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        raw.Should().Contain("NOT_LINKED_TO_CLIENT");
    }

    [Fact]
    public async Task PutOverride_OtherTrainer_Returns403()
    {
        // Trainer A linked to client; Trainer B tries to set an override
        var (httpA, _, profileIdA) = await SetupTrainerAsync();
        var (httpB, _, _) = await SetupTrainerAsync();
        var (clientUserId, clientProfileId) = await SetupClientAsync();

        await LinkTrainerToClientAsync(profileIdA, clientProfileId);

        var response = await httpB.PutAsJsonAsync(
            $"/trainer/weekly-check-ins/overrides/{clientUserId}/Training",
            new { DayOfWeek = (int?)2, TimeOfDay = (string?)"09:00:00", Enabled = (bool?)true, Addendum = (string?)null },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ── Validation ───────────────────────────────────────────────────────────

    [Fact]
    public async Task PutOverride_TimeNotHourAligned_Returns400WithInvalidTimeOfDay()
    {
        var (http, _, trainerProfileId) = await SetupTrainerAsync();
        var (clientUserId, clientProfileId) = await SetupClientAsync();
        await LinkTrainerToClientAsync(trainerProfileId, clientProfileId);

        var response = await http.PutAsJsonAsync(
            $"/trainer/weekly-check-ins/overrides/{clientUserId}/Training",
            new { DayOfWeek = (int?)1, TimeOfDay = "18:45:00", Enabled = (bool?)true, Addendum = (string?)null },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var raw = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        raw.Should().Contain("INVALID_TIME_OF_DAY");
    }

    [Fact]
    public async Task PutOverride_AddendumTooLong_Returns400()
    {
        var (http, _, trainerProfileId) = await SetupTrainerAsync();
        var (clientUserId, clientProfileId) = await SetupClientAsync();
        await LinkTrainerToClientAsync(trainerProfileId, clientProfileId);

        var response = await http.PutAsJsonAsync(
            $"/trainer/weekly-check-ins/overrides/{clientUserId}/Training",
            new { DayOfWeek = (int?)1, TimeOfDay = (string?)"09:00:00", Enabled = (bool?)true, Addendum = new string('x', 201) },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ── Happy paths ──────────────────────────────────────────────────────────

    [Fact]
    public async Task PutOverride_ValidRequest_Creates_ReturnsCreated()
    {
        var (http, _, trainerProfileId) = await SetupTrainerAsync();
        var (clientUserId, clientProfileId) = await SetupClientAsync();
        await LinkTrainerToClientAsync(trainerProfileId, clientProfileId);

        var response = await http.PutAsJsonAsync(
            $"/trainer/weekly-check-ins/overrides/{clientUserId}/Training",
            new { DayOfWeek = (int?)3, TimeOfDay = (string?)"10:00:00", Enabled = (bool?)false, Addendum = "Custom note" },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<OverrideResponse>(
            cancellationToken: TestContext.Current.CancellationToken);

        body.Should().NotBeNull();
        body!.ClientUserId.Should().Be(clientUserId);
        body.Profession.Should().Be("Training");
        body.DayOfWeek.Should().Be(3);
        body.Enabled.Should().BeFalse();
        body.Addendum.Should().Be("Custom note");
    }

    [Fact]
    public async Task PutOverride_AllNullOverrides_ValidRequest_Creates()
    {
        var (http, _, trainerProfileId) = await SetupTrainerAsync();
        var (clientUserId, clientProfileId) = await SetupClientAsync();
        await LinkTrainerToClientAsync(trainerProfileId, clientProfileId);

        var response = await http.PutAsJsonAsync(
            $"/trainer/weekly-check-ins/overrides/{clientUserId}/Training",
            new { DayOfWeek = (int?)null, TimeOfDay = (string?)null, Enabled = (bool?)null, Addendum = (string?)null },
            TestContext.Current.CancellationToken);

        // 201 Created — all-null override is valid (inherit everything from default)
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task PutOverride_SecondPut_UpdatesExisting_DoesNotDuplicate()
    {
        var (http, _, trainerProfileId) = await SetupTrainerAsync();
        var (clientUserId, clientProfileId) = await SetupClientAsync();
        await LinkTrainerToClientAsync(trainerProfileId, clientProfileId);

        // First PUT
        await http.PutAsJsonAsync(
            $"/trainer/weekly-check-ins/overrides/{clientUserId}/Training",
            new { DayOfWeek = (int?)1, TimeOfDay = (string?)"09:00:00", Enabled = (bool?)true, Addendum = (string?)null },
            TestContext.Current.CancellationToken);

        // Second PUT with changed values
        var secondResponse = await http.PutAsJsonAsync(
            $"/trainer/weekly-check-ins/overrides/{clientUserId}/Training",
            new { DayOfWeek = (int?)5, TimeOfDay = (string?)"14:00:00", Enabled = (bool?)false, Addendum = "Updated note" },
            TestContext.Current.CancellationToken);

        secondResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // GET overrides must have exactly 1 row for this client+profession
        var listResponse = await http.GetAsync(
            "/trainer/weekly-check-ins/overrides",
            TestContext.Current.CancellationToken);
        var body = await listResponse.Content.ReadFromJsonAsync<OverridesListResponse>(
            cancellationToken: TestContext.Current.CancellationToken);

        var trainingOverrides = body!.Overrides
            .Where(o => o.ClientUserId == clientUserId && o.Profession == "Training")
            .ToList();

        trainingOverrides.Should().HaveCount(1);
        trainingOverrides[0].DayOfWeek.Should().Be(5);
        trainingOverrides[0].Addendum.Should().Be("Updated note");
    }

    // ── DeadlineOffsetHours ──────────────────────────────────────────────────

    [Fact]
    public async Task PutOverride_WithDeadlineOffset_PersistsAndReturnsField()
    {
        var (http, _, trainerProfileId) = await SetupTrainerAsync();
        var (clientUserId, clientProfileId) = await SetupClientAsync();
        await LinkTrainerToClientAsync(trainerProfileId, clientProfileId);

        var response = await http.PutAsJsonAsync(
            $"/trainer/weekly-check-ins/overrides/{clientUserId}/Training",
            new { DayOfWeek = (int?)null, TimeOfDay = (string?)null, Enabled = (bool?)null, Addendum = (string?)null, DeadlineOffsetHours = 48 },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<OverrideResponseWithDeadline>(
            cancellationToken: TestContext.Current.CancellationToken);

        body.Should().NotBeNull();
        body!.DeadlineOffsetHours.Should().Be(48);

        // Confirm persisted in DB.
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var stored = await db.WeeklyCheckInClientOverrides
            .FirstAsync(o => o.ClientUserId == clientUserId, TestContext.Current.CancellationToken);
        stored.DeadlineOffsetHours.Should().Be(48);
    }

    [Fact]
    public async Task PutOverride_WithNullDeadlineOffset_ClearsOverride()
    {
        var (http, _, trainerProfileId) = await SetupTrainerAsync();
        var (clientUserId, clientProfileId) = await SetupClientAsync();
        await LinkTrainerToClientAsync(trainerProfileId, clientProfileId);

        // First PUT: set a deadline offset.
        await http.PutAsJsonAsync(
            $"/trainer/weekly-check-ins/overrides/{clientUserId}/Training",
            new { DayOfWeek = (int?)null, TimeOfDay = (string?)null, Enabled = (bool?)null, Addendum = (string?)null, DeadlineOffsetHours = 120 },
            TestContext.Current.CancellationToken);

        // Second PUT: clear it (null = inherit from setting).
        var secondResponse = await http.PutAsJsonAsync(
            $"/trainer/weekly-check-ins/overrides/{clientUserId}/Training",
            new { DayOfWeek = (int?)null, TimeOfDay = (string?)null, Enabled = (bool?)null, Addendum = (string?)null, DeadlineOffsetHours = (int?)null },
            TestContext.Current.CancellationToken);

        secondResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await secondResponse.Content.ReadFromJsonAsync<OverrideResponseWithDeadline>(
            cancellationToken: TestContext.Current.CancellationToken);

        body.Should().NotBeNull();
        body!.DeadlineOffsetHours.Should().BeNull();

        // Confirm cleared in DB.
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var stored = await db.WeeklyCheckInClientOverrides
            .FirstAsync(o => o.ClientUserId == clientUserId, TestContext.Current.CancellationToken);
        stored.DeadlineOffsetHours.Should().BeNull();
    }

    [Fact]
    public async Task PutOverride_InvalidDeadlineOffset_Returns400WithInvalidDeadlineOffsetHoursCode()
    {
        var (http, _, trainerProfileId) = await SetupTrainerAsync();
        var (clientUserId, clientProfileId) = await SetupClientAsync();
        await LinkTrainerToClientAsync(trainerProfileId, clientProfileId);

        var response = await http.PutAsJsonAsync(
            $"/trainer/weekly-check-ins/overrides/{clientUserId}/Training",
            new { DayOfWeek = (int?)null, TimeOfDay = (string?)null, Enabled = (bool?)null, Addendum = (string?)null, DeadlineOffsetHours = 60 },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var raw = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        raw.Should().Contain("INVALID_DEADLINE_OFFSET_HOURS");
    }

    // ── Local DTOs ───────────────────────────────────────────────────────────

    private record OverrideResponse(Guid Id, Guid ClientUserId, string Profession, int? DayOfWeek, bool? Enabled, string? Addendum);
    private record OverrideResponseWithDeadline(Guid Id, Guid ClientUserId, string Profession, int? DayOfWeek, bool? Enabled, string? Addendum, int? DeadlineOffsetHours);
    private record OverridesListResponse(List<OverrideItemDto> Overrides);
    private record OverrideItemDto(Guid ClientUserId, string Profession, int? DayOfWeek, string? Addendum);
}
