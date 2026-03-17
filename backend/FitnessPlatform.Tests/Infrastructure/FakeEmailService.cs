using FitnessPlatform.Application.Domain.Interfaces;

namespace FitnessPlatform.Tests.Infrastructure;

/// <summary>
/// No-op email service for integration tests. Records sent emails for assertion.
/// </summary>
public class FakeEmailService : IEmailService
{
    /// <summary>
    /// List of invitation emails sent during the test.
    /// </summary>
    public static List<(string Email, string TrainerName, string Token, string Language)> SentInvitations { get; } = [];

    /// <summary>
    /// List of password reset emails sent during the test.
    /// </summary>
    public static List<(string Email, string Token, string Language)> SentPasswordResets { get; } = [];

    /// <inheritdoc />
    public Task SendInvitationEmailAsync(string toEmail, string trainerName, string invitationToken, string language, CancellationToken ct)
    {
        SentInvitations.Add((toEmail, trainerName, invitationToken, language));
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task SendPasswordResetEmailAsync(string toEmail, string resetToken, string language, CancellationToken ct)
    {
        SentPasswordResets.Add((toEmail, resetToken, language));
        return Task.CompletedTask;
    }

    /// <summary>
    /// Clears all recorded emails.
    /// </summary>
    public static void Reset()
    {
        SentInvitations.Clear();
        SentPasswordResets.Clear();
    }
}
