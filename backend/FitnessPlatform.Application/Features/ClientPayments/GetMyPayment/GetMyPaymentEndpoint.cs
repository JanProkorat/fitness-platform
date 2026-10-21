using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.ClientPayments.GetMyPayment;

/// <summary>
/// Returns one of the calling client's own payments that a coach asked for or that is paid. A payment of
/// another client, an upcoming or waived one, or one of a coach the client is no longer linked with is a 404.
/// </summary>
/// <param name="db">Application database context.</param>
/// <param name="timeProvider">Clock.</param>
internal sealed class GetMyPaymentEndpoint(IApplicationDbContext db, TimeProvider timeProvider)
    : Endpoint<GetMyPaymentRequest, GetMyPaymentResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/client/payments/{PaymentId}");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get one of my payments";
            s.Description = "Returns a requested or paid payment of the client, with the coach's bank details and the QR payload while it is unpaid.";
            s.Responses[StatusCodes.Status200OK] = "The payment";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status404NotFound] = "The payment is not the caller's, is not requested or paid, or its coach is no longer linked";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetMyPaymentRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(AppClaims.UserId), out var userId))
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var clientProfileId = await db.ClientProfiles
            .AsNoTracking()
            .Where(c => c.UserId == userId)
            .Select(c => (long?)c.Id)
            .FirstOrDefaultAsync(ct);

        var payment = clientProfileId is null
            ? null
            : await db.ClientPayments
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    p => p.PublicId == req.PaymentId
                        && p.ClientPaymentAssignment.ClientProfileId == clientProfileId
                        && (p.Status == ClientPaymentStatus.Requested || p.Status == ClientPaymentStatus.Paid)
                        && db.ClientProfessionalLinks.Any(l =>
                            l.ClientProfileId == clientProfileId && l.ProfessionalProfileId == p.ProfessionalProfileId && l.IsActive),
                    ct);

        if (payment is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var coach = await db.ProfessionalProfiles
            .AsNoTracking()
            .Where(c => c.Id == payment.ProfessionalProfileId)
            .Select(c => new { c.User.FirstName, c.User.LastName })
            .FirstAsync(ct);

        await Send.OkAsync(
            GetMyPaymentResponse.FromEntity(
                payment,
                $"{coach.FirstName} {coach.LastName}".Trim(),
                ClientPaymentSchedule.Today(timeProvider.GetUtcNow().UtcDateTime)),
            ct);
    }
}
