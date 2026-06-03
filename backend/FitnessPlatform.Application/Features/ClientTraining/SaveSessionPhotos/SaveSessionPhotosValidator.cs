using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientTraining.SaveSessionPhotos;

/// <summary>
/// Validator for the <see cref="SaveSessionPhotosRequest"/>.
/// </summary>
public class SaveSessionPhotosValidator : Validator<SaveSessionPhotosRequest>
{
    /// <summary>
    /// Initializes validation rules for the save session photos request.
    /// </summary>
    public SaveSessionPhotosValidator()
    {
        RuleFor(x => x.Note)
            .MaximumLength(500)
            .WithMessage("Note must not exceed 500 characters.")
            .When(x => x.Note is not null);

        RuleForEach(x => x.Photos)
            .ChildRules(photo =>
            {
                // BlobUrl must be non-empty
                photo.RuleFor(p => p.BlobUrl)
                    .NotEmpty()
                    .WithMessage("Photo URL must not be empty.");

                // When BlobUrl is provided, it must be an HTTP/HTTPS URL
                photo.RuleFor(p => p.BlobUrl)
                    .Must(url => url.StartsWith("http", StringComparison.OrdinalIgnoreCase))
                    .WithMessage("Photo URL must be a valid HTTP/HTTPS URL.")
                    .When(p => !string.IsNullOrEmpty(p.BlobUrl));

                // Per-photo note is optional but bounded at 500 chars
                photo.RuleFor(p => p.Note)
                    .MaximumLength(500)
                    .WithMessage("Per-photo note must not exceed 500 characters.")
                    .When(p => p.Note is not null);
            })
            .When(x => x.Photos is { Count: > 0 });
    }
}
