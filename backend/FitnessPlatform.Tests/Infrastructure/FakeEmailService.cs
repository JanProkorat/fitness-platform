using FitnessPlatform.Application.Domain.Interfaces;

namespace FitnessPlatform.Tests.Infrastructure;

/// <summary>
/// No-op email service for integration tests. Records sent emails for assertion.
/// </summary>
/// <remarks>
/// Thread safety (#702): the anonymous resend-verification endpoint dispatches its
/// send from a background worker thread (<c>EmailDispatchWorker</c>), concurrently with
/// the test's own assertions and possibly with other tests' requests still in flight. A
/// plain <c>List&lt;T&gt;.Add</c> racing a <c>foreach</c>/<c>Where</c> enumeration on the
/// same list is undefined behavior, so every read and write below goes through a single
/// lock. Reads return a point-in-time snapshot (<c>ToArray()</c>) rather than the live
/// list, so a caller enumerating the result can never observe a concurrent mutation.
///
/// Per-instance store (#726 refinement): this used to hold its three send lists in
/// `static` fields so any test could read `FakeEmailService.SentVerifications` without
/// resolving an instance from DI. That worked as long as `EmailDispatchWorker` never
/// auto-started in a test host — with no worker running, nothing but the test's own
/// request ever wrote to the store. Once `EmailDispatchWorker` is kept running (see
/// `TestHostedServiceExtensions`) so `AnonymousResendVerificationEndpointTests` can
/// observe its fire-and-forget sends land, a *different* Testcontainers-backed
/// factory's now-zombie worker (the six factories in this suite intentionally never
/// fully dispose their host — see the #296 comment on `FitnessApiFactory`) could still
/// be draining its queue and writing into the SAME static store a completely unrelated
/// collection's tests are asserting against, corrupting counts across collections. Each
/// factory now registers this class as a per-host `AddSingleton&lt;FakeEmailService&gt;()`
/// (mirroring the existing `FakeRealtimeNotifier`/`FakePushNotificationService` pattern)
/// so every host's worker and every test resolving that host's DI container share one
/// instance — and no two hosts ever share a store.
/// </remarks>
public class FakeEmailService : IEmailService
{
    private readonly object _sync = new();

    private readonly List<(string Email, string TrainerName, string Token, string Language, string? PersonalMessage)> _invitationsSent = [];
    private readonly List<(string Email, string Token, string Language)> _passwordResetsSent = [];
    private readonly List<(string Email, string Token, string Language)> _verificationsSent = [];

    /// <summary>
    /// Snapshot of invitation emails sent during the test.
    /// </summary>
    public IReadOnlyList<(string Email, string TrainerName, string Token, string Language, string? PersonalMessage)> SentInvitations
    {
        get
        {
            lock (_sync)
            {
                return _invitationsSent.ToArray();
            }
        }
    }

    /// <summary>
    /// Snapshot of password reset emails sent during the test.
    /// </summary>
    public IReadOnlyList<(string Email, string Token, string Language)> SentPasswordResets
    {
        get
        {
            lock (_sync)
            {
                return _passwordResetsSent.ToArray();
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
    public IReadOnlyList<(string Email, string Token, string Language)> SentVerifications
    {
        get
        {
            lock (_sync)
            {
                return _verificationsSent.ToArray();
            }
        }
    }

    /// <inheritdoc />
    public Task SendInvitationEmailAsync(string toEmail, string trainerName, string invitationToken, string language, string? personalMessage, CancellationToken ct)
    {
        lock (_sync)
        {
            _invitationsSent.Add((toEmail, trainerName, invitationToken, language, personalMessage));
        }

        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task SendPasswordResetEmailAsync(string toEmail, string resetToken, string language, CancellationToken ct)
    {
        lock (_sync)
        {
            _passwordResetsSent.Add((toEmail, resetToken, language));
        }

        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task SendEmailVerificationAsync(string toEmail, string verificationToken, string language, CancellationToken ct)
    {
        lock (_sync)
        {
            _verificationsSent.Add((toEmail, verificationToken, language));
        }

        return Task.CompletedTask;
    }

    /// <summary>
    /// Clears all recorded emails.
    /// </summary>
    public void Reset()
    {
        lock (_sync)
        {
            _invitationsSent.Clear();
            _passwordResetsSent.Clear();
            _verificationsSent.Clear();
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
    ///
    /// Kept `static` even though the store itself is now per-instance: this helper never
    /// touches instance state directly — the caller's <paramref name="predicate"/> closure
    /// is what reads a specific instance's snapshot property, so there is nothing here
    /// that needs to move off the type.
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
