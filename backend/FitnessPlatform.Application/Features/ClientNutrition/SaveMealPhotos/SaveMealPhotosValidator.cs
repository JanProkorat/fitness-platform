using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientNutrition.SaveMealPhotos;

/// <summary>
/// Validator for the <see cref="SaveMealPhotosRequest"/>.
/// </summary>
public class SaveMealPhotosValidator : Validator<SaveMealPhotosRequest>
{
    /// <summary>
    /// Initializes validation rules for the save meal photos request.
    /// </summary>
    public SaveMealPhotosValidator()
    {
        RuleFor(x => x.Note)
            .MaximumLength(500)
            .WithMessage("Note must not exceed 500 characters.")
            .When(x => x.Note is not null);

        RuleForEach(x => x.PhotoBlobUrls)
            .NotEmpty()
            .WithMessage("Photo URL must not be empty.")
            .Must(url => url.StartsWith("http", StringComparison.OrdinalIgnoreCase))
            .WithMessage("Photo URL must be a valid HTTP/HTTPS URL.")
            .When(x => x.PhotoBlobUrls is { Count: > 0 });
    }
}
