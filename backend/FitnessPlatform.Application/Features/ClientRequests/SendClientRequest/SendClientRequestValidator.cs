using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientRequests.SendClientRequest;

/// <summary>
/// Validates the <see cref="SendClientRequestRequest"/>.
/// </summary>
public class SendClientRequestValidator : Validator<SendClientRequestRequest>
{
    /// <summary>
    /// Initializes validation rules for sending a client request.
    /// </summary>
    public SendClientRequestValidator()
    {
        RuleFor(x => x.Message)
            .MaximumLength(500);
    }
}
