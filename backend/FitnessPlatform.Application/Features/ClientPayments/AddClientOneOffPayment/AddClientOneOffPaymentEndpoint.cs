using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Authorization;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.ClientPayments.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.ClientPayments.AddClientOneOffPayment;

/// <summary>
/// Adds a payment outside the client's package, with its own title, amount and due date.
/// </summary>
/// <param name="db">Application database context.</param>
/// <param name="entitlementService">Resolves subscription entitlements.</param>
/// <param name="linkAuthorizationService">Resolves the caller's live link to the client.</param>
/// <param name="audit">Audit logging service.</param>
/// <param name="timeProvider">Clock.</param>
[RemovedCoachRole(RemovedCoachRoleMode.Refuse)]
internal sealed class AddClientOneOffPaymentEndpoint(
    IApplicationDbContext db,
    EntitlementService entitlementService,
    IClientLinkAuthorizationService linkAuthorizationService,
    IAuditService audit,
    TimeProvider timeProvider)
    : Endpoint<AddClientOneOffPaymentRequest, ClientPaymentRowDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/payments/clients/{ClientId}/one-off");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Add a one-off payment";
            s.Description = "Adds a payment with its own title, amount and due date. It is upcoming until the coach requests it.";
            s.Response<ClientPaymentRowDto>(StatusCodes.Status201Created, "The new payment");
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid body (PAYMENT_AMOUNT_INVALID for an amount outside 0 to 9999999.99)";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status403Forbidden] = "The subscription does not include payments (PAYMENTS_NOT_ENTITLED), or the coach role was removed";
            s.Responses[StatusCodes.Status404NotFound] = "The caller has no professional profile or no live link to the client";
            s.Responses[StatusCodes.Status409Conflict] = "No client number (PAYMENT_CLIENT_NUMBER_EXHAUSTED) or variable symbol (PAYMENT_VARIABLE_SYMBOL_EXHAUSTED) is left";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(AddClientOneOffPaymentRequest req, CancellationToken ct)
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

        var settings = await db.CoachPaymentSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.ProfessionalProfileId == context.ProfessionalProfileId, ct);

        await using var transaction = await db.BeginTransactionAsync(ct);
        await db.LockProfessionalProfileAsync(context.ProfessionalProfileId, ct);

        var assignment = await ClientPaymentGuards.GetOrCreateAssignmentAsync(db, context, ct);

        if (assignment is null)
        {
            await this.SendProblemAsync(
                StatusCodes.Status409Conflict,
                ErrorCodes.PaymentClientNumberExhausted,
                "The coach has used every client number.",
                ct);
            return;
        }

        var used = await ClientPaymentSchedule.UsedVariableSymbolsAsync(db, context.ProfessionalProfileId, req.DueDate, ct);
        var variableSymbol = VariableSymbolGenerator.Generate(
            settings?.VariableSymbolFormat ?? VariableSymbolFormat.YearMonthClientNumber,
            req.DueDate,
            assignment.ClientNumber,
            used);

        if (variableSymbol is null)
        {
            await this.SendProblemAsync(
                StatusCodes.Status409Conflict,
                ErrorCodes.PaymentVariableSymbolExhausted,
                "Every variable symbol of the month is taken.",
                ct);
            return;
        }

        var payment = new ClientPayment
        {
            ClientPaymentAssignmentId = assignment.Id,
            ProfessionalProfileId = context.ProfessionalProfileId,
            Kind = ClientPaymentKind.OneOff,
            Status = ClientPaymentStatus.Upcoming,
            DueDate = req.DueDate,
            Amount = req.Amount,
            Title = req.Title.Trim(),
            VariableSymbol = variableSymbol
        };
        db.ClientPayments.Add(payment);
        await db.SaveChangesAsync(ct);

        await ClientPaymentAudit.LogAsync(
            audit,
            userId,
            ClientPaymentAudit.AddOneOff,
            assignment.PublicId,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            new
            {
                paymentId = payment.PublicId,
                period = payment.Title,
                amount = payment.Amount,
                detail = payment.DueDate.ToString("yyyy-MM-dd")
            },
            ct);

        await transaction.CommitAsync(ct);

        await Send.ResponseAsync(
            ClientPaymentRowDto.FromFrozenEntity(payment, ClientPaymentSchedule.Today(timeProvider.GetUtcNow().UtcDateTime)),
            StatusCodes.Status201Created,
            ct);
    }
}
