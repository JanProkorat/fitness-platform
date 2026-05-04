using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Auth.Register;

/// <summary>
/// Validates the <see cref="RegisterRequest"/>.
/// </summary>
public class RegisterValidator : Validator<RegisterRequest>
{
    /// <summary>
    /// Initializes validation rules for user registration.
    /// </summary>
    public RegisterValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty()
            .EmailAddress()
            .MaximumLength(100);

        RuleFor(x => x.Password)
            .NotEmpty()
            .MinimumLength(8)
            .MaximumLength(100);

        RuleFor(x => x.ConfirmPassword)
            .NotEmpty()
            .Equal(x => x.Password)
            .WithMessage("Passwords do not match.");

        RuleFor(x => x.FirstName)
            .NotEmpty()
            .MaximumLength(50);

        RuleFor(x => x.LastName)
            .NotEmpty()
            .MaximumLength(50);

        RuleFor(x => x.Roles)
            .NotEmpty()
            .WithMessage("At least one role is required.")
            .Must(roles => !roles.Contains("Client", StringComparer.OrdinalIgnoreCase) ||
                           !roles.Any(r => string.Equals(r, "Trainer", StringComparison.OrdinalIgnoreCase) ||
                                           string.Equals(r, "Nutritionist", StringComparison.OrdinalIgnoreCase)))
            .WithMessage("Cannot combine Client role with Trainer or Nutritionist.");

        RuleForEach(x => x.Roles)
            .Must(r => Enum.TryParse<UserRole>(r, ignoreCase: true, out _))
            .WithMessage("Role must be one of: Admin, Trainer, Nutritionist, Client.");

        RuleFor(x => x.GdprConsent)
            .Equal(true)
            .WithMessage("GDPR consent is required to register.");
    }
}
