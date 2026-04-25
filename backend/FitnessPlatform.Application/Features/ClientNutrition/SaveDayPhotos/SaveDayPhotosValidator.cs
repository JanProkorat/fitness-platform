using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.ClientNutrition.SaveDayPhotos;

/// <summary>
/// Validates the <see cref="SaveDayPhotosRequest"/>.
/// </summary>
public class SaveDayPhotosValidator : Validator<SaveDayPhotosRequest>
{
    /// <summary>
    /// Initializes validation rules for the save day photos request.
    /// </summary>
    public SaveDayPhotosValidator()
    {
        RuleFor(x => x.Note)
            .MaximumLength(500)
            .WithMessage("Note must not exceed 500 characters.")
            .When(x => x.Note is not null);

        RuleForEach(x => x.Photos)
            .ChildRules(photo =>
            {
                photo.RuleFor(p => p.BlobUrl)
                    .NotEmpty()
                    .WithMessage("Photo URL must not be empty.");

                photo.RuleFor(p => p.BlobUrl)
                    .Must(url => url.StartsWith("http", StringComparison.OrdinalIgnoreCase))
                    .WithMessage("Photo URL must be a valid HTTP/HTTPS URL.")
                    .When(p => !string.IsNullOrEmpty(p.BlobUrl));

                photo.RuleFor(p => p.Note)
                    .MaximumLength(500)
                    .WithMessage("Per-photo note must not exceed 500 characters.")
                    .When(p => p.Note is not null);

                photo.RuleFor(p => p.Category)
                    .IsInEnum()
                    .WithMessage($"Category must be one of: {string.Join(", ", Enum.GetNames<DayPhotoCategory>())}.");
            })
            .When(x => x.Photos is { Count: > 0 });
    }
}
