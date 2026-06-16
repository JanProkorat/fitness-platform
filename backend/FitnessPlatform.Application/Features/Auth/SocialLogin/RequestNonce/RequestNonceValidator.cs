using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Auth.SocialLogin.RequestNonce;

/// <summary>
/// Validator for <see cref="RequestNonceRequest"/>.
/// No body fields to validate — the endpoint is body-less.
/// </summary>
public class RequestNonceValidator : Validator<RequestNonceRequest>
{
    /// <summary>
    /// Initializes a new instance of <see cref="RequestNonceValidator"/>.
    /// </summary>
    public RequestNonceValidator()
    {
        // No body fields — nothing to validate.
    }
}
