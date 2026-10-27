using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Query shapes over a client's payments shared by the endpoints that show them to the client.
/// </summary>
public static class ClientPaymentQueries
{
    /// <summary>
    /// The payments a client may see: those of their own assignments with a coach they still have a link row with.
    /// </summary>
    /// <param name="db">Application database context.</param>
    /// <param name="clientProfileId">The client's profile id.</param>
    public static IQueryable<ClientPayment> VisibleToClient(IApplicationDbContext db, long clientProfileId) =>
        db.ClientPayments
            .Where(p => p.ClientPaymentAssignment.ClientProfileId == clientProfileId
                && db.ClientProfessionalLinks.Any(l =>
                    l.ClientProfileId == clientProfileId && l.ProfessionalProfileId == p.ProfessionalProfileId));

    /// <summary>
    /// The payments a coach has asked for (stored status Requested), earliest due first.
    /// </summary>
    /// <param name="visible">A <see cref="VisibleToClient"/> query.</param>
    public static IOrderedQueryable<ClientPayment> RequestedOrdered(IQueryable<ClientPayment> visible) =>
        visible
            .Where(p => p.Status == ClientPaymentStatus.Requested)
            .OrderBy(p => p.DueDate)
            .ThenBy(p => p.Id);
}
