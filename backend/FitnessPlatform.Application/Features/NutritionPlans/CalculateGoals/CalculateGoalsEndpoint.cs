using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;

namespace FitnessPlatform.Application.Features.NutritionPlans.CalculateGoals;

/// <summary>
/// Calculates BMR, TDEE, adjusted calories, and macro split for a client.
/// </summary>
/// <param name="calculator">Macro calculator service.</param>
/// <param name="linkAuthorizationService">Resolves the nutritionist-client link's CanViewNutritionPlans permission.</param>
public class CalculateGoalsEndpoint(
    IMacroCalculatorService calculator, IClientLinkAuthorizationService linkAuthorizationService)
    : Endpoint<CalculateGoalsRequest, CalculateGoalsResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/nutrition/clients/{ClientId}/calculate-goals");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Calculate nutrition goals";
            s.Description = "Calculates BMR, TDEE, goal-adjusted calories, and macronutrient split for a client.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CalculateGoalsRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var nutritionistId = Guid.Parse(userId);

        // Verify nutritionist has active link to the client with nutrition-domain access.
        // req.ClientId is the nutritionist-facing ClientProfile.PublicId — the PublicId-addressed
        // overload.
        var capabilities = await linkAuthorizationService.GetCapabilitiesByClientPublicIdAsync(
            nutritionistId, req.ClientId, ct);

        if (capabilities is not { CanViewNutritionPlans: true })
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var sex = Enum.Parse<BiologicalSex>(req.Sex, true);
        var activityLevel = Enum.Parse<ActivityLevel>(req.ActivityLevel, true);
        var goal = Enum.Parse<NutritionGoal>(req.Goal, true);

        var bmr = calculator.CalculateBmr(req.WeightKg, req.HeightCm, req.Age, sex);
        var tdee = calculator.CalculateTdee(bmr, activityLevel);
        var adjustedKcal = calculator.ApplyGoalAdjustment(tdee, goal);
        var macroTargets = calculator.CalculateMacroSplit(adjustedKcal, req.ProteinPercent, req.CarbsPercent, req.FatPercent);

        await Send.OkAsync(new CalculateGoalsResponse
        {
            Bmr = bmr,
            Tdee = tdee,
            AdjustedKcal = adjustedKcal,
            MacroTargets = macroTargets
        }, ct);
    }
}
