using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.Client.Progress.GetComplianceScore;
using FitnessPlatform.Tests.Builders;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Client;

/// <summary>
/// Unit tests for <see cref="GetComplianceScoreEndpoint"/>.
/// </summary>
public class GetComplianceScoreEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();
    private readonly IComplianceService _complianceService = Substitute.For<IComplianceService>();

    [Fact]
    public async Task HandleAsync_ValidRequest_ReturnsComplianceData()
    {
        // Arrange
        var from = DateTime.UtcNow.Date.AddDays(-7);
        var to = DateTime.UtcNow.Date;

        _complianceService.CalculateComplianceAsync(
                _clientId, Arg.Any<DateTime>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>())
            .Returns(new ComplianceResult
            {
                CompliancePercent = 85.5m,
                MealsPlanned = 21,
                MealsLogged = 18
            });

        _complianceService.CalculateStreakAsync(_clientId, Arg.Any<DateOnly>(), Arg.Any<CancellationToken>())
            .Returns(5);

        // Endpoint needs IApplicationDbContext to resolve ClientProfile.PublicId from UserId.
        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

        var ep = Factory.Create<GetComplianceScoreEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            _complianceService, db, TimeProvider.System);

        // Act
        await ep.HandleAsync(new GetComplianceScoreRequest
        {
            From = from,
            To = to
        }, TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.CompliancePercent.Should().Be(85.5m);
        ep.Response.MealsPlanned.Should().Be(21);
        ep.Response.MealsLogged.Should().Be(18);
        ep.Response.CurrentStreak.Should().Be(5);
        ep.Response.From.Should().Be(from);
        ep.Response.To.Should().Be(to);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        // Arrange — no user claims; db is never reached (401 short-circuits before the DB call)
        var db = new MockDbBuilder().Build();
        var ep = Factory.Create<GetComplianceScoreEndpoint>(_complianceService, db, TimeProvider.System);

        // Act
        await ep.HandleAsync(new GetComplianceScoreRequest(), TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }

    /// <summary>
    /// #955 boundary case: a Prague client at 00:30 LOCAL time Monday (22:30 UTC Sunday) must get
    /// the default date range and streak anchor computed from the CURRENT local day, not the
    /// previous UTC day. The pinned instant is deliberately a summer (CEST, UTC+2) Sunday — a
    /// winter (CET, UTC+1) instant is still a Sunday under the UTC derivation too and would pass
    /// under the pre-#955 broken code, proving nothing. Under the OLD
    /// <c>DateTime.UtcNow</c>-based derivation, From lands on 2026-06-28 and the streak anchor on
    /// 2026-07-05 — this test fails under that code.
    /// </summary>
    [Fact]
    public async Task HandleAsync_PragueClientAt0030LocalMonday_DefaultsToCurrentLocalDayRange()
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

        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .With(new ApplicationUser { Id = _clientId, TimeZone = "Europe/Prague" })
            .Build();

        var ep = Factory.Create<GetComplianceScoreEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            _complianceService, db, fixedTimeProvider);

        // No From/To supplied — endpoint must derive the default range from the client's local day.
        await ep.HandleAsync(new GetComplianceScoreRequest(), TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // Fixed (correct): From = current local day - 7. Reverted (broken, UTC-derived):
        // From = 2026-06-28.
        ep.Response.From.Should().Be(new DateTime(2026, 6, 29, 0, 0, 0, DateTimeKind.Utc));
        ep.Response.To.Should().Be(new DateTime(2026, 7, 7, 0, 0, 0, DateTimeKind.Utc).AddTicks(-1));

        // GetComplianceScoreResponse does not echo the streak anchor — assert it via the mock
        // invocation instead. Reverted (broken, UTC-derived) anchor would be DateOnly(2026, 7, 5).
        await _complianceService.Received(1).CalculateStreakAsync(
            _clientId, new DateOnly(2026, 7, 6), Arg.Any<CancellationToken>());
    }
}
