using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.ClientPlans.FinalizePlanPhoto;

/// <summary>
/// Validator for <see cref="FinalizePlanPhotoRequest"/>.
/// </summary>
public class FinalizePlanPhotoValidator : Validator<FinalizePlanPhotoRequest>
{
    /// <summary>
    /// Regex that matches a valid blob file name: a UUID followed by an allowed image extension.
    /// Allowed extensions: jpg, jpeg, png, webp, heic, heif.
    /// </summary>
    private static readonly System.Text.RegularExpressions.Regex BlobFileNamePattern =
        new(@"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.(jpg|jpeg|png|webp|heic|heif)$",
            System.Text.RegularExpressions.RegexOptions.Compiled);

    /// <summary>
    /// Regex that matches a valid MongoDB ObjectId: exactly 24 hexadecimal characters.
    /// </summary>
    private static readonly System.Text.RegularExpressions.Regex MongoObjectIdPattern =
        new(@"^[0-9a-fA-F]{24}$",
            System.Text.RegularExpressions.RegexOptions.Compiled);

    /// <summary>
    /// Initializes a new instance of <see cref="FinalizePlanPhotoValidator"/>.
    /// </summary>
    public FinalizePlanPhotoValidator()
    {
        // BlobUrl must be non-empty and match the exact plan-scoped storage prefix.
        // This prevents path traversal and cross-plan blob hijacking: the URL must start with
        // "plan-photos/{planId}/" and the file name must be a UUID with an allowed image extension.
        //
        // The client may submit either the relative container path
        //   ("plan-photos/{planId}/{uuid}.{ext}")
        // OR the full public URL returned by the upload-url endpoint
        //   ("http(s)://{host}/{bucket}/plan-photos/{planId}/{uuid}.{ext}").
        // We normalise to the container path before checking, mirroring
        // DeletePlanPhotoEndpoint.ExtractContainerPath.
        RuleFor(x => x.BlobUrl)
            .NotEmpty()
            .MaximumLength(500)
            .Must((req, blobUrl) =>
            {
                if (string.IsNullOrEmpty(blobUrl))
                    return false;

                var containerPath = NormaliseToContainerPath(blobUrl);
                if (containerPath is null)
                    return false;

                var expectedPrefix = $"plan-photos/{req.PlanId}/";

                if (!containerPath.StartsWith(expectedPrefix, StringComparison.OrdinalIgnoreCase))
                    return false;

                var fileName = containerPath[expectedPrefix.Length..];
                return BlobFileNamePattern.IsMatch(fileName);
            })
            .WithErrorCode(ErrorCodes.InvalidBlobUrl)
            .WithMessage("BlobUrl must match plan-photos/{planId}/{uuid}.{ext} where ext is one of jpg, jpeg, png, webp, heic.");

        RuleFor(x => x.Description)
            .MaximumLength(500)
            .When(x => x.Description is not null);

        // MealLogId is a MongoDB ObjectId: exactly 24 hexadecimal characters.
        RuleFor(x => x.MealLogId)
            .MaximumLength(24)
            .Matches(MongoObjectIdPattern)
            .When(x => x.MealLogId is not null);

        RuleFor(x => x.Category)
            .IsInEnum();
    }

    /// <summary>
    /// Returns the MinIO container path (e.g. "plan-photos/abc/def.jpg") given
    /// either a relative path or a full public blob URL. Returns null when
    /// the input cannot be normalised.
    /// </summary>
    private static string? NormaliseToContainerPath(string blobUrl)
    {
        // If already a relative path (no scheme), use directly.
        if (!blobUrl.Contains("://", StringComparison.Ordinal))
            return blobUrl;

        // Strip scheme + host + bucket: keep everything after the bucket segment.
        // e.g. "http://localhost:9000/fitness-platform/plan-photos/abc/def.jpg"
        //   → "plan-photos/abc/def.jpg"
        try
        {
            var uri = new Uri(blobUrl);
            var path = uri.AbsolutePath.TrimStart('/');
            var firstSlash = path.IndexOf('/', StringComparison.Ordinal);
            return firstSlash >= 0 ? path[(firstSlash + 1)..] : null;
        }
        catch
        {
            return null;
        }
    }
}
