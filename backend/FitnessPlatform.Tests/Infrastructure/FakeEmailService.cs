using FitnessPlatform.Application.Domain.Interfaces;

namespace FitnessPlatform.Tests.Infrastructure;

/// <summary>
/// No-op email service for integration tests. Records sent emails for assertion.
/// </summary>
/// <remarks>
/// Thread safety (#702): the anonymous resend-verification endpoint now dispatches its
/// send from a background worker thread (<c>EmailDispatchWorker</c>), concurrently with
/// the test's own assertions and possibly with other tests' requests still in flight. A
/// plain <c>List&lt;T&gt;.Add</c> racing a <c>foreach</c>/<c>Where</c> enumeration on the
/// same list is undefined behavior, so every read and write below goes through a single
/// lock. Reads return a point-in-time snapshot (<c>ToArray()</c>) rather than the live
/// list, so a caller enumerating the result can never observe a concurrent mutation.
/// </remarks>
public class FakeEmailService : IEmailService
{
    private static readonly object Sync = new();

    private static readonly List<(string Email, string TrainerName, string Token, string Language, string? PersonalMessage)> InvitationsSent = [];
    private static readonly List<(string Email, string Token, string Language)> PasswordResetsSent = [];
    private static readonly List<(string Email, string Token, string Language)> VerificationsSent = [];

    /// <summary>
    /// Snapshot of invitation emails sent during the test.
    /// </summary>
    public static IReadOnlyList<(string Email, string TrainerName, string Token, string Language, string? PersonalMessage)> SentInvitations
    {
        get
        {
            lock (Sync)
            {
                return InvitationsSent.ToArray();
            }
        }
    }

    /// <summary>
    /// Snapshot of password reset emails sent during the test.
    /// </summary>
    public static IReadOnlyList<(string Email, string Token, string Language)> SentPasswordResets
    {
        get
        {
            lock (Sync)
            {
                return PasswordResetsSent.ToArray();
            }
        }
    }

    /// <summary>
    /// Snapshot of email verification emails sent during the test. See the type-level
    /// remarks for why this is a defensive copy rather than the live list, and
    /// <see cref="WaitForAsync"/> for the paired deterministic-drain seam that tests
    /// asserting on a background-dispatched send (#702) must use instead of a fixed
    /// sleep.
    /// </summary>
    public static IReadOnlyList<(string Email, string Token, string Language)> SentVerifications
    {
        get
        {
            lock (Sync)
            {
                return VerificationsSent.ToArray();
            }
        }
    }

    /// <inheritdoc />
    public Task SendInvitationEmailAsync(string toEmail, string trainerName, string invitationToken, string language, string? personalMessage, CancellationToken ct)
    {
        lock (Sync)
        {
            InvitationsSent.Add((toEmail, trainerName, invitationToken, language, personalMessage));
        }

        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task SendPasswordResetEmailAsync(string toEmail, string resetToken, string language, CancellationToken ct)
    {
        lock (Sync)
        {
            PasswordResetsSent.Add((toEmail, resetToken, language));
        }

        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task SendEmailVerificationAsync(string toEmail, string verificationToken, string language, CancellationToken ct)
    {
        lock (Sync)
        {
            VerificationsSent.Add((toEmail, verificationToken, language));
        }

        return Task.CompletedTask;
    }

    /// <summary>
    /// Clears all recorded emails.
    /// </summary>
    public static void Reset()
    {
        lock (Sync)
        {
            InvitationsSent.Clear();
            PasswordResetsSent.Clear();
            VerificationsSent.Clear();
        }
    }

    /// <summary>
    /// Deterministic drain/idle seam for tests asserting on a background-dispatched send
    /// (#702) — e.g. the anonymous resend-verification endpoint's fire-and-forget SMTP
    /// send, which may not have landed in <see cref="SentVerifications"/> yet by the time
    /// the HTTP response returns. Polls <paramref name="predicate"/> in short, bounded
    /// increments — never a single fixed-duration sleep — returning as soon as it is
    /// satisfied. On timeout the loop simply exits; the caller's own assertion (not this
    /// helper) is what should fail, so the test's failure message stays meaningful.
    /// </summary>
    /// <param name="predicate">Re-evaluated against live state on every poll.</param>
    /// <param name="timeout">Defaults to 5 seconds — generous for an in-process
    /// background worker, short enough to fail fast in CI if something regresses.</param>
    public static async Task WaitForAsync(Func<bool> predicate, TimeSpan? timeout = null)
    {
        var deadline = DateTime.UtcNow + (timeout ?? TimeSpan.FromSeconds(5));

        while (!predicate() && DateTime.UtcNow < deadline)
        {
            await Task.Delay(TimeSpan.FromMilliseconds(25));
        }
    }
}
