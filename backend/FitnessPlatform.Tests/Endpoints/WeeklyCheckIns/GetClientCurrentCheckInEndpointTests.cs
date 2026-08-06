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
/// Integration tests for GET /trainer/clients/{clientUserId}/weekly-check-ins/current.
/// This is the trainer-facing "plan editor banner" endpoint (distinct from
/// GET /client/weekly-check-ins/current, covered by GetCurrentClientCheckInsEndpointTests).
/// Uses Testcontainers PostgreSQL (Docker required).
/// </summary>
[Collection(TestCollection.Name)]
public class GetClientCurrentCheckInEndpointTests(FitnessApiFactory factory)
{
    private static string UniqueEmail(string tag = "get-client-current") =>
        $"{Guid.NewGuid():N}@{tag}.com";

    private async Task<(HttpClient Http, Guid TrainerId)> SetupTrainerAsync()
    {
        var http = factory.CreateClient();
        var email = UniqueEmail();
        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "Trainer", "Get", "Trainer");
        var (token, _) = await TestHelpers.LoginAsync(http, email, "TestPass1!");
        TestHelpers.SetBearerToken(http, token);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .FirstAsync(db.Users, u => u.Email == email, TestContext.Current.CancellationToken);
        return (http, user.Id);
    }

    private async Task<Guid> SetupClientUserIdAsync()
    {
        var http = factory.CreateClient();
        var email = UniqueEmail("client");
        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "C", "Client", "Client");

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .FirstAsync(db.Users, u => u.Email == email, TestContext.Current.CancellationToken);
        return user.Id;
    }

    private async Task InsertCheckInAsync(
        Guid clientUserId,
        Guid professionalUserId,
        DateOnly weekStartDate,
        DateTime? respondedAt = null,
        DateTime? dismissedAt = null,
        DateTime? reviewedByTrainerAt = null,
        WeeklyCheckInStatus status = WeeklyCheckInStatus.Pending)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        db.WeeklyCheckIns.Add(new WeeklyCheckIn
        {
            ClientUserId = clientUserId,
            ProfessionalUserId = professionalUserId,
            Profession = Profession.Training,
            WeekStartDate = weekStartDate,
            SentAt = DateTime.UtcNow.AddHours(-1),
            RespondedAt = respondedAt,
            DismissedByClientAt = dismissedAt,
            ReviewedByTrainerAt = reviewedByTrainerAt,
            Status = status,
            DateCreated = DateTime.UtcNow,
            DateModified = DateTime.UtcNow
        });

        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private static DateOnly NextMonday() =>
        DateOnly.FromDateTime(DateTime.UtcNow).AddDays(
            ((int)DayOfWeek.Monday - (int)DateTime.UtcNow.DayOfWeek + 7) % 7 + 7);

    // ── Auth ──────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetCurrent_Unauthenticated_Returns401()
    {
        var http = factory.CreateClient();
        var response = await http.GetAsync(
            $"/trainer/clients/{Guid.NewGuid()}/weekly-check-ins/current",
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── Active-set (week-agnostic, #751) ─────────────────────────────────────

    [Fact]
    public async Task GetCurrent_RespondedNextWeekCheckIn_IsReturned()
    {
        var (http, trainerId) = await SetupTrainerAsync();
        var clientId = await SetupClientUserIdAsync();

        var nextMonday = NextMonday();
        await InsertCheckInAsync(
            clientId, trainerId, nextMonday,
            respondedAt: DateTime.UtcNow,
            status: WeeklyCheckInStatus.Responded);

        var response = await http.GetAsync(
            $"/trainer/clients/{clientId}/weekly-check-ins/current",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<CheckInsWrapper>(
            cancellationToken: TestContext.Current.CancellationToken);

        body!.CheckIns.Should().ContainSingle(c => c.WeekStartDate == nextMonday);
    }

    [Fact]
    public async Task GetCurrent_Reviewed_ExcludedFromActiveSet()
    {
        var (http, trainerId) = await SetupTrainerAsync();
        var clientId = await SetupClientUserIdAsync();

        var weekDate = NextMonday().AddDays(7);
        await InsertCheckInAsync(
            clientId, trainerId, weekDate,
            respondedAt: DateTime.UtcNow,
            reviewedByTrainerAt: DateTime.UtcNow,
            status: WeeklyCheckInStatus.Responded);

        var response = await http.GetAsync(
            $"/trainer/clients/{clientId}/weekly-check-ins/current",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<CheckInsWrapper>(
            cancellationToken: TestContext.Current.CancellationToken);

        body!.CheckIns.Should().BeEmpty();
    }

    [Fact]
    public async Task GetCurrent_Dismissed_ExcludedFromActiveSet()
    {
        var (http, trainerId) = await SetupTrainerAsync();
        var clientId = await SetupClientUserIdAsync();

        var weekDate = NextMonday().AddDays(14);
        await InsertCheckInAsync(
            clientId, trainerId, weekDate,
            dismissedAt: DateTime.UtcNow);

        var response = await http.GetAsync(
            $"/trainer/clients/{clientId}/weekly-check-ins/current",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<CheckInsWrapper>(
            cancellationToken: TestContext.Current.CancellationToken);

        body!.CheckIns.Should().BeEmpty();
    }

    [Fact]
    public async Task GetCurrent_Expired_StillReturnedIfNotReviewedOrDismissed()
    {
        var (http, trainerId) = await SetupTrainerAsync();
        var clientId = await SetupClientUserIdAsync();

        var weekDate = NextMonday().AddDays(21);
        await InsertCheckInAsync(
            clientId, trainerId, weekDate,
            status: WeeklyCheckInStatus.Expired);

        var response = await http.GetAsync(
            $"/trainer/clients/{clientId}/weekly-check-ins/current",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<CheckInsWrapper>(
            cancellationToken: TestContext.Current.CancellationToken);

        body!.CheckIns.Should().ContainSingle(c => c.WeekStartDate == weekDate);
    }

    [Fact]
    public async Task GetCurrent_EnforcesOwnership_OtherTrainerRowNotReturned()
    {
        var (http, trainerId) = await SetupTrainerAsync();
        var (_, otherTrainerId) = await SetupTrainerAsync();
        var clientId = await SetupClientUserIdAsync();

        var weekA = NextMonday().AddDays(28);
        var weekB = NextMonday().AddDays(35);
        await InsertCheckInAsync(clientId, trainerId, weekA, respondedAt: DateTime.UtcNow);
        await InsertCheckInAsync(clientId, otherTrainerId, weekB, respondedAt: DateTime.UtcNow);

        var response = await http.GetAsync(
            $"/trainer/clients/{clientId}/weekly-check-ins/current",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<CheckInsWrapper>(
            cancellationToken: TestContext.Current.CancellationToken);

        body!.CheckIns.Should().ContainSingle(c => c.WeekStartDate == weekA);
        body.CheckIns.Should().NotContain(c => c.WeekStartDate == weekB);
    }

    // ── Ordering (#751 follow-up: deterministic tiebreak) ────────────────────

    [Fact]
    public async Task GetCurrent_MultipleActiveRowsSameProfession_OrderedNewestWeekFirst()
    {
        // Regression guard: WeeklyCheckInScheduler.SweepExpiredAsync marks past-due
        // Pending rows Expired without dismissing/reviewing them, so an older Expired
        // row can coexist with a newer Responded row for the same client+profession.
        // The plan-editor banner (web CheckInBanner.tsx) reads checkIns[0], so ordering
        // MUST put the most recent WeekStartDate first, not rely on Profession alone.
        var (http, trainerId) = await SetupTrainerAsync();
        var clientId = await SetupClientUserIdAsync();

        var newerMonday = NextMonday();
        var olderMonday = newerMonday.AddDays(-7);

        await InsertCheckInAsync(
            clientId, trainerId, olderMonday,
            status: WeeklyCheckInStatus.Expired);
        await InsertCheckInAsync(
            clientId, trainerId, newerMonday,
            respondedAt: DateTime.UtcNow,
            status: WeeklyCheckInStatus.Responded);

        var response = await http.GetAsync(
            $"/trainer/clients/{clientId}/weekly-check-ins/current",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<CheckInsWrapper>(
            cancellationToken: TestContext.Current.CancellationToken);

        body!.CheckIns.Should().HaveCount(2);
        body.CheckIns[0].WeekStartDate.Should().Be(newerMonday);
        body.CheckIns[1].WeekStartDate.Should().Be(olderMonday);
    }

    // ── Local DTOs ────────────────────────────────────────────────────────────
    private record CheckInsWrapper(List<CheckInDto> CheckIns);
    private record CheckInDto(Guid Id, string Profession, DateOnly WeekStartDate);
}
