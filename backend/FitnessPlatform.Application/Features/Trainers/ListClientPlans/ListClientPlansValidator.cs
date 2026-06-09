using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Trainers.ListClientPlans;

public class ListClientPlansValidator : Validator<ListClientPlansRequest>
{
    public ListClientPlansValidator()
    {
        RuleFor(x => x.ClientId).NotEmpty();
    }
}
