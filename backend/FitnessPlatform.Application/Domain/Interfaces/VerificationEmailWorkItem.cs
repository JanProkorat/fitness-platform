namespace FitnessPlatform.Application.Domain.Interfaces;

/// <summary>
/// Background work item for an email-verification send (#702). Dispatched by
/// <c>EmailDispatchWorker</c> to <see cref="IEmailService.SendEmailVerificationAsync"/>.
/// </summary>
/// <param name="Email">Recipient email address.</param>
/// <param name="Token">The already-persisted verification token value to send.</param>
/// <param name="Language">Two-letter language code (en, cs, de) for the email template.</param>
public sealed record VerificationEmailWorkItem(string Email, string Token, string Language)
    : EmailDispatchWorkItem(Email, Language);
