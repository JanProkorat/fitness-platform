using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;

namespace FitnessPlatform.Application.Features.Users.AddRole;

/// <summary>
/// Validates the <see cref="AddRoleRequest"/>, ensuring only Trainer or Nutritionist roles can be added.
/// </summary>
public class AddRoleValidator : Validator<AddRoleRequest>
{
    /// <summary>
    /// Initializes validation rules for adding a role.
    /// </summary>
    public AddRoleValidator()
    {
        RuleFor(x => x.Role)
            .NotEmpty()
            .Must(SelfAssignableRoles.Contains)
            .WithMessage($"Role must be '{AppRoles.Trainer}' or '{AppRoles.Nutritionist}'.");
    }
}
