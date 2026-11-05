using FastEndpoints;
using FormUp.Application.Domain.Constants;
using FluentValidation;

namespace FormUp.Application.Features.ClientNutrition.GetWeekMealLog;

/// <summary>
/// Validates the <see cref="GetWeekMealLogRequest"/>.
/// </summary>
public class GetWeekMealLogValidator : Validator<GetWeekMealLogRequest>
{
    /// <summary>
    /// Initializes validation rules for the week meal-log request.
    /// </summary>
    public GetWeekMealLogValidator()
    {
        RuleFor(x => x.Date)
            .Must(date => date.Year >= 2000)
            .WithErrorCode(ErrorCodes.Required)
            .WithMessage("Date is required (yyyy-MM-dd).");
    }
}
