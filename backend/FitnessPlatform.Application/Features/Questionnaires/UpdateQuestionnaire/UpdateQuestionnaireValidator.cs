using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.Questionnaires.Shared;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Questionnaires.UpdateQuestionnaire;

public class UpdateQuestionnaireValidator : Validator<UpdateQuestionnaireRequest>
{
    public UpdateQuestionnaireValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).MaximumLength(1000);
        RuleFor(x => x.Type).IsInEnum().When(x => x.Type.HasValue);
        RuleForEach(x => x.Questions).ChildRules(q =>
        {
            q.RuleFor(x => x.Type)
                .Must(type => !string.IsNullOrEmpty(type) && QuestionTypes.All.Contains(type))
                .WithErrorCode(ErrorCodes.QuestionTypeInvalid)
                .WithMessage("Question type is required and must be supported.");
            q.RuleFor(x => x.Label).NotEmpty();
            q.RuleFor(x => x.Config)
                .Must((question, config) => QuestionConfigChecker.IsValid(question.Type, config))
                .WithErrorCode(ErrorCodes.QuestionConfigInvalid)
                .WithMessage("Question config is not valid for its type.")
                .When(x => QuestionTypes.All.Contains(x.Type));
        });
    }
}
