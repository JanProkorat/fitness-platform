using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Questionnaires.CreateQuestionnaire;

public class CreateQuestionnaireValidator : Validator<CreateQuestionnaireRequest>
{
    public CreateQuestionnaireValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).MaximumLength(1000);
    }
}
