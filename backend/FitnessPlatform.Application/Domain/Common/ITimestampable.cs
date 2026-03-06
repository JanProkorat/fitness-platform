namespace FitnessPlatform.Application.Domain.Common;

/// <summary>
/// Interface for entities that track creation and update timestamps.
/// </summary>
public interface ITimestampable
{
    /// <summary>
    /// Date and time when the entity was created.
    /// </summary>
    DateTime DateCreated { get; set; }

    /// <summary>
    /// Date and time when the entity was last updated.
    /// </summary>
    DateTime? DateUpdated { get; set; }
}
