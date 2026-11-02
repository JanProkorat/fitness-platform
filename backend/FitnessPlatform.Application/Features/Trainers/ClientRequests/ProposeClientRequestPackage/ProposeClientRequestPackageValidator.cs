using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Trainers.ClientRequests.ProposeClientRequestPackage;

/// <summary>
/// Validates the <see cref="ProposeClientRequestPackageRequest"/>.
/// </summary>
public class ProposeClientRequestPackageValidator : Validator<ProposeClientRequestPackageRequest>
{
    /// <summary>
    /// Initializes validation rules for proposing a package.
    /// </summary>
    public ProposeClientRequestPackageValidator()
    {
        RuleFor(x => x.PackagePublicId)
            .NotEmpty();

        RuleFor(x => x.Statement)
            .MaximumLength(1000);
    }
}
