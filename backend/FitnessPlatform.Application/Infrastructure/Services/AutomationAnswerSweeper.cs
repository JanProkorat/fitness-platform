using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Stamps <c>AnsweredAt</c> on the runs whose request the client has since answered, which feeds the
/// answered and waiting counts of the client tab.
/// </summary>
/// <param name="db">Application database context.</param>
public sealed class AutomationAnswerSweeper(IApplicationDbContext db)
{
    /// <summary>How long after sending a run is still checked for an answer.</summary>
    public static readonly TimeSpan Horizon = TimeSpan.FromDays(90);

    /// <summary>
    /// Marks the runs of the last <see cref="Horizon"/> that the client has answered.
    /// </summary>
    /// <param name="nowUtc">The current instant.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task SweepAsync(DateTime nowUtc, CancellationToken ct)
    {
        var horizonStart = nowUtc - Horizon;

        var open = await db.AutomationRuns
            .Where(r => r.Status == AutomationRunStatus.Sent
                        && r.AnsweredAt == null
                        && r.SentAt != null
                        && r.SentAt >= horizonStart)
            .Include(r => r.AutomationRule)
            .ToListAsync(ct);

        var answered = await AutomationDeliveryTracker.GetAnsweredAtAsync(
            db,
            open.Select(r => new DeliveredRequest(r.AutomationRule.ActionType, r.DeliveredEntityId, r.SentAt, r.ClientProfileId)).ToList(),
            ct);

        for (var i = 0; i < open.Count; i++)
        {
            if (answered[i] is not null)
            {
                open[i].AnsweredAt = answered[i];
            }
        }

        await db.SaveChangesAsync(ct);
    }
}
