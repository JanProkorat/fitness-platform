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

        RuleFor(x => x.Role)
            .NotEmpty()
            .Must(r => Enum.TryParse<UserRole>(r, ignoreCase: true, out _))
            .WithMessage("Role must be one of: Admin, Trainer, Nutritionist, Client.");

        RuleFor(x => x.GdprConsent)
            .Equal(true)
            .WithMessage("GDPR consent is required to register.");
    }
}
