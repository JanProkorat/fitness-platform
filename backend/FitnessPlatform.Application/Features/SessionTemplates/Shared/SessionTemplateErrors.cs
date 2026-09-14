using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Extensions;

namespace FitnessPlatform.Application.Features.SessionTemplates.Shared;

/// <summary>
/// The session-template library's single pinned <see cref="LibraryDenial"/> instance — every
/// endpoint in this feature reuses this same value rather than constructing its own, per
/// <see cref="LibraryDenial"/>'s own remarks.
/// </summary>
internal static class SessionTemplateErrors
{
    /// <summary>
    /// The session-template library's 404/403/409 denial strings.
    /// </summary>
    internal static readonly LibraryDenial Denial = new(
        ErrorCodes.SessionTemplateNotFound,
        "Session template not found.",
        ErrorCodes.SessionTemplateNotOwned,
        "Session template belongs to another owner.",
        ErrorCodes.SessionTemplateVersionConflict,
        "Session template was modified by another request.");
}
