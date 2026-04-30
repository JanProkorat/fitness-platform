namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// The mode a client chooses when accepting a photo diary request.
/// </summary>
public enum PhotoDiaryMode
{
    /// <summary>
    /// Client uploads all photos at once and submits as a batch.
    /// </summary>
    Bulk = 1,

    /// <summary>
    /// Client uploads photos day-by-day over a defined window; the nutritionist
    /// sees photos as they arrive and the client finalises on day N.
    /// </summary>
    Workflow = 2,
}
