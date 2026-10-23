using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Finds or creates the payment relationship between a coach and a client.
/// </summary>
public static class ClientPaymentAssignments
{
    /// <summary>
    /// Loads the coach's payment relationship with the client, creating it with the next free client
    /// number when this is the first. Must run in a transaction that holds the coach's profile lock, so
    /// two clients never get the same number.
    /// </summary>
    /// <param name="db">Application database context.</param>
    /// <param name="professionalProfileId">The coach's internal id.</param>
    /// <param name="clientProfileId">The client's internal id.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The assignment, or null when the coach has used all 9999 client numbers.</returns>
    public static async Task<ClientPaymentAssignment?> GetOrCreateAsync(
        IApplicationDbContext db, long professionalProfileId, long clientProfileId, CancellationToken ct)
    {
        var existing = await db.ClientPaymentAssignments
            .FirstOrDefaultAsync(
                a => a.ProfessionalProfileId == professionalProfileId && a.ClientProfileId == clientProfileId,
                ct);

        if (existing is not null)
        {
            return existing;
        }

        var highest = await db.ClientPaymentAssignments
            .Where(a => a.ProfessionalProfileId == professionalProfileId)
            .MaxAsync(a => (int?)a.ClientNumber, ct) ?? 0;

        if (highest >= ClientPaymentSchedule.MaxClientNumber)
        {
            return null;
        }

        var created = new ClientPaymentAssignment
        {
            ProfessionalProfileId = professionalProfileId,
            ClientProfileId = clientProfileId,
            ClientNumber = highest + 1
        };
        db.ClientPaymentAssignments.Add(created);
        await db.SaveChangesAsync(ct);

        return created;
    }
}
