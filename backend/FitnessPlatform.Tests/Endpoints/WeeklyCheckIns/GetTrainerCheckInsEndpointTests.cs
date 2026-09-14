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
/// Integration tests for GET /trainer/weekly-check-ins?weekStartDate=...
/// Uses Testcontainers PostgreSQL (Docker required).
/// </summary>
[Collection(TestCollection.Name)]
public class GetTrainerCheckInsEndpointTests(FitnessApiFactory factory)
{
    private static string UniqueEmail(string tag = "get-trainer-ci") =>
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
        var (userId, _) = await SetupClientAsync();
        return userId;
    }

    /// <summary>
    /// Registers a client user and returns both their ApplicationUser.Id and their
    /// ClientProfile.PublicId (created automatically by registration) — used to assert
    /// the check-in DTO exposes the PublicId, not the user id.
    /// </summary>
    private async Task<(Guid ClientUserId, Guid ClientPublicId)> SetupClientAsync()
    {
        var http = factory.CreateClient();
        var email = UniqueEmail("client");
        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "C", "Client", "Client");

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .FirstAsync(db.Users, u => u.Email == email, TestContext.Current.CancellationToken);
        var profile = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .FirstAsync(db.ClientProfiles, cp => cp.UserId == user.Id, TestContext.Current.CancellationToken);
        return (user.Id, profile.PublicId);
    }

    private async Task InsertCheckInAsync(
        Guid clientUserId,
        Guid professionalUserId,
        DateOnly weekStartDate,
        bool dismissed = false,
        DateTime? respondedAt = null,
        DateTime? reviewedByTrainerAt = null)
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
            DismissedByClientAt = dismissed ? DateTime.UtcNow : null,
            ReviewedByTrainerAt = reviewedByTrainerAt,
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
    public async Task GetList_Unauthenticated_Returns401()
    {
        var http = factory.CreateClient();
        var response = await http.GetAsync(
            "/trainer/weekly-check-ins?weekStartDate=2026-04-21",
            TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── Filtering ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetList_ReturnsOnlyOwnRows()
    {
        var (http, trainerId) = await SetupTrainerAsync();
        var (_, trainerId2) = await SetupTrainerAsync();
        var clientId = await SetupClientUserIdAsync();

        var weekDate = NextMonday();

        await InsertCheckInAsync(clientId, trainerId, weekDate);
        await InsertCheckInAsync(clientId, trainerId2, weekDate.AddDays(7)); // different week to avoid constraint

        var response = await http.GetAsync(
            $"/trainer/weekly-check-ins?weekStartDate={weekDate:yyyy-MM-dd}",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<CheckInsWrapper>(
            cancellationToken: TestContext.Current.CancellationToken);

        body!.CheckIns.Should().HaveCount(1);
        body.CheckIns[0].Profession.Should().Be("Training");
    }

    [Fact]
    public async Task GetList_DismissedRows_NotReturned()
    {
        var (http, trainerId) = await SetupTrainerAsync();
        var clientId = await SetupClientUserIdAsync();

        var weekDate = NextMonday().AddDays(14); // use a unique future week
        await InsertCheckInAsync(clientId, trainerId, weekDate, dismissed: true);

        var response = await http.GetAsync(
            $"/trainer/weekly-check-ins?weekStartDate={weekDate:yyyy-MM-dd}",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<CheckInsWrapper>(
            cancellationToken: TestContext.Current.CancellationToken);

        body!.CheckIns.Should().BeEmpty();
    }

    [Fact]
    public async Task GetList_ReturnsClientPublicId_NotUserId()
    {
        var (http, trainerId) = await SetupTrainerAsync();
        var (clientUserId, clientPublicId) = await SetupClientAsync();

        var weekDate = NextMonday().AddDays(56); // unique future week to avoid collisions
        await InsertCheckInAsync(clientUserId, trainerId, weekDate);

        var response = await http.GetAsync(
            $"/trainer/weekly-check-ins?weekStartDate={weekDate:yyyy-MM-dd}",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<CheckInsWrapper>(
            cancellationToken: TestContext.Current.CancellationToken);

        body!.CheckIns.Should().ContainSingle();
        var dto = body.CheckIns[0];
        dto.ClientUserId.Should().Be(clientUserId);
        dto.ClientPublicId.Should().Be(clientPublicId);
        dto.ClientPublicId.Should().NotBe(clientUserId);
        dto.ClientPublicId.Should().NotBe(Guid.Empty);
    }

    // ── Active-set (week-agnostic, #751) ─────────────────────────────────────

    [Fact]
    public async Task GetList_WeekOmitted_ReturnsRespondedNextWeekCheckIn()
    {
        var (http, trainerId) = await SetupTrainerAsync();
        var clientId = await SetupClientUserIdAsync();

        var nextMonday = NextMonday();
        await InsertCheckInAsync(clientId, trainerId, nextMonday, respondedAt: DateTime.UtcNow);

        var response = await http.GetAsync(
            "/trainer/weekly-check-ins",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<CheckInsWrapper>(
            cancellationToken: TestContext.Current.CancellationToken);

        body!.CheckIns.Should().ContainSingle(c => c.WeekStartDate == nextMonday);
    }

    [Fact]
    public async Task GetList_WeekOmitted_ExcludesReviewedAndDismissed()
    {
        var (http, trainerId) = await SetupTrainerAsync();
        var clientId = await SetupClientUserIdAsync();

        var weekA = NextMonday().AddDays(21);
        var weekB = NextMonday().AddDays(28);
        await InsertCheckInAsync(
            clientId, trainerId, weekA,
            respondedAt: DateTime.UtcNow,
            reviewedByTrainerAt: DateTime.UtcNow);
        await InsertCheckInAsync(clientId, trainerId, weekB, dismissed: true);

        var response = await http.GetAsync(
            "/trainer/weekly-check-ins",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<CheckInsWrapper>(
            cancellationToken: TestContext.Current.CancellationToken);

        body!.CheckIns.Should().NotContain(c => c.WeekStartDate == weekA || c.WeekStartDate == weekB);
    }

    [Fact]
    public async Task GetList_WeekOmitted_EnforcesOwnership()
    {
        var (http, trainerId) = await SetupTrainerAsync();
        var (_, otherTrainerId) = await SetupTrainerAsync();
        var clientId = await SetupClientUserIdAsync();

        var weekA = NextMonday().AddDays(35);
        var weekB = NextMonday().AddDays(42);
        await InsertCheckInAsync(clientId, trainerId, weekA, respondedAt: DateTime.UtcNow);
        await InsertCheckInAsync(clientId, otherTrainerId, weekB, respondedAt: DateTime.UtcNow);

        var response = await http.GetAsync(
            "/trainer/weekly-check-ins",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<CheckInsWrapper>(
            cancellationToken: TestContext.Current.CancellationToken);

        body!.CheckIns.Should().ContainSingle(c => c.WeekStartDate == weekA);
        body.CheckIns.Should().NotContain(c => c.WeekStartDate == weekB);
    }

    [Fact]
    public async Task GetList_WeekProvided_PreservesExactWeekBehavior()
    {
        var (http, trainerId) = await SetupTrainerAsync();
        var clientId = await SetupClientUserIdAsync();

        var weekDate = NextMonday().AddDays(49);
        var otherWeek = weekDate.AddDays(7);
        // A reviewed check-in for the same requested week would still match the
        // exact-week mode today (it only excludes dismissed) — assert that
        // legacy behavior is unchanged by the optional-param refactor.
        await InsertCheckInAsync(
            clientId, trainerId, weekDate,
            respondedAt: DateTime.UtcNow,
            reviewedByTrainerAt: DateTime.UtcNow);
        await InsertCheckInAsync(clientId, trainerId, otherWeek, respondedAt: DateTime.UtcNow);

        var response = await http.GetAsync(
            $"/trainer/weekly-check-ins?weekStartDate={weekDate:yyyy-MM-dd}",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<CheckInsWrapper>(
            cancellationToken: TestContext.Current.CancellationToken);

        body!.CheckIns.Should().ContainSingle(c => c.WeekStartDate == weekDate);
        body.CheckIns.Should().NotContain(c => c.WeekStartDate == otherWeek);
    }

    // ── Local DTOs ────────────────────────────────────────────────────────────
    private record CheckInsWrapper(List<CheckInDto> CheckIns);
    private record CheckInDto(
        Guid Id,
        Guid ClientUserId,
        Guid ClientPublicId,
        string ClientName,
        string Profession,
        DateOnly WeekStartDate);
}
