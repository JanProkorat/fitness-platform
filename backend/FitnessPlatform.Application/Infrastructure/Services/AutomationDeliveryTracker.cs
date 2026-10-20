using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Reads what became of a request an automation delivered: whether the client answered it and
/// whether it is still open, per action type.
/// </summary>
public static class AutomationDeliveryTracker
{
    /// <summary>
    /// When the client answered the delivered request, or null while it is unanswered. A form is
    /// answered when its response is submitted, a photo request when it is completed, and a
    /// measurement request when the client next logs a measurement.
    /// </summary>
    /// <param name="db">Application database context.</param>
    /// <param name="action">What the rule asked of the client.</param>
    /// <param name="deliveredEntityId">Public id of what the run delivered.</param>
    /// <param name="sentAt">When the request was sent (UTC).</param>
    /// <param name="clientProfileId">Internal id of the client profile.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<DateTime?> GetAnsweredAtAsync(
        IApplicationDbContext db,
        AutomationActionType action,
        Guid? deliveredEntityId,
        DateTime? sentAt,
        long clientProfileId,
        CancellationToken ct)
    {
        var answered = await GetAnsweredAtAsync(
            db, [new DeliveredRequest(action, deliveredEntityId, sentAt, clientProfileId)], ct);

        return answered[0];
    }

    /// <summary>
    /// Batch form of <see cref="GetAnsweredAtAsync(IApplicationDbContext, AutomationActionType, Guid?, DateTime?, long, CancellationToken)"/>:
    /// one query per action type however many requests are given. The single-run overload delegates
    /// here, so both paths share one definition of "answered".
    /// </summary>
    /// <param name="db">Application database context.</param>
    /// <param name="requests">The delivered requests to look up.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The answer time of each request, in the order given; null while unanswered.</returns>
    public static async Task<DateTime?[]> GetAnsweredAtAsync(
        IApplicationDbContext db,
        IReadOnlyList<DeliveredRequest> requests,
        CancellationToken ct)
    {
        var answered = new DateTime?[requests.Count];

        var responseIds = requests
            .Where(r => r.Action == AutomationActionType.SendForm && r.DeliveredEntityId is not null)
            .Select(r => r.DeliveredEntityId!.Value)
            .Distinct()
            .ToList();

        var submittedAt = new Dictionary<Guid, DateTime?>();

        if (responseIds.Count > 0)
        {
            var submitted = await db.QuestionnaireResponses
                .AsNoTracking()
                .Where(r => responseIds.Contains(r.PublicId) && r.Status == QuestionnaireResponseStatus.Submitted)
                .Select(r => new { r.PublicId, r.SubmittedAt })
                .ToListAsync(ct);
            submittedAt = submitted.ToDictionary(r => r.PublicId, r => r.SubmittedAt);
        }

        var photoRequestIds = requests
            .Where(r => r.Action == AutomationActionType.RequestProgressPhotos && r.DeliveredEntityId is not null)
            .Select(r => r.DeliveredEntityId!.Value)
            .Distinct()
            .ToList();

        var completedAt = new Dictionary<Guid, DateTime?>();

        if (photoRequestIds.Count > 0)
        {
            var completed = await db.PhotoDiaryRequests
                .AsNoTracking()
                .Where(r => photoRequestIds.Contains(r.Id) && r.Status == PhotoDiaryStatus.Completed)
                .Select(r => new { r.Id, r.CompletedAt })
                .ToListAsync(ct);
            completedAt = completed.ToDictionary(r => r.Id, r => r.CompletedAt?.UtcDateTime);
        }

        var measurementRequests = requests
            .Where(r => r.Action == AutomationActionType.RequestMeasurements && r.SentAt is not null)
            .ToList();

        var measurementsByClient = await LoadMeasurementTimesAsync(db, measurementRequests, ct);

        for (var i = 0; i < requests.Count; i++)
        {
            var request = requests[i];

            answered[i] = request switch
            {
                { Action: AutomationActionType.SendForm, DeliveredEntityId: { } id } =>
                    submittedAt.GetValueOrDefault(id),
                { Action: AutomationActionType.RequestProgressPhotos, DeliveredEntityId: { } id } =>
                    completedAt.GetValueOrDefault(id),
                { Action: AutomationActionType.RequestMeasurements, SentAt: { } sent } =>
                    FirstAtOrAfter(measurementsByClient[request.ClientProfileId], sent),
                _ => null,
            };
        }

        return answered;
    }

    private static async Task<ILookup<long, DateTime>> LoadMeasurementTimesAsync(
        IApplicationDbContext db, List<DeliveredRequest> measurementRequests, CancellationToken ct)
    {
        if (measurementRequests.Count == 0)
        {
            return Array.Empty<long>().ToLookup(id => id, _ => DateTime.MinValue);
        }

        var clientIds = measurementRequests.Select(r => r.ClientProfileId).Distinct().ToList();
        var earliestSent = measurementRequests.Min(r => r.SentAt!.Value);

        var rows = await db.BodyMeasurements
            .AsNoTracking()
            .Where(m => clientIds.Contains(m.ClientProfileId) && m.DateCreated >= earliestSent)
            .Select(m => new { m.ClientProfileId, m.DateCreated })
            .ToListAsync(ct);

        return rows.ToLookup(m => m.ClientProfileId, m => m.DateCreated);
    }

    /// <summary>A measurement request is answered by the first measurement logged at or after it was sent.</summary>
    private static DateTime? FirstAtOrAfter(IEnumerable<DateTime> measurementTimes, DateTime sentAt)
    {
        DateTime? first = null;

        foreach (var logged in measurementTimes)
        {
            if (logged >= sentAt && (first is null || logged < first))
            {
                first = logged;
            }
        }

        return first;
    }

    /// <summary>
    /// Whether the delivered request can still be answered: a form that is pending or in progress,
    /// a photo request inside its window, or a measurement request with no measurement logged since.
    /// </summary>
    /// <param name="db">Application database context.</param>
    /// <param name="action">What the rule asked of the client.</param>
    /// <param name="deliveredEntityId">Public id of what the run delivered.</param>
    /// <param name="sentAt">When the request was sent (UTC).</param>
    /// <param name="clientProfileId">Internal id of the client profile.</param>
    /// <param name="nowUtc">The current instant.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<bool> IsOpenAsync(
        IApplicationDbContext db,
        AutomationActionType action,
        Guid? deliveredEntityId,
        DateTime? sentAt,
        long clientProfileId,
        DateTime nowUtc,
        CancellationToken ct)
    {
        switch (action)
        {
            case AutomationActionType.SendForm when deliveredEntityId is { } responseId:
                return await db.QuestionnaireResponses
                    .AsNoTracking()
                    .AnyAsync(r => r.PublicId == responseId
                        && (r.Status == QuestionnaireResponseStatus.Pending
                            || r.Status == QuestionnaireResponseStatus.InProgress), ct);

            case AutomationActionType.RequestProgressPhotos when deliveredEntityId is { } requestId:
                var request = await db.PhotoDiaryRequests
                    .AsNoTracking()
                    .FirstOrDefaultAsync(r => r.Id == requestId, ct);
                return request is not null && request.IsOpenAt(new DateTimeOffset(DateTime.SpecifyKind(nowUtc, DateTimeKind.Utc)));

            case AutomationActionType.RequestMeasurements:
                return await GetAnsweredAtAsync(db, action, deliveredEntityId, sentAt, clientProfileId, ct) is null;

            default:
                return false;
        }
    }
}
