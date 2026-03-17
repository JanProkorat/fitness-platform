using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Trainers.GetClientProgress;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Services;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Trainers;

/// <summary>
/// Unit tests for <see cref="GetClientProgressEndpoint"/>.
/// </summary>
public class GetClientProgressEndpointTests
{
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly Guid _clientId = Guid.NewGuid();
    private readonly IComplianceService _complianceService = Substitute.For<IComplianceService>();
    private readonly IAuditService _audit = Substitute.For<IAuditService>();

    /// <summary>
    /// Creates a NutritionAuthHelper mock configured to return the specified link status.
    /// </summary>
    private NutritionAuthHelper CreateAuthHelper(bool hasLink)
    {
        var authDb = Substitute.For<IApplicationDbContext>();
        var helper = Substitute.ForPartsOf<NutritionAuthHelper>(authDb);
        helper.HasActiveLinkAsync(
                Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(hasLink);
        return helper;
    }

    [Fact]
    public async Task HandleAsync_ActiveLink_ReturnsProgress()
    {
        // Arrange
        var authHelper = CreateAuthHelper(hasLink: true);

        _complianceService.CalculateComplianceAsync(
                _clientId, Arg.Any<DateTime>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>())
            .Returns(new ComplianceResult
            {
                CompliancePercent = 75m,
                MealsPlanned = 12,
                MealsLogged = 9
            });

        _complianceService.CalculateStreakAsync(_clientId, Arg.Any<CancellationToken>())
            .Returns(4);

        _complianceService.CalculateAverageMacrosAsync(
                _clientId, Arg.Any<DateTime>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>())
            .Returns(new NutrientTotals
            {
                Kcal = 1800,
                Protein = 130,
                Carbs = 200,
                Fat = 60
            });

        var ep = Factory.Create<GetClientProgressEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            _complianceService, authHelper, _audit);

        // Act
        await ep.HandleAsync(new GetClientProgressRequest
        {
            ClientId = _clientId
        }, TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.CompliancePercent.Should().Be(75m);
        ep.Response.MealsPlanned.Should().Be(12);
        ep.Response.MealsLogged.Should().Be(9);
        ep.Response.CurrentStreak.Should().Be(4);
        ep.Response.AverageDailyMacros.Kcal.Should().Be(1800);
        ep.Response.AverageDailyMacros.Protein.Should().Be(130);

        // Verify audit was logged
        await _audit.Received(1).LogAsync(
            _trainerId,
            "Read",
            "ClientProgress",
            _clientId,
            Arg.Any<string?>(),
            Arg.Any<string?>(),
            Arg.Any<string?>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NoLink_Returns404()
    {
        // Arrange — no active link
        var authHelper = CreateAuthHelper(hasLink: false);

        var ep = Factory.Create<GetClientProgressEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            _complianceService, authHelper, _audit);

        // Act
        await ep.HandleAsync(new GetClientProgressRequest
        {
            ClientId = _clientId
        }, TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        // Arrange — no user claims
        var authHelper = CreateAuthHelper(hasLink: false);

        var ep = Factory.Create<GetClientProgressEndpoint>(
            _complianceService, authHelper, _audit);

        // Act
        await ep.HandleAsync(new GetClientProgressRequest
        {
            ClientId = _clientId
        }, TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }
}
