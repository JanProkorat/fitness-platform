using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.ClientPhotos.FinalizeUnlinkedPhoto;

/// <summary>
/// Validator for <see cref="FinalizeUnlinkedPhotoRequest"/>. The caller-bound blob prefix is checked
/// in the endpoint, because a validator cannot see the caller.
/// </summary>
public class FinalizeUnlinkedPhotoValidator : Validator<FinalizeUnlinkedPhotoRequest>
{
    private static readonly System.Text.RegularExpressions.Regex BlobFileNamePattern =
        new(@"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.(jpg|jpeg|png|webp|heic|heif)$",
            System.Text.RegularExpressions.RegexOptions.Compiled);

    /// <summary>
    /// Initializes a new instance of <see cref="FinalizeUnlinkedPhotoValidator"/>.
    /// </summary>
    public FinalizeUnlinkedPhotoValidator()
    {
        RuleFor(x => x.BlobUrl)
            .NotEmpty()
            .MaximumLength(500)
            .Must(HasValidFileName)
            .WithErrorCode(ErrorCodes.InvalidBlobUrl)
            .WithMessage("BlobUrl must end with {uuid}.{ext} where ext is one of jpg, jpeg, png, webp, heic, heif.");

        RuleFor(x => x.Category)
            .Must(category => category is PlanPhotoCategory.Body or PlanPhotoCategory.FreeForm)
            .WithMessage("Category must be Body or FreeForm for a photo without a plan.");

        RuleFor(x => x.Description)
            .MaximumLength(500)
            .When(x => x.Description is not null);
    }

    private static bool HasValidFileName(string? blobUrl)
    {
        if (string.IsNullOrEmpty(blobUrl))
        {
            return false;
        }

        var withoutQuery = blobUrl.Split('?', 2)[0];

        if (withoutQuery.Contains("..", StringComparison.Ordinal) || withoutQuery.Contains('\\', StringComparison.Ordinal))
        {
            return false;
        }

        var fileName = withoutQuery[(withoutQuery.LastIndexOf('/') + 1)..];
        return BlobFileNamePattern.IsMatch(fileName);
    }
}
