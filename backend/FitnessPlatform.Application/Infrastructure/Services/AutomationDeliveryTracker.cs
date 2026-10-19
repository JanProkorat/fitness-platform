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
        switch (action)
        {
            case AutomationActionType.SendForm when deliveredEntityId is { } responseId:
                return await db.QuestionnaireResponses
                    .AsNoTracking()
                    .Where(r => r.PublicId == responseId && r.Status == QuestionnaireResponseStatus.Submitted)
                    .Select(r => r.SubmittedAt)
                    .FirstOrDefaultAsync(ct);

            case AutomationActionType.RequestProgressPhotos when deliveredEntityId is { } requestId:
                var completedAt = await db.PhotoDiaryRequests
                    .AsNoTracking()
                    .Where(r => r.Id == requestId && r.Status == PhotoDiaryStatus.Completed)
                    .Select(r => r.CompletedAt)
                    .FirstOrDefaultAsync(ct);
                return completedAt?.UtcDateTime;

            case AutomationActionType.RequestMeasurements when sentAt is { } sent:
                return await db.BodyMeasurements
                    .AsNoTracking()
                    .Where(m => m.ClientProfileId == clientProfileId && m.DateCreated >= sent)
                    .OrderBy(m => m.DateCreated)
                    .Select(m => (DateTime?)m.DateCreated)
                    .FirstOrDefaultAsync(ct);

            default:
                return null;
        }
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
