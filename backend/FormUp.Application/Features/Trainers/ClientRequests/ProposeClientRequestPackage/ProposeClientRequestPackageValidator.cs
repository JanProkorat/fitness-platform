using FastEndpoints;
using FormUp.Application.Domain.Constants;
using FluentValidation;

namespace FormUp.Application.Features.Trainers.ClientRequests.ProposeClientRequestPackage;

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

        RuleFor(x => x.QuestionnairePublicId)
            .Null()
            .WithErrorCode(ErrorCodes.SkipOnboardingFormWithQuestionnaire)
            .WithMessage("Skipping the onboarding form cannot be combined with a questionnaire.")
            .When(x => x.SkipOnboardingForm);
    }
}
