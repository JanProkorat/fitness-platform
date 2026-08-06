using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.WeeklyCheckIns;

/// <summary>
/// Integration tests for GET /client/weekly-check-ins/current.
/// Uses Testcontainers PostgreSQL (Docker required).
/// </summary>
[Collection(TestCollection.Name)]
public class GetCurrentClientCheckInsEndpointTests(FitnessApiFactory factory)
{
    private static string UniqueEmail(string tag = "get-current") =>
        $"{Guid.NewGuid():N}@{tag}.com";

    private async Task<(HttpClient Http, Guid UserId)> SetupClientAsync()
    {
        var http = factory.CreateClient();
        var email = UniqueEmail();
        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "Test", "Client", "Client");
        var (token, _) = await TestHelpers.LoginAsync(http, email, "TestPass1!");
        TestHelpers.SetBearerToken(http, token);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .FirstAsync(db.Users, u => u.Email == email, TestContext.Current.CancellationToken);

        return (http, user.Id);
    }

    private async Task<Guid> SetupTrainerAsync()
    {
        var http = factory.CreateClient();
        var email = UniqueEmail("trainer");
        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "Trainer", "Trainer", "Trainer");

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .FirstAsync(db.Users, u => u.Email == email, TestContext.Current.CancellationToken);
        return user.Id;
    }

    private async Task InsertCheckInAsync(
        Guid clientUserId,
        Guid professionalUserId,
        Profession profession,
        DateOnly? weekStartDate = null,
        DateTime? respondedAt = null,
        DateTime? dismissedAt = null,
        DateTime? dueAt = null,
        WeeklyCheckInStatus status = WeeklyCheckInStatus.Pending)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var monday = weekStartDate ?? CurrentWeekMonday();

        db.WeeklyCheckIns.Add(new WeeklyCheckIn
        {
            ClientUserId = clientUserId,
            ProfessionalUserId = professionalUserId,
            Profession = profession,
            WeekStartDate = monday,
            SentAt = DateTime.UtcNow.AddHours(-1),
            RespondedAt = respondedAt,
            DismissedByClientAt = dismissedAt,
            DueAt = dueAt,
            Status = status,
            DateCreated = DateTime.UtcNow,
            DateModified = DateTime.UtcNow
        });

        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private static DateOnly CurrentWeekMonday()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var days = ((int)today.DayOfWeek - (int)DayOfWeek.Monday + 7) % 7;
        return today.AddDays(-days);
    }

    // ── Auth ──────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetCurrent_Unauthenticated_Returns401()
    {
        var http = factory.CreateClient();
        var response = await http.GetAsync(
            "/client/weekly-check-ins/current", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetCurrent_TrainerRole_Returns403()
    {
        var http = factory.CreateClient();
        var email = UniqueEmail("trainer-role");
        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "T", "T", "Trainer");
        var (token, _) = await TestHelpers.LoginAsync(http, email, "TestPass1!");
        TestHelpers.SetBearerToken(http, token);

        var response = await http.GetAsync(
            "/client/weekly-check-ins/current", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ── Happy paths ───────────────────────────────────────────────────────────

    [Fact]
    public async Task GetCurrent_NoCheckIns_ReturnsEmptyList()
    {
        var (http, _) = await SetupClientAsync();

        var response = await http.GetAsync(
            "/client/weekly-check-ins/current", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<CheckInsWrapper>(
            cancellationToken: TestContext.Current.CancellationToken);
        body!.CheckIns.Should().BeEmpty();
    }

    [Fact]
    public async Task GetCurrent_ActiveCheckIn_ReturnsIt()
    {
        var (http, clientUserId) = await SetupClientAsync();
        var trainerId = await SetupTrainerAsync();

        await InsertCheckInAsync(clientUserId, trainerId, Profession.Training);

        var response = await http.GetAsync(
            "/client/weekly-check-ins/current", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<CheckInsWrapper>(
            cancellationToken: TestContext.Current.CancellationToken);
        body!.CheckIns.Should().HaveCount(1);
        body.CheckIns[0].Profession.Should().Be("Training");
    }

    [Fact]
    public async Task GetCurrent_AlreadyResponded_DoesNotReturn()
    {
        var (http, clientUserId) = await SetupClientAsync();
        var trainerId = await SetupTrainerAsync();

        await InsertCheckInAsync(clientUserId, trainerId, Profession.Training,
            respondedAt: DateTime.UtcNow);

        var response = await http.GetAsync(
            "/client/weekly-check-ins/current", TestContext.Current.CancellationToken);

        var body = await response.Content.ReadFromJsonAsync<CheckInsWrapper>(
            cancellationToken: TestContext.Current.CancellationToken);
        body!.CheckIns.Should().BeEmpty();
    }

    [Fact]
    public async Task GetCurrent_Dismissed_DoesNotReturn()
    {
        var (http, clientUserId) = await SetupClientAsync();
        var trainerId = await SetupTrainerAsync();

        await InsertCheckInAsync(clientUserId, trainerId, Profession.Training,
            dismissedAt: DateTime.UtcNow);

        var response = await http.GetAsync(
            "/client/weekly-check-ins/current", TestContext.Current.CancellationToken);

        var body = await response.Content.ReadFromJsonAsync<CheckInsWrapper>(
            cancellationToken: TestContext.Current.CancellationToken);
        body!.CheckIns.Should().BeEmpty();
    }

    // ── Active-window regression coverage (#744) ─────────────────────────────

    [Fact]
    public async Task GetCurrent_NextWeekCheckIn_StillWithinDeadline_ReturnsIt()
    {
        // Regression guard for #744: the scheduler stamps WeekStartDate as NEXT week's
        // Monday (the week being planned) while the response window is open THIS week.
        // The endpoint must return the check-in based on active state + DueAt, not on
        // WeekStartDate equaling the current ISO week's Monday.
        var (http, clientUserId) = await SetupClientAsync();
        var trainerId = await SetupTrainerAsync();

        var nextMonday = CurrentWeekMonday().AddDays(7);
        await InsertCheckInAsync(
            clientUserId,
            trainerId,
            Profession.Training,
            weekStartDate: nextMonday,
            dueAt: DateTime.UtcNow.AddHours(48),
            status: WeeklyCheckInStatus.Pending);

        var response = await http.GetAsync(
            "/client/weekly-check-ins/current", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<CheckInsWrapper>(
            cancellationToken: TestContext.Current.CancellationToken);
        body!.CheckIns.Should().HaveCount(1);
        body.CheckIns[0].WeekStartDate.Should().Be(nextMonday);
    }

    [Fact]
    public async Task GetCurrent_ExpiredStatus_DoesNotReturn()
    {
        var (http, clientUserId) = await SetupClientAsync();
        var trainerId = await SetupTrainerAsync();

        await InsertCheckInAsync(
            clientUserId,
            trainerId,
            Profession.Training,
            status: WeeklyCheckInStatus.Expired);

        var response = await http.GetAsync(
            "/client/weekly-check-ins/current", TestContext.Current.CancellationToken);

        var body = await response.Content.ReadFromJsonAsync<CheckInsWrapper>(
            cancellationToken: TestContext.Current.CancellationToken);
        body!.CheckIns.Should().BeEmpty();
    }

    [Fact]
    public async Task GetCurrent_PastDueAt_DoesNotReturn()
    {
        var (http, clientUserId) = await SetupClientAsync();
        var trainerId = await SetupTrainerAsync();

        await InsertCheckInAsync(
            clientUserId,
            trainerId,
            Profession.Training,
            dueAt: DateTime.UtcNow.AddHours(-1));

        var response = await http.GetAsync(
            "/client/weekly-check-ins/current", TestContext.Current.CancellationToken);

        var body = await response.Content.ReadFromJsonAsync<CheckInsWrapper>(
            cancellationToken: TestContext.Current.CancellationToken);
        body!.CheckIns.Should().BeEmpty();
    }

    [Fact]
    public async Task GetCurrent_NullDueAt_LegacyRow_ReturnsIt()
    {
        var (http, clientUserId) = await SetupClientAsync();
        var trainerId = await SetupTrainerAsync();

        await InsertCheckInAsync(
            clientUserId,
            trainerId,
            Profession.Training,
            dueAt: null);

        var response = await http.GetAsync(
            "/client/weekly-check-ins/current", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<CheckInsWrapper>(
            cancellationToken: TestContext.Current.CancellationToken);
        body!.CheckIns.Should().HaveCount(1);
    }

    // ── Local DTOs ────────────────────────────────────────────────────────────
    private record CheckInsWrapper(List<CheckInDto> CheckIns);
    private record CheckInDto(Guid Id, Guid ProfessionalUserId, string ProfessionalName, string Profession, DateOnly WeekStartDate, DateTime SentAt);
}
