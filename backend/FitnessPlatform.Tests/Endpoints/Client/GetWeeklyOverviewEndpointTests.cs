using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.Client.Progress.GetWeeklyOverview;
using FitnessPlatform.Tests.Builders;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Client;

/// <summary>
/// Unit tests for <see cref="GetWeeklyOverviewEndpoint"/>.
/// </summary>
public class GetWeeklyOverviewEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();
    private readonly IComplianceService _complianceService = Substitute.For<IComplianceService>();

    [Fact]
    public async Task HandleAsync_ValidRequest_ReturnsWeeklyOverview()
    {
        // Arrange
        _complianceService.CalculateComplianceAsync(
                _clientId, Arg.Any<DateTime>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>())
            .Returns(new ComplianceResult
            {
                CompliancePercent = 90m,
                MealsPlanned = 14,
                MealsLogged = 13
            });

        _complianceService.CalculateStreakAsync(_clientId, Arg.Any<DateOnly>(), Arg.Any<CancellationToken>())
            .Returns(3);

        _complianceService.CalculateAverageMacrosAsync(
                _clientId, Arg.Any<DateTime>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>())
            .Returns(new NutrientTotals
            {
                Kcal = 2100,
                Protein = 150,
                Carbs = 250,
                Fat = 70
            });

        // Endpoint needs IApplicationDbContext to resolve ClientProfile.PublicId from UserId.
        // The fake JWT encodes _clientId as UserId; the profile must map UserId→PublicId = _clientId.
        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

        var ep = Factory.Create<GetWeeklyOverviewEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            _complianceService, db, TimeProvider.System);

        // Act
        await ep.HandleAsync(TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.CompliancePercent.Should().Be(90m);
        ep.Response.MealsPlanned.Should().Be(14);
        ep.Response.MealsLogged.Should().Be(13);
        ep.Response.CurrentStreak.Should().Be(3);
        ep.Response.AverageDailyMacros.Kcal.Should().Be(2100);
        ep.Response.AverageDailyMacros.Protein.Should().Be(150);
        ep.Response.AverageDailyMacros.Carbs.Should().Be(250);
        ep.Response.AverageDailyMacros.Fat.Should().Be(70);

        // WeekStart should be a Monday, WeekEnd should be a Sunday
        ep.Response.WeekStart.DayOfWeek.Should().Be(DayOfWeek.Monday);
        ep.Response.WeekEnd.DayOfWeek.Should().Be(DayOfWeek.Sunday);
        (ep.Response.WeekEnd - ep.Response.WeekStart).Days.Should().Be(6);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        // Arrange — no user claims; db is never reached (401 short-circuits before the DB call)
        var db = new MockDbBuilder().Build();
        var ep = Factory.Create<GetWeeklyOverviewEndpoint>(_complianceService, db, TimeProvider.System);

        // Act
        await ep.HandleAsync(TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }

    /// <summary>
    /// #955 boundary case: a Prague client at 00:30 LOCAL time Monday (22:30 UTC Sunday) must see
    /// the CURRENT local week (weekStart = that Monday), not the previous week. The pinned instant
    /// is deliberately a summer (CEST, UTC+2) Sunday — under a winter (CET, UTC+1) instant the same
    /// UTC-derived weekday is still Sunday and the test would pass under the pre-#955 broken code
    /// too, proving nothing. Under the OLD <c>DateTime.UtcNow</c>-based derivation, the UTC day is
    /// still Sunday, so <c>daysToMonday</c> resolves to 6 and weekStart lands on the PREVIOUS
    /// Monday (2026-06-29) — this test fails under that code.
    /// </summary>
    [Fact]
    public async Task HandleAsync_PragueClientAt0030LocalMonday_ReturnsCurrentWeekNotPrevious()
    {
        // 2026-07-05 22:30 UTC == 2026-07-06 00:30 in Europe/Prague (CEST, UTC+2 in July).
        var fixedInstantUtc = new DateTime(2026, 7, 5, 22, 30, 0, DateTimeKind.Utc);
        var fixedTimeProvider = new FixedTimeProvider(fixedInstantUtc);
        var pragueTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Prague");

        // Precondition sanity check: the chosen instant genuinely straddles the local-midnight
        // boundary — proves this isn't a winter date that would neuter the test (see remarks).
        ClientLocalDateResolver.ResolveLocalDateUtcMidnight(fixedInstantUtc, pragueTimeZone)
            .Should().Be(new DateTime(2026, 7, 6, 0, 0, 0, DateTimeKind.Utc),
                "22:30 UTC in July is already past midnight in Europe/Prague (CEST, UTC+2)");

        _complianceService.CalculateComplianceAsync(
                _clientId, Arg.Any<DateTime>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>())
            .Returns(new ComplianceResult { CompliancePercent = 0m });
        _complianceService.CalculateStreakAsync(_clientId, Arg.Any<DateOnly>(), Arg.Any<CancellationToken>())
            .Returns(0);
        _complianceService.CalculateAverageMacrosAsync(
                _clientId, Arg.Any<DateTime>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>())
            .Returns(new NutrientTotals());

        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .With(new ApplicationUser { Id = _clientId, TimeZone = "Europe/Prague" })
            .Build();

        var ep = Factory.Create<GetWeeklyOverviewEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            _complianceService, db, fixedTimeProvider);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // Fixed (correct): the CURRENT local week's Monday. Reverted (broken, UTC-derived): the
        // PREVIOUS Monday, 2026-06-29.
        ep.Response.WeekStart.Should().Be(new DateTime(2026, 7, 6, 0, 0, 0, DateTimeKind.Utc));
        ep.Response.WeekEnd.Should().Be(new DateTime(2026, 7, 12, 0, 0, 0, DateTimeKind.Utc));

        await _complianceService.Received(1).CalculateStreakAsync(
            _clientId, new DateOnly(2026, 7, 6), Arg.Any<CancellationToken>());
    }
}
