using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.ClientPayments.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.ClientPayments.GetClientPaymentSummary;

/// <summary>
/// Returns the payment summary of one of the coach's clients and creates the billing periods that are due.
/// </summary>
/// <param name="db">Application database context.</param>
/// <param name="entitlementService">Resolves subscription entitlements.</param>
/// <param name="linkAuthorizationService">Resolves the caller's live link to the client.</param>
/// <param name="timeProvider">Clock.</param>
internal sealed class GetClientPaymentSummaryEndpoint(
    IApplicationDbContext db,
    EntitlementService entitlementService,
    IClientLinkAuthorizationService linkAuthorizationService,
    TimeProvider timeProvider)
    : Endpoint<GetClientPaymentSummaryRequest, GetClientPaymentSummaryResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/payments/clients/{ClientId}/summary");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Get a client's payment summary";
            s.Description = "Returns the client's package and price, the next payment and how far they have paid. Creates the billing periods that have started, plus the next one.";
            s.Responses[StatusCodes.Status200OK] = "Payment summary";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status403Forbidden] = "The subscription does not include payments (PAYMENTS_NOT_ENTITLED)";
            s.Responses[StatusCodes.Status404NotFound] = "The caller has no professional profile or no live link to the client";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetClientPaymentSummaryRequest req, CancellationToken ct)
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
        var now = timeProvider.GetUtcNow().UtcDateTime;
        var response = new GetClientPaymentSummaryResponse
        {
            ClientId = req.ClientId,
            ClientSince = context.ClientSince,
            BankAccountSet = !string.IsNullOrEmpty(settings?.Iban) && !string.IsNullOrEmpty(settings.AccountHolder)
        };

        var assignment = await ClientPaymentGuards.FindAssignmentAsync(db, context, ct);

        if (assignment is null)
        {
            await Send.OkAsync(response, ct);
            return;
        }

        await ClientPaymentSchedule.MaterializeAsync(
            db, assignment, settings?.VariableSymbolFormat ?? VariableSymbolFormat.YearMonthClientNumber, now, ct);

        var terms = await ClientPaymentSchedule.LoadTermsAsync(db, assignment.Id, ct);
        var payments = await db.ClientPayments
            .AsNoTracking()
            .Where(p => p.ClientPaymentAssignmentId == assignment.Id)
            .ToListAsync(ct);

        Fill(response, terms, payments, ClientPaymentSchedule.Today(now));

        await Send.OkAsync(response, ct);
    }

    private static void Fill(
        GetClientPaymentSummaryResponse response,
        List<ClientPaymentTerms> terms,
        List<ClientPayment> payments,
        DateOnly today)
    {
        var recurringStarts = payments
            .Where(p => p.PeriodStart is not null)
            .Select(p => p.PeriodStart!.Value)
            .ToList();
        var recurring = payments.Where(p => p.PeriodStart is not null).OrderBy(p => p.PeriodStart).ToList();
        var nextPeriod = recurring.FirstOrDefault(p => p.PeriodStart > today);

        response.NextPeriodStart = nextPeriod?.PeriodStart;
        response.PaidCount = payments.Count(p => p.Status == ClientPaymentStatus.Paid);
        response.TotalCount = payments.Count(p =>
            p.Status == ClientPaymentStatus.Paid
            || ClientPaymentSchedule.DerivedStatus(p.Status, p.DueDate, today) == ClientPaymentStatus.Overdue);
        response.PaidUntil = recurring
            .Where(p => p.Status == ClientPaymentStatus.Paid)
            .Select(p => p.PeriodEnd ?? p.PeriodStart)
            .Max();

        var next = payments
            .Where(p => p.Status is ClientPaymentStatus.Upcoming or ClientPaymentStatus.Requested)
            .OrderBy(p => p.DueDate)
            .ThenBy(p => p.Id)
            .FirstOrDefault();

        if (next is not null)
        {
            response.NextPayment = new ClientPaymentSummaryNextDto
            {
                PaymentId = next.PublicId,
                Amount = ClientPaymentSchedule.FiguresOf(next, terms, recurringStarts).Amount,
                Currency = next.Currency,
                DueDate = next.DueDate,
                Status = ClientPaymentSchedule.DerivedStatus(next.Status, next.DueDate, today),
                RequestedAt = next.RequestedAt
            };
        }

        if (terms.Count == 0)
        {
            return;
        }

        var latest = terms[^1];

        if (latest.EndsAtUtc is not null)
        {
            return;
        }

        response.Terms = new ClientPaymentSummaryTermsDto
        {
            PackageId = latest.CoachPackage.PublicId,
            PackageName = latest.CoachPackage.Name,
            PackagePrice = latest.CoachPackage.Price,
            Currency = latest.CoachPackage.Currency,
            Billing = latest.CoachPackage.Billing,
            IntervalWeeks = latest.CoachPackage.IntervalWeeks,
            DiscountId = latest.CoachDiscount?.PublicId,
            DiscountName = latest.CoachDiscount?.Name,
            DiscountType = latest.CoachDiscount?.Type,
            DiscountValue = latest.CoachDiscount?.Value,
            CustomPrice = latest.CustomPrice,
            EffectiveFromUtc = latest.EffectiveFromUtc
        };

        var priceStart = nextPeriod?.PeriodStart ?? today;
        var breakdown = ClientPaymentSchedule.Breakdown(
            latest,
            priceStart,
            ClientPaymentSchedule.OrdinalOf(terms, recurringStarts, priceStart) + (nextPeriod is null ? 1 : 0),
            priceStart);

        response.Price = new ClientPaymentSummaryPriceDto
        {
            BasePrice = breakdown.BasePrice,
            DiscountAmount = breakdown.DiscountAmount,
            DiscountLabel = breakdown.Label,
            IsCustomPrice = breakdown.IsCustomPrice,
            Amount = breakdown.Amount
        };
    }
}
