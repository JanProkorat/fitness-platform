using FluentValidation;

namespace FitnessPlatform.Application.Features.Trainers.UpdateTrainerProfile;

/// <summary>
/// Validator for the trainer profile update request.
/// </summary>
public class UpdateTrainerProfileValidator : AbstractValidator<UpdateTrainerProfileRequest>
{
    /// <inheritdoc />
    public UpdateTrainerProfileValidator()
    {
        RuleFor(x => x.Bio)
            .MaximumLength(1000);

        RuleFor(x => x.Specialization)
            .MaximumLength(100);

        RuleFor(x => x.YearsOfExperience)
            .GreaterThanOrEqualTo(0)
            .LessThanOrEqualTo(80);
    }
}
