using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
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

        _complianceService.CalculateStreakAsync(_clientId, Arg.Any<CancellationToken>())
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
            _complianceService, db);

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
        var ep = Factory.Create<GetWeeklyOverviewEndpoint>(_complianceService, db);

        // Act
        await ep.HandleAsync(TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }
}
