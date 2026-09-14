using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.NutritionPlans.CalculateGoals;
using FitnessPlatform.Application.Infrastructure.Services;

namespace FitnessPlatform.Tests.Endpoints.NutritionPlans;

/// <summary>
/// Tests for <see cref="CalculateGoalsEndpoint"/>.
/// </summary>
public class CalculateGoalsEndpointTests
{
    private readonly Guid _nutritionistId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_ValidRequest_ReturnsCalculation()
    {
        var calculator = new MacroCalculatorService();
        var linkAuthorizationService = EndpointTestHelpers.CreateGrantingLinkAuthorizationService();

        var ep = Factory.Create<CalculateGoalsEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            calculator, linkAuthorizationService);

        var request = new CalculateGoalsRequest
        {
            ClientId = Guid.NewGuid(),
            WeightKg = 80,
            HeightCm = 180,
            Age = 30,
            Sex = "Male",
            ActivityLevel = "ModeratelyActive",
            Goal = "Maintain",
            ProteinPercent = 30,
            CarbsPercent = 45,
            FatPercent = 25
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.Response.Should().NotBeNull();
        // BMR = 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
        ep.Response.Bmr.Should().Be(1780m);
        // TDEE = 1780 * 1.55 = 2759
        ep.Response.Tdee.Should().Be(2759m);
        // Maintain => no adjustment
        ep.Response.AdjustedKcal.Should().Be(2759m);
        ep.Response.MacroTargets.Should().NotBeNull();
        ep.Response.MacroTargets.DailyKcal.Should().Be(2759m);
    }

    [Fact]
    public async Task HandleAsync_NoLink_Returns404()
    {
        var calculator = new MacroCalculatorService();
        var linkAuthorizationService = PlanTestHelpers.CreateDenyingLinkAuthorizationService();

        var ep = Factory.Create<CalculateGoalsEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            calculator, linkAuthorizationService);

        var request = new CalculateGoalsRequest
        {
            ClientId = Guid.NewGuid(),
            WeightKg = 80,
            HeightCm = 180,
            Age = 30,
            Sex = "Male",
            ActivityLevel = "ModeratelyActive",
            Goal = "Maintain"
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    /// <summary>
    /// Mirror-site regression guard: this is a nutrition route and must require
    /// <c>CanViewNutritionPlans</c> specifically. A link that grants only the training domain
    /// must still be denied — if the guard were ever widened to <c>caps is not null</c>, this
    /// test would regress to 200.
    /// </summary>
    [Fact]
    public async Task HandleAsync_LinkGrantsOnlyTraining_Returns404()
    {
        var calculator = new MacroCalculatorService();
        var linkAuthorizationService = EndpointTestHelpers.CreateGrantingLinkAuthorizationService(
            canViewNutritionPlans: false, canViewTrainingPlans: true);

        var ep = Factory.Create<CalculateGoalsEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            calculator, linkAuthorizationService);

        var request = new CalculateGoalsRequest
        {
            ClientId = Guid.NewGuid(),
            WeightKg = 80,
            HeightCm = 180,
            Age = 30,
            Sex = "Male",
            ActivityLevel = "ModeratelyActive",
            Goal = "Maintain"
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var calculator = new MacroCalculatorService();
        var linkAuthorizationService = EndpointTestHelpers.CreateGrantingLinkAuthorizationService();

        var ep = Factory.Create<CalculateGoalsEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity()),
            calculator, linkAuthorizationService);

        var request = new CalculateGoalsRequest
        {
            ClientId = Guid.NewGuid(),
            WeightKg = 80,
            HeightCm = 180,
            Age = 30,
            Sex = "Male",
            ActivityLevel = "ModeratelyActive",
            Goal = "Maintain"
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }
}
