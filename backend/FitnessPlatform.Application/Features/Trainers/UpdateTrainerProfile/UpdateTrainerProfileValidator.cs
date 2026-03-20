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
    }
}
