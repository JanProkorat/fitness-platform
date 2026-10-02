namespace FitnessPlatform.Application.Features.Messaging.Shared;

/// <summary>Computes the initials fallback shown on a participant's avatar badge.</summary>
public static class ParticipantInitials
{
    /// <summary>
    /// Two-letter initials from the names; empty names (e.g. Apple Sign-In users who declined to
    /// share one) fall back to the email's first character, then to "?".
    /// </summary>
    public static string Compute(string? firstName, string? lastName, string? email)
    {
        var firstInitial = string.IsNullOrEmpty(firstName) ? "" : firstName[..1];
        var lastInitial = string.IsNullOrEmpty(lastName) ? "" : lastName[..1];
        var initials = (firstInitial + lastInitial).ToUpper();

        if (!string.IsNullOrEmpty(initials))
        {
            return initials;
        }

        if (!string.IsNullOrEmpty(email))
        {
            return email[..1].ToUpper();
        }

        return "?";
    }
}
