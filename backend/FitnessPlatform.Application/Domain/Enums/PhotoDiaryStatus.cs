namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Lifecycle status of a <see cref="FitnessPlatform.Application.Domain.Entities.PhotoDiaryRequest"/>.
/// </summary>
public enum PhotoDiaryStatus
{
    /// <summary>
    /// The request has been sent by the nutritionist and is awaiting client action.
    /// </summary>
    Pending = 1,

    /// <summary>
    /// The client has accepted the request and chosen a mode (Bulk or Workflow).
    /// </summary>
    Accepted = 2,

    /// <summary>
    /// The client dismissed the request (optionally with a reason).
    /// </summary>
    Dismissed = 3,

    /// <summary>
    /// The client is actively uploading photos (Workflow mode only; set after first upload).
    /// </summary>
    InProgress = 4,

    /// <summary>
    /// The client has submitted / finalized the diary.
    /// </summary>
    Completed = 5,
}
