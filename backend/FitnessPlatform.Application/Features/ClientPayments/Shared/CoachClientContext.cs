namespace FitnessPlatform.Application.Features.ClientPayments.Shared;

/// <summary>
/// What a coach-facing payments endpoint needs about the coach and the client once the caller's
/// entitlement and live link are proven.
/// </summary>
/// <param name="ProfessionalProfileId">The coach's internal profile id.</param>
/// <param name="CoachUserId">The coach's user id.</param>
/// <param name="CoachName">The coach's display name.</param>
/// <param name="ClientProfileId">The client's internal profile id.</param>
/// <param name="ClientUserId">The client's user id.</param>
/// <param name="ClientFirstName">The client's first name.</param>
/// <param name="ClientLastName">The client's last name.</param>
/// <param name="ClientEmail">The client's email address, when the account has one.</param>
/// <param name="ClientLanguage">The client's UI language, when known.</param>
/// <param name="ClientSince">When the coach and the client first linked (UTC).</param>
/// <param name="CollaborationEnded">Whether the link has ended; only the ended-allowed endpoints ever see true.</param>
internal sealed record CoachClientContext(
    long ProfessionalProfileId,
    Guid CoachUserId,
    string CoachName,
    long ClientProfileId,
    Guid ClientUserId,
    string ClientFirstName,
    string ClientLastName,
    string? ClientEmail,
    string? ClientLanguage,
    DateTime ClientSince,
    bool CollaborationEnded = false);
