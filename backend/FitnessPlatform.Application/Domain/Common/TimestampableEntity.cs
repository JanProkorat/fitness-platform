namespace FitnessPlatform.Application.Domain.Common;

/// <summary>
/// Abstraction for entities which should have date-time properties about creating and updating.
/// </summary>
public class TimestampableEntity : BaseEntity, ITimestampable
{
    /// <summary>
    /// Initializes a new instance of the <see cref="TimestampableEntity"/> class.
    /// </summary>
    protected TimestampableEntity()
    { }

    /// <inheritdoc />
    public DateTime DateCreated { get; set; }

    /// <inheritdoc />
    public DateTime? DateUpdated { get; set; }
}
