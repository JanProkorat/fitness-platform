using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.NutritionPlans.CreatePlan;

/// <summary>
/// Validates the <see cref="CreatePlanRequest"/>.
/// </summary>
public class CreatePlanValidator : Validator<CreatePlanRequest>
{
    /// <summary>
    /// Initializes validation rules for creating a nutrition plan.
    /// </summary>
    public CreatePlanValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(x => x.ClientId)
            .NotEmpty();

        RuleFor(x => x.WeekCount)
            .InclusiveBetween(1, 52);

        RuleFor(x => x.StartDate)
            .Must(d => d!.Value.DayOfWeek == System.DayOfWeek.Monday)
            .WithErrorCode(Domain.Constants.ErrorCodes.StartDateNotMonday)
            .WithMessage("Start date must be a Monday.")
            .When(x => x.StartDate.HasValue);

        RuleFor(x => x.StartDate)
            .Must(d => DateOnly.FromDateTime(d!.Value) >= DateOnly.FromDateTime(DateTime.UtcNow))
            .WithErrorCode(Domain.Constants.ErrorCodes.StartDateInPast)
            .WithMessage("Start date cannot be in the past.")
            .When(x => x.StartDate.HasValue);

        RuleFor(x => x.TargetWeightKg)
            .GreaterThan(0)
            .WithMessage("TargetWeightKg must be greater than zero.")
            .When(x => x.TargetWeightKg.HasValue);

        RuleFor(x => x.Goal)
            .IsInEnum()
            .WithMessage("Goal must be a valid PrimaryGoal value.")
            .When(x => x.Goal.HasValue);
    }
}
