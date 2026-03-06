using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Domain.Common;

/// <summary>
/// Abstraction for entities which should be identified outside the application
/// via a unique public GUID while also tracking creation and update timestamps.
/// </summary>
[Index(nameof(PublicId), IsUnique = true)]
public class PublicTimestampableEntity : TimestampableEntity, IPublicEntity
{
    /// <summary>
    /// Initializes a new instance of the <see cref="PublicTimestampableEntity"/> class.
    /// </summary>
    protected PublicTimestampableEntity()
    { }

    /// <inheritdoc />
    public Guid PublicId { get; set; }
}
