using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Authorization;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.ClientPayments.Shared;
using FitnessPlatform.Application.Infrastructure.Data;

namespace FitnessPlatform.Application.Features.ClientPayments.WaiveClientPayment;

/// <summary>
/// Waives a client's payment: nothing is owed for that period. The payment keeps its place in the schedule
/// (it still counts towards "first N payments" discounts) and releases its variable symbol.
/// </summary>
/// <param name="db">Application database context.</param>
/// <param name="entitlementService">Resolves subscription entitlements.</param>
/// <param name="linkAuthorizationService">Resolves the caller's live link to the client.</param>
/// <param name="audit">Audit logging service.</param>
/// <param name="timeProvider">Clock.</param>
[RemovedCoachRole(RemovedCoachRoleMode.Refuse)]
internal sealed class WaiveClientPaymentEndpoint(
    IApplicationDbContext db,
    EntitlementService entitlementService,
    IClientLinkAuthorizationService linkAuthorizationService,
    IAuditService audit,
    TimeProvider timeProvider)
    : Endpoint<WaiveClientPaymentRequest, ClientPaymentRowDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/payments/clients/{ClientId}/payments/{PaymentId}/waive");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Waive a payment";
            s.Description = "Waives an upcoming or requested payment: its amount becomes zero and it no longer needs paying. The body may be empty ({}).";
            s.Responses[StatusCodes.Status200OK] = "The waived payment";
            s.Responses[StatusCodes.Status400BadRequest] = "The reason is longer than 100 characters";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status403Forbidden] = "The subscription does not include payments (PAYMENTS_NOT_ENTITLED), or the coach role was removed";
            s.Responses[StatusCodes.Status404NotFound] = "No live link to the client, or the payment is not this client's payment with this coach";
            s.Responses[StatusCodes.Status409Conflict] = "The payment is already paid (PAYMENT_ALREADY_PAID) or waived (PAYMENT_ALREADY_WAIVED)";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(WaiveClientPaymentRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(AppClaims.UserId), out var userId))
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var context = await this.LoadCoachClientContextOrRespondAsync(
            db, entitlementService, linkAuthorizationService, userId, req.ClientId, ct);

        if (context is null)
        {
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

        payment.Status = ClientPaymentStatus.Waived;
        payment.Amount = 0m;
        payment.VariableSymbol = null;
        payment.WaiveReason = string.IsNullOrWhiteSpace(req.Reason) ? null : req.Reason.Trim();
        await db.SaveChangesAsync(ct);

        await ClientPaymentAudit.LogAsync(
            audit,
            userId,
            ClientPaymentAudit.Waive,
            payment.ClientPaymentAssignment.PublicId,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            new
            {
                paymentId = payment.PublicId,
                period = payment.PeriodStart is { } start ? start.ToString("yyyy-MM") : payment.Title,
                detail = payment.WaiveReason
            },
            ct);

        await transaction.CommitAsync(ct);

        await Send.OkAsync(
            ClientPaymentRowDto.FromFrozenEntity(payment, ClientPaymentSchedule.Today(timeProvider.GetUtcNow().UtcDateTime)),
            ct);
    }
}
