namespace FitnessPlatform.Application.Features.ClientTraining.MarkWholeDayComplete;

/// <summary>
/// Request model for marking all training sessions on a given day complete.
/// </summary>
public class MarkWholeDayCompleteRequest
{
    /// <summary>
    /// The date to mark complete (UTC date only).
    /// Defaults to today UTC when not provided.
    /// </summary>
    public DateOnly? Date { get; set; }
}
