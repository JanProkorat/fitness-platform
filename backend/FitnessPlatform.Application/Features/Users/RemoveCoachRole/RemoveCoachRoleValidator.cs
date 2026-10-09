using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.Users.Shared;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Users.RemoveCoachRole;

/// <summary>
/// Validates the <see cref="RemoveCoachRoleRequest"/>, allowing only Trainer or Nutritionist.
/// </summary>
public class RemoveCoachRoleValidator : Validator<RemoveCoachRoleRequest>
{
    /// <summary>
    /// Initializes validation rules for removing a coach role.
    /// </summary>
    public RemoveCoachRoleValidator()
    {
        RuleFor(x => x.Role)
            .NotEmpty()
            .Must(SelfAssignableRoles.Contains)
            .WithMessage($"Role must be '{AppRoles.Trainer}' or '{AppRoles.Nutritionist}'.");
    }
}
