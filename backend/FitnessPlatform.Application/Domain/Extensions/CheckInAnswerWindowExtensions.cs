using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Extensions;

/// <summary>
/// The rule that a check-in can no longer be answered once its answer window has passed.
/// </summary>
public static class CheckInAnswerWindowExtensions
{
    /// <summary>Whether the response is an unsubmitted check-in past its due time.</summary>
    /// <param name="response">The response.</param>
    /// <param name="nowUtc">The current instant.</param>
    public static bool IsAnswerWindowClosed(this QuestionnaireResponse response, DateTime nowUtc) =>
        response.Kind == QuestionnaireResponseKind.CheckIn
        && response.Status != QuestionnaireResponseStatus.Submitted
        && response.CheckInDueAtUtc is { } dueAt
        && dueAt < nowUtc;

    /// <summary>
    /// Answers a coded 409 and returns true when the response is a check-in past its answer window.
    /// </summary>
    /// <param name="endpoint">The endpoint instance.</param>
    /// <param name="response">The response.</param>
    /// <param name="nowUtc">The current instant.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<bool> RespondIfCheckInWindowClosedAsync(
        this IEndpoint endpoint, QuestionnaireResponse response, DateTime nowUtc, CancellationToken ct)
    {
        if (!response.IsAnswerWindowClosed(nowUtc))
        {
            return false;
        }

        await endpoint.SendProblemAsync(
            StatusCodes.Status409Conflict,
            ErrorCodes.CheckInAnswerWindowClosed,
            "The answer window of this check-in has closed.",
            ct);
        return true;
    }
}
