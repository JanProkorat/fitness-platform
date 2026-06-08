using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Trainers.GetClientVerdict;

public class GetClientVerdictValidator : Validator<GetClientVerdictRequest>
{
    public GetClientVerdictValidator()
    {
        RuleFor(x => x.ClientId).NotEmpty();
    }
}
