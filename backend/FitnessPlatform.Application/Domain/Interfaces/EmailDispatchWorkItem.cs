namespace FitnessPlatform.Application.Domain.Interfaces;

/// <summary>
/// Base type for a background email-send work item (#702, #1109). Carries only
/// value-copied data — never a request-scoped service or the originating HTTP request's
/// <see cref="CancellationToken"/> — so the background worker can safely process it well
/// after the request that enqueued it has already completed.
/// </summary>
/// <remarks>
/// Concrete subtypes (<see cref="VerificationEmailWorkItem"/>,
/// <see cref="InvitationEmailWorkItem"/>) carry the fields specific to the email template
/// being sent; <c>EmailDispatchWorker</c> switches on the concrete type to pick the
/// matching <see cref="IEmailService"/> method.
/// </remarks>
/// <param name="Email">Recipient email address.</param>
/// <param name="Language">Two-letter language code (en, cs, de) for the email template.</param>
public abstract record EmailDispatchWorkItem(string Email, string Language);
