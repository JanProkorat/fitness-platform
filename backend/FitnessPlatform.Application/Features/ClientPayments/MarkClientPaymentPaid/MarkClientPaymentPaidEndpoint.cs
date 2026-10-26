using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Authorization;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.ClientPayments.Shared;
using FitnessPlatform.Application.Infrastructure.Data;

namespace FitnessPlatform.Application.Features.ClientPayments.MarkClientPaymentPaid;

/// <summary>
/// Confirms that the money for a client's payment arrived.
/// </summary>
/// <param name="db">Application database context.</param>
/// <param name="entitlementService">Resolves subscription entitlements.</param>
/// <param name="linkAuthorizationService">Resolves the caller's live link to the client.</param>
/// <param name="audit">Audit logging service.</param>
/// <param name="timeProvider">Clock.</param>
[RemovedCoachRole(RemovedCoachRoleMode.Refuse)]
internal sealed class MarkClientPaymentPaidEndpoint(
    IApplicationDbContext db,
    EntitlementService entitlementService,
    IClientLinkAuthorizationService linkAuthorizationService,
    IAuditService audit,
    TimeProvider timeProvider)
    : Endpoint<MarkClientPaymentPaidRequest, ClientPaymentRowDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/payments/clients/{ClientId}/payments/{PaymentId}/mark-paid");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Mark a payment paid";
            s.Description = "Confirms the money arrived. An upcoming payment keeps the amount its terms give now. The body may be empty ({}); the paid-on date defaults to today.";
            s.Responses[StatusCodes.Status200OK] = "The paid payment";
            s.Responses[StatusCodes.Status400BadRequest] = "The paid-on date is in the future (PAYMENT_PAID_ON_IN_FUTURE)";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status403Forbidden] = "The subscription does not include payments (PAYMENTS_NOT_ENTITLED), or the coach role was removed";
            s.Responses[StatusCodes.Status404NotFound] = "No live link to the client (and no ended one with a payment assignment), or the payment is not this client's payment with this coach";
            s.Responses[StatusCodes.Status409Conflict] = "The payment is already paid (PAYMENT_ALREADY_PAID) or waived (PAYMENT_ALREADY_WAIVED)";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(MarkClientPaymentPaidRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(AppClaims.UserId), out var userId))
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var context = await this.LoadCoachClientContextOrRespondAsync(
            db, entitlementService, linkAuthorizationService, userId, req.ClientId, ct, allowEnded: true);

        if (context is null)
        {
            return;
        }

        var today = ClientPaymentSchedule.Today(timeProvider.GetUtcNow().UtcDateTime);

        if (req.PaidOn > today)
        {
            this.ThrowErrorWithCode(ErrorCodes.PaymentPaidOnInFuture, "The payment cannot have been paid in the future.");
            return;
        }

        await using var transaction = await db.BeginTransactionAsync(ct);
        await db.LockProfessionalProfileAsync(context.ProfessionalProfileId, ct);

        var payment = await this.LoadPaymentOrRespondAsync(db, context, req.PaymentId, ct);

        if (payment is null || await this.RespondIfSettledAsync(payment, ct))
        {
            return;
        }

        await ClientPaymentGuards.FreezeFiguresAsync(db, payment, ct);

        payment.Status = ClientPaymentStatus.Paid;
        payment.PaidOn = req.PaidOn ?? today;
        await db.SaveChangesAsync(ct);

        await ClientPaymentAudit.LogAsync(
            audit,
            userId,
            ClientPaymentAudit.MarkPaid,
            payment.ClientPaymentAssignment.PublicId,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            new
            {
                paymentId = payment.PublicId,
                period = payment.PeriodStart is { } start ? start.ToString("yyyy-MM") : payment.Title,
                amount = payment.Amount,
                currency = payment.Currency.ToString(),
                detail = payment.PaidOn?.ToString("yyyy-MM-dd")
            },
            ct);

        await transaction.CommitAsync(ct);

        await Send.OkAsync(ClientPaymentRowDto.FromFrozenEntity(payment, today), ct);
    }
}
