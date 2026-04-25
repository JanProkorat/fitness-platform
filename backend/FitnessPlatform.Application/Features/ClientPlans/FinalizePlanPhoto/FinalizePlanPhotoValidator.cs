using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.ClientPlans.FinalizePlanPhoto;

/// <summary>
/// Validator for <see cref="FinalizePlanPhotoRequest"/>.
/// </summary>
public class FinalizePlanPhotoValidator : Validator<FinalizePlanPhotoRequest>
{
    /// <summary>
    /// Initializes a new instance of <see cref="FinalizePlanPhotoValidator"/>.
    /// </summary>
    public FinalizePlanPhotoValidator()
    {
        RuleFor(x => x.BlobUrl)
            .NotEmpty()
            .MaximumLength(500);

        RuleFor(x => x.Description)
            .MaximumLength(500)
            .When(x => x.Description is not null);

        RuleFor(x => x.MealLogId)
            .MaximumLength(50)
            .When(x => x.MealLogId is not null);

        RuleFor(x => x.Category)
            .IsInEnum();
    }
}
