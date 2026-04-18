using FastEndpoints;
using FluentValidation.Results;

namespace FitnessPlatform.Application.Domain.Extensions;

/// <summary>
/// Extension methods for throwing endpoint errors with error codes.
/// </summary>
public static class EndpointErrorExtensions
{
    /// <summary>
    /// Adds a validation failure with an error code and throws immediately (returns HTTP 400).
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

    /// <summary>
    /// Writes an RFC 7807 Problem Details response with the given HTTP status code and error code.
    /// Does NOT throw — the caller must return after this call.
    /// </summary>
    /// <param name="endpoint">The endpoint instance.</param>
    /// <param name="statusCode">HTTP status code (e.g. 404, 409).</param>
    /// <param name="errorCode">Machine-readable error code.</param>
    /// <param name="detail">Human-readable explanation.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task SendProblemAsync(
        this IEndpoint endpoint,
        int statusCode,
        string errorCode,
        string detail,
        CancellationToken ct = default)
    {
        var problem = new Microsoft.AspNetCore.Mvc.ProblemDetails
        {
            Status = statusCode,
            Title = detail,
            Type = "https://tools.ietf.org/html/rfc7807",
            Instance = endpoint.HttpContext.Request.Path,
            Extensions = { ["errorCode"] = errorCode }
        };

        endpoint.HttpContext.Response.StatusCode = statusCode;
        endpoint.HttpContext.Response.ContentType = "application/problem+json";
        await endpoint.HttpContext.Response.WriteAsJsonAsync(problem, ct);
    }
}
