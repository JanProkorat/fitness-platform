using FastEndpoints;
using FluentValidation;

namespace FormUp.Application.Features.Trainers.GetClientVerdict;

public class GetClientVerdictValidator : Validator<GetClientVerdictRequest>
{
    public GetClientVerdictValidator()
    {
        RuleFor(x => x.ClientId).NotEmpty();
    }
}
