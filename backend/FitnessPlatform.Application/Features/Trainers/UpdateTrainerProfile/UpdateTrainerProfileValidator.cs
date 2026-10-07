using System.Text.Json;
using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Trainers.UpdateTrainerProfile;

/// <summary>
/// Validator for the professional profile update request.
/// </summary>
public class UpdateProfessionalProfileValidator : Validator<UpdateProfessionalProfileRequest>
{
    /// <inheritdoc />
    public UpdateProfessionalProfileValidator()
    {
        RuleFor(x => x.Bio)
            .MaximumLength(1000);

        RuleFor(x => x.Specialization)
            .MaximumLength(100);

        RuleFor(x => x.City)
            .MaximumLength(100);

        RuleFor(x => x.EstimatedPrice)
            .MaximumLength(100);

        RuleFor(x => x.Specializations)
            .MaximumLength(2000);

        RuleFor(x => x.Certificates)
            .MaximumLength(2000)
            .Must(BeValidCertificatesJson)
            .WithErrorCode("INVALID_CERTIFICATES")
            .WithMessage("Certificates must be a JSON array of strings or objects with a non-empty 'title'.")
            .When(x => !string.IsNullOrEmpty(x.Certificates));

        RuleFor(x => x.Languages)
            .MaximumLength(1000);

        RuleFor(x => x.CollaborationType)
            .MaximumLength(20)
            .Must(x => x is null or "both" or "online" or "inperson")
            .WithMessage("CollaborationType must be 'both', 'online', or 'inperson'.");

        RuleFor(x => x.LinkedIn)
            .MaximumLength(200);

        RuleFor(x => x.Instagram)
            .MaximumLength(200);

        RuleFor(x => x.Website)
            .MaximumLength(200);
    }

    private static bool BeValidCertificatesJson(string? json)
    {
        try
        {
            using var document = JsonDocument.Parse(json!);

            if (document.RootElement.ValueKind != JsonValueKind.Array)
            {
                return false;
            }

            foreach (var element in document.RootElement.EnumerateArray())
            {
                var isValid = element.ValueKind switch
                {
                    JsonValueKind.String => true,
                    JsonValueKind.Object => element.TryGetProperty("title", out var title)
                        && title.ValueKind == JsonValueKind.String
                        && !string.IsNullOrWhiteSpace(title.GetString()),
                    _ => false,
                };

                if (!isValid)
                {
                    return false;
                }
            }

            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }
}
