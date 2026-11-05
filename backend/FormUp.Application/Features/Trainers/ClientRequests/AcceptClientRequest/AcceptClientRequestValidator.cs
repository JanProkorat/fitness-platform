using FastEndpoints;
using FormUp.Application.Domain.Constants;
using FluentValidation;

namespace FormUp.Application.Features.Trainers.ClientRequests.AcceptClientRequest;

/// <summary>
/// Validates the <see cref="AcceptClientRequestRequest"/>.
/// </summary>
public class AcceptClientRequestValidator : Validator<AcceptClientRequestRequest>
{
    /// <summary>
    /// Initializes validation rules for accepting a client request.
    /// </summary>
    public AcceptClientRequestValidator()
    {
        RuleFor(x => x.QuestionnairePublicId)
            .Null()
            .WithErrorCode(ErrorCodes.SkipOnboardingFormWithQuestionnaire)
            .WithMessage("Skipping the onboarding form cannot be combined with a questionnaire.")
            .When(x => x.SkipOnboardingForm);
    }
}
