using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientNutrition.AttachMealPhotos;

/// <summary>
/// Validator for the <see cref="AttachMealPhotosRequest"/>.
/// </summary>
public class AttachMealPhotosValidator : Validator<AttachMealPhotosRequest>
{
    /// <summary>
    /// Initializes validation rules for the attach meal photos request.
    /// </summary>
    public AttachMealPhotosValidator()
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
            .When(x => x.PhotoBlobUrls is not null && x.PhotoBlobUrls.Count > 0);
    }
}
