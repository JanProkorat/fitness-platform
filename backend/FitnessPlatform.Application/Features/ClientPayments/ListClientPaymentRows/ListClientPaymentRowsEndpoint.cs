using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.ClientPayments.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.ClientPayments.ListClientPaymentRows;

/// <summary>
/// Lists the payments of one of the coach's clients and creates the billing periods that are due.
/// </summary>
/// <param name="db">Application database context.</param>
/// <param name="entitlementService">Resolves subscription entitlements.</param>
/// <param name="linkAuthorizationService">Resolves the caller's live link to the client.</param>
/// <param name="timeProvider">Clock.</param>
internal sealed class ListClientPaymentRowsEndpoint(
    IApplicationDbContext db,
    EntitlementService entitlementService,
    IClientLinkAuthorizationService linkAuthorizationService,
    TimeProvider timeProvider)
    : Endpoint<ListClientPaymentRowsRequest, ListClientPaymentRowsResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/payments/clients/{ClientId}/payments");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "List a client's payments";
            s.Description = "Lists the client's payments, newest due date first. An upcoming payment shows the amount the client's terms give now; a payment past its due date is reported as overdue.";
            s.Responses[StatusCodes.Status200OK] = "The client's payments";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status403Forbidden] = "The subscription does not include payments (PAYMENTS_NOT_ENTITLED)";
            s.Responses[StatusCodes.Status404NotFound] = "The caller has no professional profile, or no live link to the client and no ended one with a payment assignment";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(ListClientPaymentRowsRequest req, CancellationToken ct)
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

        var assignment = await ClientPaymentGuards.FindAssignmentAsync(db, context, ct);

        if (assignment is null)
        {
            await Send.OkAsync(new ListClientPaymentRowsResponse(), ct);
            return;
        }

        var settings = await db.CoachPaymentSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.ProfessionalProfileId == context.ProfessionalProfileId, ct);
        var now = timeProvider.GetUtcNow().UtcDateTime;

        await ClientPaymentSchedule.MaterializeAsync(
            db, assignment, settings?.VariableSymbolFormat ?? VariableSymbolFormat.YearMonthClientNumber, now, ct);

        var terms = await ClientPaymentSchedule.LoadTermsAsync(db, assignment.Id, ct);
        var payments = await db.ClientPayments
            .AsNoTracking()
            .Where(p => p.ClientPaymentAssignmentId == assignment.Id)
            .ToListAsync(ct);

        await Send.OkAsync(
            new ListClientPaymentRowsResponse
            {
                Payments = ClientPaymentRows.Build(
                    payments,
                    terms,
                    settings?.MessageFormat ?? PaymentMessageFormat.PackageNameAndMonth,
                    context,
                    ClientPaymentSchedule.Today(now))
            },
            ct);
    }
}
