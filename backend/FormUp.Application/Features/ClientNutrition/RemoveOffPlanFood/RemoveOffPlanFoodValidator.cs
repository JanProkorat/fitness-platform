using FastEndpoints;
using FormUp.Application.Domain.Extensions;

namespace FormUp.Application.Features.ClientNutrition.RemoveOffPlanFood;

/// <summary>
/// Validates the <see cref="RemoveOffPlanFoodRequest"/>.
/// </summary>
public class RemoveOffPlanFoodValidator : Validator<RemoveOffPlanFoodRequest>
{
    /// <summary>
    /// Initializes validation rules for removing an off-plan food entry.
    /// </summary>
    public RemoveOffPlanFoodValidator()
    {
        this.AddOfflineSyncRules(x => x.OccurredAt, x => x.ClientRequestId);
    }
}
