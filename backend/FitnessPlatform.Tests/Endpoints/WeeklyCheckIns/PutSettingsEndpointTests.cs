using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using FitnessPlatform.Tests.Infrastructure;

namespace FitnessPlatform.Tests.Endpoints.WeeklyCheckIns;

/// <summary>
/// Integration tests for PUT /trainer/weekly-check-ins/settings.
/// Uses Testcontainers PostgreSQL (Docker required). Excluded from CI — see backend.yml.
/// </summary>
[Collection(TestCollection.Name)]
public class PutSettingsEndpointTests(FitnessApiFactory factory)
{
    private static string UniqueEmail() => $"{Guid.NewGuid():N}@put-settings-test.com";

    // ── Authentication / authorization ───────────────────────────────────────

    [Fact]
    public async Task PutSettings_Unauthenticated_Returns401()
    {
        var client = factory.CreateClient();

        var response = await client.PutAsJsonAsync(
            "/trainer/weekly-check-ins/settings",
            new { Profession = "Training", DayOfWeek = 1, TimeOfDay = "18:00:00", Enabled = true },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task PutSettings_ClientRole_Returns403()
    {
        var client = factory.CreateClient();
        var email = UniqueEmail();

        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Client", "User", "Client");
        var (accessToken, _) = await TestHelpers.LoginAsync(client, email, "TestPass1!");
        TestHelpers.SetBearerToken(client, accessToken);

        var response = await client.PutAsJsonAsync(
            "/trainer/weekly-check-ins/settings",
            new { Profession = "Training", DayOfWeek = 1, TimeOfDay = "18:00:00", Enabled = true },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ── Validation ───────────────────────────────────────────────────────────

    [Fact]
    public async Task PutSettings_MinutePrecisionTime_Returns2xx()
    {
        // AC: non-hour times (e.g. 18:30) must now be accepted — endpoint returns 200 or 201
        var client = factory.CreateClient();
        var email = UniqueEmail();

        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Trainer", "Val", "Trainer");
        var (accessToken, _) = await TestHelpers.LoginAsync(client, email, "TestPass1!");
        TestHelpers.SetBearerToken(client, accessToken);

        var response = await client.PutAsJsonAsync(
            "/trainer/weekly-check-ins/settings",
            new { Profession = "Training", DayOfWeek = 1, TimeOfDay = "18:30:00", Enabled = true },
            TestContext.Current.CancellationToken);

        ((int)response.StatusCode).Should().BeInRange(200, 299,
            "minute-precision times must now be accepted");
    }

    [Fact]
    public async Task PutSettings_TimeOf1Day_Returns400()
    {
        // AC: a TimeSpan value ≥ 24h (e.g. 1.00:00:00 = 1 day) must be rejected.
        // "24:00:00" is not a valid .NET TimeSpan string, so we use the day-format "1.00:00:00"
        // which .NET parses to TimeSpan.FromDays(1) = 24 h, triggering the upper-bound rule.
        var client = factory.CreateClient();
        var email = UniqueEmail();

        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Trainer", "Val2", "Trainer");
        var (accessToken, _) = await TestHelpers.LoginAsync(client, email, "TestPass1!");
        TestHelpers.SetBearerToken(client, accessToken);

        var response = await client.PutAsJsonAsync(
            "/trainer/weekly-check-ins/settings",
            new { Profession = "Training", DayOfWeek = 1, TimeOfDay = "1.00:00:00", Enabled = true },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var raw = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        raw.Should().Contain("INVALID_TIME_OF_DAY");
    }

    [Fact]
    public async Task PutSettings_InvalidProfessionValue_Returns400()
    {
        var client = factory.CreateClient();
        var email = UniqueEmail();

        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Trainer", "Val", "Trainer");
        var (accessToken, _) = await TestHelpers.LoginAsync(client, email, "TestPass1!");
        TestHelpers.SetBearerToken(client, accessToken);

        var response = await client.PutAsJsonAsync(
            "/trainer/weekly-check-ins/settings",
            new { Profession = "Yoga", DayOfWeek = 1, TimeOfDay = "18:00:00", Enabled = true },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task PutSettings_DefaultAddendumTooLong_Returns400()
    {
        var client = factory.CreateClient();
        var email = UniqueEmail();

        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Trainer", "Val", "Trainer");
        var (accessToken, _) = await TestHelpers.LoginAsync(client, email, "TestPass1!");
        TestHelpers.SetBearerToken(client, accessToken);

        var response = await client.PutAsJsonAsync(
            "/trainer/weekly-check-ins/settings",
            new
            {
                Profession = "Training",
                DayOfWeek = 1,
                TimeOfDay = "18:00:00",
                Enabled = true,
                DefaultAddendum = new string('x', 201)
            },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ── Business rules ───────────────────────────────────────────────────────

    [Fact]
    public async Task PutSettings_TrainerSetsNutritionProfession_Returns400WithProfessionNotSpecialized()
    {
        var client = factory.CreateClient();
        var email = UniqueEmail();

        // A Trainer-role user cannot set Nutrition profession
        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Role", "Mismatch", "Trainer");
        var (accessToken, _) = await TestHelpers.LoginAsync(client, email, "TestPass1!");
        TestHelpers.SetBearerToken(client, accessToken);

        var response = await client.PutAsJsonAsync(
            "/trainer/weekly-check-ins/settings",
            new { Profession = "Nutrition", DayOfWeek = 1, TimeOfDay = "18:00:00", Enabled = true },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var raw = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        raw.Should().Contain("PROFESSION_NOT_SPECIALIZED");
    }

    [Fact]
    public async Task PutSettings_NutritionistSetsTrainingProfession_Returns400WithProfessionNotSpecialized()
    {
        var client = factory.CreateClient();
        var email = UniqueEmail();

        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Role", "Mismatch", "Nutritionist");
        var (accessToken, _) = await TestHelpers.LoginAsync(client, email, "TestPass1!");
        TestHelpers.SetBearerToken(client, accessToken);

        var response = await client.PutAsJsonAsync(
            "/trainer/weekly-check-ins/settings",
            new { Profession = "Training", DayOfWeek = 1, TimeOfDay = "18:00:00", Enabled = true },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var raw = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        raw.Should().Contain("PROFESSION_NOT_SPECIALIZED");
    }

    // ── Happy paths ──────────────────────────────────────────────────────────

    [Fact]
    public async Task PutSettings_ValidRequest_Creates_ReturnsCreated()
    {
        var client = factory.CreateClient();
        var email = UniqueEmail();

        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Happy", "Trainer", "Trainer");
        var (accessToken, _) = await TestHelpers.LoginAsync(client, email, "TestPass1!");
        TestHelpers.SetBearerToken(client, accessToken);

        var response = await client.PutAsJsonAsync(
            "/trainer/weekly-check-ins/settings",
            new
            {
                Profession = "Training",
                DayOfWeek = 4,
                TimeOfDay = "18:00:00",
                Enabled = true,
                DefaultAddendum = "Please let me know!"
            },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<SettingResponse>(
            cancellationToken: TestContext.Current.CancellationToken);

        body.Should().NotBeNull();
        body!.Profession.Should().Be("Training");
        body.DayOfWeek.Should().Be(4);
        body.Enabled.Should().BeTrue();
        body.DefaultAddendum.Should().Be("Please let me know!");
    }

    [Fact]
    public async Task PutSettings_SecondPut_UpdatesExistingRow_DoesNotDuplicate()
    {
        var client = factory.CreateClient();
        var email = UniqueEmail();

        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Upsert", "Trainer", "Trainer");
        var (accessToken, _) = await TestHelpers.LoginAsync(client, email, "TestPass1!");
        TestHelpers.SetBearerToken(client, accessToken);

        // First PUT → create
        await client.PutAsJsonAsync(
            "/trainer/weekly-check-ins/settings",
            new { Profession = "Training", DayOfWeek = 1, TimeOfDay = "09:00:00", Enabled = true },
            TestContext.Current.CancellationToken);

        // Second PUT → update
        var secondResponse = await client.PutAsJsonAsync(
            "/trainer/weekly-check-ins/settings",
            new { Profession = "Training", DayOfWeek = 3, TimeOfDay = "20:00:00", Enabled = false },
            TestContext.Current.CancellationToken);

        secondResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // GET must return only 1 item (no duplication)
        var getResponse = await client.GetAsync(
            "/trainer/weekly-check-ins/settings",
            TestContext.Current.CancellationToken);

        var body = await getResponse.Content.ReadFromJsonAsync<SettingsListResponse>(
            cancellationToken: TestContext.Current.CancellationToken);

        body!.Settings.Should().HaveCount(1);
        body.Settings[0].DayOfWeek.Should().Be(3);
        body.Settings[0].Enabled.Should().BeFalse();
    }

    // ── Local DTOs ────────────────────────────────────────────────────────────

    private record SettingResponse(Guid Id, string Profession, int DayOfWeek, string TimeOfDay, bool Enabled, string? DefaultAddendum);
    private record SettingsListResponse(List<SettingItemDto> Settings);
    private record SettingItemDto(int DayOfWeek, bool Enabled);
}
