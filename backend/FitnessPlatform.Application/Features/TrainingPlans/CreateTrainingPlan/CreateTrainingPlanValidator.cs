using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.TrainingPlans.CreateTrainingPlan;

/// <summary>
/// Validates the <see cref="CreateTrainingPlanRequest"/>.
/// </summary>
public class CreateTrainingPlanValidator : Validator<CreateTrainingPlanRequest>
{
    /// <summary>
    /// Initializes validation rules for creating a training plan.
    /// </summary>
    public CreateTrainingPlanValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(x => x.ClientId)
            .NotEmpty();

        RuleFor(x => x.WeekCount)
            .InclusiveBetween(1, 52);

        RuleFor(x => x.Description)
            .MaximumLength(2000)
            .When(x => x.Description is not null);

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
    }
}
