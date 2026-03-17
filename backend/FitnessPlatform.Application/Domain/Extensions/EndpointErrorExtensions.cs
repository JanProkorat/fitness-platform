using FastEndpoints;
using FluentValidation.Results;

namespace FitnessPlatform.Application.Domain.Extensions;

/// <summary>
/// Extension methods for throwing endpoint errors with error codes.
/// </summary>
public static class EndpointErrorExtensions
{
    /// <summary>
    /// Adds a validation failure with an error code and throws immediately.
    /// </summary>
    /// <param name="endpoint">The endpoint instance.</param>
    /// <param name="errorCode">Machine-readable error code for frontend translation.</param>
    /// <param name="message">Human-readable fallback message.</param>
    public static void ThrowErrorWithCode(this IEndpoint endpoint, string errorCode, string message)
    {
        endpoint.ValidationFailures.Add(new ValidationFailure("", message) { ErrorCode = errorCode });
        endpoint.HttpContext.Response.StatusCode = 400;
        throw new ValidationFailureException(endpoint.ValidationFailures, message);
    }
}
