using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Questionnaires.UpdateQuestionnaire;

public class UpdateQuestionnaireValidator : Validator<UpdateQuestionnaireRequest>
{
    public UpdateQuestionnaireValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).MaximumLength(1000);
        RuleForEach(x => x.Questions).ChildRules(q =>
        {
            q.RuleFor(x => x.Type).NotEmpty();
            q.RuleFor(x => x.Label).NotEmpty();
        });
    }
}
