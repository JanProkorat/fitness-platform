using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
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
}
