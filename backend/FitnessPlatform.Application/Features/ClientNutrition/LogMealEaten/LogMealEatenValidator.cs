using FastEndpoints;
using FitnessPlatform.Application.Domain.Extensions;
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

        RuleFor(x => x.SeenMealItems)
            .Must(items => items!.Count <= 40)
            .WithMessage("At most 40 seen meal items are allowed.")
            .When(x => x.SeenMealItems is not null);

        RuleForEach(x => x.SeenMealItems)
            .NotNull()
            .ChildRules(item =>
            {
                item.RuleFor(i => i.Kind).IsInEnum();
                item.RuleFor(i => i.RefId).NotEmpty();
                item.RuleFor(i => i.Name).NotEmpty().MaximumLength(200);
                item.RuleFor(i => i.Amount).InclusiveBetween(0m, 10000m);
                item.RuleFor(i => i.Kcal).InclusiveBetween(0m, 20000m);
            })
            .When(x => x.SeenMealItems is not null);

        this.AddOfflineSyncRules(x => x.OccurredAt, x => x.ClientRequestId);
    }
}
