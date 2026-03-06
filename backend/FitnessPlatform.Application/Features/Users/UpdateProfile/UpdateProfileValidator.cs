using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Users.UpdateProfile;

/// <summary>
/// Validates the <see cref="UpdateProfileRequest"/>.
/// </summary>
public class UpdateProfileValidator : Validator<UpdateProfileRequest>
{
    /// <summary>
    /// Initializes validation rules for profile update.
    /// </summary>
    public UpdateProfileValidator()
    {
        RuleFor(x => x.FirstName)
            .NotEmpty()
            .MaximumLength(50);

        RuleFor(x => x.LastName)
            .NotEmpty()
            .MaximumLength(50);
    }
}
