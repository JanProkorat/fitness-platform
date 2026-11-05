using System.Linq.Expressions;
using FormUp.Application.Domain.Entities;
using FormUp.Application.Domain.Enums;
using FormUp.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FormUp.Application.Domain.Services;

/// <summary>
/// Decides which uploaded photos are free-form progress photos and opens or extends the grouped-email burst for
/// each coach who can see one. Shared by both finalize endpoints and by the processor that counts a burst.
/// </summary>
public static class ProgressPhotoBurst
{
    /// <summary>
    /// A free-form progress photo: Body or FreeForm and not an answer to a coach's request. Food and Training
    /// photos belong to a plan's meal or session, and request answers notify through their own submit.
    /// </summary>
    public static readonly Expression<Func<PlanPhoto, bool>> IsFreeFormProgressPhoto = photo =>
        (photo.Category == PlanPhotoCategory.Body || photo.Category == PlanPhotoCategory.FreeForm)
        && photo.DiaryRequestId == null;

    /// <summary>
    /// Whether a photo starts or joins a burst.
    /// </summary>
    /// <param name="photo">The photo.</param>
    public static bool Qualifies(PlanPhoto photo) =>
        (photo.Category is PlanPhotoCategory.Body or PlanPhotoCategory.FreeForm) && photo.DiaryRequestId is null;

    /// <summary>
    /// Opens or extends the burst of every coach holding a viewer row for the saved photo. Best-effort: the photo
    /// is already committed, so a failure is logged with ids only and never thrown.
    /// </summary>
    /// <param name="db">Relational database context.</param>
    /// <param name="logger">Logger. Receives ids only.</param>
    /// <param name="photo">The saved photo, with its internal id assigned.</param>
    /// <param name="clientProfilePublicId">Public id of the client's profile; the burst is grouped by it.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task QueueAsync(
        IApplicationDbContext db,
        ILogger logger,
        PlanPhoto photo,
        Guid clientProfilePublicId,
        CancellationToken ct)
    {
        if (!Qualifies(photo))
        {
            return;
        }

        try
        {
            var recipients = await db.PlanPhotoViewers
                .AsNoTracking()
                .Where(viewer => viewer.PlanPhotoId == photo.Id)
                .Select(viewer => viewer.ProfessionalUserId)
                .Distinct()
                .ToListAsync(ct);

            foreach (var recipientUserId in recipients)
            {
                await db.UpsertPendingNotificationEmailAsync(
                    recipientUserId,
                    NotificationEvent.ProgressPhotosSubmitted,
                    clientProfilePublicId,
                    photo.DateCreated,
                    ct);
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex,
                "Failed to queue the grouped progress-photo email for photo {PhotoId} of client profile {ClientProfileId}",
                photo.PublicId, clientProfilePublicId);
        }
    }
}
