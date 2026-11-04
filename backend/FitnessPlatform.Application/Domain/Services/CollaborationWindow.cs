using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Decides whether a questionnaire response belongs to the current collaboration of a link, so
/// answers left over from an earlier collaboration are told apart from current ones.
/// </summary>
public static class CollaborationWindow
{
    /// <summary>
    /// A submission counts by when it was submitted, an open response by when it was created. A link
    /// with no activation time predates the column, so everything on it is current.
    /// </summary>
    /// <param name="activatedAtUtc">When the current collaboration began, or null on a legacy link.</param>
    /// <param name="status">The response status.</param>
    /// <param name="submittedAt">When the response was submitted, if it was.</param>
    /// <param name="dateCreated">When the response row was created.</param>
    public static bool IsCurrent(
        DateTime? activatedAtUtc,
        QuestionnaireResponseStatus status,
        DateTime? submittedAt,
        DateTime dateCreated)
    {
        if (activatedAtUtc is null)
        {
            return true;
        }

        return status == QuestionnaireResponseStatus.Submitted
            ? submittedAt >= activatedAtUtc
            : dateCreated >= activatedAtUtc;
    }
}
