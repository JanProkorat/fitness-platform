using System.Text.Json;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.PaymentSettings.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.PaymentSettings.UndoBankAccountChange;

/// <summary>
/// Restores the previous bank account from the link emailed after a change. The token is the
/// credential, so the route is anonymous: the person who lost the account may not be signed in.
/// </summary>
/// <param name="db">Application database context.</param>
/// <param name="audit">Audit logging service.</param>
/// <param name="timeProvider">Clock.</param>
internal sealed class UndoBankAccountChangeEndpoint(
    IApplicationDbContext db,
    IAuditService audit,
    TimeProvider timeProvider)
    : Endpoint<UndoBankAccountChangeRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/payments/bank-account/undo");
        AllowAnonymous();
        Options(x => x.RequireRateLimiting(AppPolicies.AuthRateLimit));
        Summary(s =>
        {
            s.Summary = "Undo a bank account change";
            s.Description = "Anonymous: the single-use token from the emailed link is the credential. Restores the previous IBAN and account holder if the account has not been changed again since.";
            s.Responses[StatusCodes.Status204NoContent] = "Previous bank account restored";
            s.Responses[StatusCodes.Status400BadRequest] = "Unknown, expired or already used token (BANK_ACCOUNT_UNDO_INVALID)";
            s.Responses[StatusCodes.Status409Conflict] = "The account was changed again afterwards (BANK_ACCOUNT_UNDO_SUPERSEDED)";
            s.Responses[StatusCodes.Status429TooManyRequests] = "Rate limit exceeded";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UndoBankAccountChangeRequest req, CancellationToken ct)
    {
        var now = timeProvider.GetUtcNow().UtcDateTime;
        var tokenHash = PaymentSecrets.HashToken(req.Token);

        await using var transaction = await db.BeginTransactionAsync(ct);

        var change = await db.CoachBankAccountChanges
            .FirstOrDefaultAsync(c => c.UndoTokenHash == tokenHash && c.UndoneAt == null && c.UndoExpiresAt > now, ct);

        if (change is null)
        {
            this.ThrowErrorWithCode(ErrorCodes.BankAccountUndoInvalid, "The undo link is invalid, expired or already used.");
            return;
        }

        var settings = await db.CoachPaymentSettings
            .FirstOrDefaultAsync(s => s.ProfessionalProfileId == change.ProfessionalProfileId, ct);

        if (settings is null || settings.Iban != change.NewIban)
        {
            await this.SendProblemAsync(
                StatusCodes.Status409Conflict,
                ErrorCodes.BankAccountUndoSuperseded,
                "The bank account was changed again after this change, so it cannot be undone.",
                ct);
            return;
        }

        var claimed = await db.CoachBankAccountChanges
            .Where(c => c.Id == change.Id && c.UndoneAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.UndoneAt, now), ct);

        if (claimed == 0)
        {
            this.ThrowErrorWithCode(ErrorCodes.BankAccountUndoInvalid, "The undo link is invalid, expired or already used.");
            return;
        }

        settings.Iban = change.PreviousIban;
        settings.AccountHolder = change.PreviousAccountHolder;
        settings.BankAccountChangedAt = now;

        await db.SaveChangesAsync(ct);

        await audit.LogAsync(
            null,
            "UndoBankAccountChange",
            nameof(CoachPaymentSettings),
            settings.PublicId,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            JsonSerializer.Serialize(new { iban = IbanValidator.Mask(change.NewIban) }),
            JsonSerializer.Serialize(new { iban = IbanValidator.Mask(change.PreviousIban!) }),
            ct);

        await transaction.CommitAsync(ct);

        await Send.NoContentAsync(ct);
    }
}
