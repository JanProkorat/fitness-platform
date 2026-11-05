using FastEndpoints;
using FormUp.Application.Domain.Constants;
using FormUp.Application.Features.Users.Shared;
using FluentValidation;

namespace FormUp.Application.Features.Users.RemoveCoachRole;

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
