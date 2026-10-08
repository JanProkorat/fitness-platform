using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Users.ChangePassword;

/// <summary>
/// Validates the <see cref="ChangePasswordRequest"/>.
/// </summary>
public class ChangePasswordValidator : Validator<ChangePasswordRequest>
{
    /// <summary>
    /// Initializes validation rules for changing a password.
    /// </summary>
    public ChangePasswordValidator()
    {
        RuleFor(x => x.CurrentPassword)
            .NotEmpty();

        // Mirrors the Identity password policy configured in Program.cs
        // (digit, lowercase, uppercase, length 8), same as ResetPasswordValidator.
        RuleFor(x => x.NewPassword)
            .NotEmpty()
            .MinimumLength(8)
            .MaximumLength(100)
            .Matches("[A-Z]").WithMessage("Password must contain at least one uppercase letter.")
            .Matches("[a-z]").WithMessage("Password must contain at least one lowercase letter.")
            .Matches("[0-9]").WithMessage("Password must contain at least one digit.");

        RuleFor(x => x.ConfirmPassword)
            .NotEmpty()
            .Equal(x => x.NewPassword)
            .WithMessage("Passwords do not match.");
    }
}
