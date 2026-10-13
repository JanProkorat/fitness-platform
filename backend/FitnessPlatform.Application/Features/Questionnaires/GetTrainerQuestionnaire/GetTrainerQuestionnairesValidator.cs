using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Questionnaires.GetTrainerQuestionnaire;

public class GetTrainerQuestionnairesValidator : Validator<GetTrainerQuestionnairesRequest>
{
    public GetTrainerQuestionnairesValidator()
    {
        RuleFor(x => x.Type).IsInEnum().When(x => x.Type.HasValue);
        RuleFor(x => x.Search).MaximumLength(200);
    }
}
