using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientNutrition.LogMealEaten;

/// <summary>
/// Validator for the <see cref="LogMealEatenRequest"/>.
/// </summary>
public class LogMealEatenValidator : Validator<LogMealEatenRequest>
{
    /// <summary>
    /// Initializes validation rules for the log meal eaten request.
    /// </summary>
    public LogMealEatenValidator()
    {
        RuleFor(x => x.MealId)
            .NotEmpty()
            .WithMessage("MealId is required.");

        RuleFor(x => x.Note)
            .MaximumLength(500)
            .WithMessage("Note must not exceed 500 characters.")
            .When(x => x.Note is not null);

        RuleForEach(x => x.PhotoBlobUrls)
            .NotEmpty()
            .WithMessage("Photo URL must not be empty.")
            .Must(url => url.StartsWith("http", StringComparison.OrdinalIgnoreCase))
            .WithMessage("Photo URL must be a valid HTTP/HTTPS URL.")
            .When(x => x.PhotoBlobUrls is not null && x.PhotoBlobUrls.Count > 0);
    }
}
