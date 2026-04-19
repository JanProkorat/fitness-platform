using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using FitnessPlatform.Tests.Infrastructure;

namespace FitnessPlatform.Tests.Endpoints.WeeklyCheckIns;

/// <summary>
/// Integration tests for GET /trainer/weekly-check-ins/settings.
/// Uses Testcontainers PostgreSQL (Docker required). Excluded from CI — see backend.yml.
/// </summary>
[Collection(TestCollection.Name)]
public class GetSettingsEndpointTests(FitnessApiFactory factory)
{
    private static string UniqueEmail() => $"{Guid.NewGuid():N}@get-settings-test.com";

    [Fact]
    public async Task GetSettings_Unauthenticated_Returns401()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync(
            "/trainer/weekly-check-ins/settings",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetSettings_ClientRole_Returns403()
    {
        var client = factory.CreateClient();
        var email = UniqueEmail();

        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Test", "User", "Client");
        var (accessToken, _) = await TestHelpers.LoginAsync(client, email, "TestPass1!");
        TestHelpers.SetBearerToken(client, accessToken);

        var response = await client.GetAsync(
            "/trainer/weekly-check-ins/settings",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetSettings_TrainerWithNoSettings_ReturnsEmptyList()
    {
        var client = factory.CreateClient();
        var email = UniqueEmail();

        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Get", "Trainer", "Trainer");
        var (accessToken, _) = await TestHelpers.LoginAsync(client, email, "TestPass1!");
        TestHelpers.SetBearerToken(client, accessToken);

        var response = await client.GetAsync(
            "/trainer/weekly-check-ins/settings",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<SettingsResponse>(
            cancellationToken: TestContext.Current.CancellationToken);

        body.Should().NotBeNull();
        body!.Settings.Should().BeEmpty();
    }

    [Fact]
    public async Task GetSettings_AfterPut_ReturnsCreatedSetting()
    {
        var client = factory.CreateClient();
        var email = UniqueEmail();

        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Get", "Trainer", "Trainer");
        var (accessToken, _) = await TestHelpers.LoginAsync(client, email, "TestPass1!");
        TestHelpers.SetBearerToken(client, accessToken);

        // Create a setting first
        await client.PutAsJsonAsync(
            "/trainer/weekly-check-ins/settings",
            new
            {
                Profession = "Training",
                DayOfWeek = 1,
                TimeOfDay = "18:00:00",
                Enabled = true,
                DefaultAddendum = (string?)null
            },
            TestContext.Current.CancellationToken);

        var response = await client.GetAsync(
            "/trainer/weekly-check-ins/settings",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<SettingsResponse>(
            cancellationToken: TestContext.Current.CancellationToken);

        body.Should().NotBeNull();
        body!.Settings.Should().HaveCount(1);
        body.Settings[0].Profession.Should().Be("Training");
        body.Settings[0].DayOfWeek.Should().Be(1);
        body.Settings[0].Enabled.Should().BeTrue();
    }

    // ── Local DTOs ────────────────────────────────────────────────────────────

    private record SettingsResponse(List<SettingDto> Settings);
    private record SettingDto(Guid Id, string Profession, int DayOfWeek, string TimeOfDay, bool Enabled, string? DefaultAddendum);
}
