using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Questionnaires.UpdateResponse;

public class UpdateResponseValidator : Validator<UpdateResponseRequest>
{
    public UpdateResponseValidator()
    {
        RuleFor(x => x.ResponsePublicId).NotEmpty();
        RuleFor(x => x.Answers).NotNull();
        RuleForEach(x => x.Answers).ChildRules(a =>
        {
            a.RuleFor(x => x.QuestionPublicId).NotEmpty();
        });
    }
}
