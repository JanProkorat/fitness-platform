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
/// Uses Testcontainers PostgreSQL (Docker required). Excluded from CI.
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
        bool dismissed = false)
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
            DismissedByClientAt = dismissed ? DateTime.UtcNow : null,
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

    // ── Local DTOs ────────────────────────────────────────────────────────────
    private record CheckInsWrapper(List<CheckInDto> CheckIns);
    private record CheckInDto(Guid Id, Guid ClientUserId, string ClientName, string Profession, DateOnly WeekStartDate);
}
