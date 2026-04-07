using FluentValidation;

namespace FitnessPlatform.Application.Features.Trainers.UpdateTrainerProfile;

/// <summary>
/// Validator for the professional profile update request.
/// </summary>
public class UpdateProfessionalProfileValidator : AbstractValidator<UpdateProfessionalProfileRequest>
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
            .MaximumLength(2000);

        RuleFor(x => x.Languages)
            .MaximumLength(1000);

        RuleFor(x => x.CollaborationType)
            .MaximumLength(20)
            .Must(x => x is null or "both" or "online" or "inperson")
            .WithMessage("CollaborationType must be 'both', 'online', or 'inperson'.");

        RuleFor(x => x.MaxClients)
            .InclusiveBetween(1, 200)
            .When(x => x.MaxClients.HasValue);

        RuleFor(x => x.LinkedIn)
            .MaximumLength(200);

        RuleFor(x => x.Instagram)
            .MaximumLength(200);

        RuleFor(x => x.Website)
            .MaximumLength(200);
    }
}
