using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Domain.Common;

/// <summary>
/// Base entity which should be derived from every entity in the module.
/// </summary>
[PrimaryKey(nameof(Id))]
public class BaseEntity
{
    /// <summary>
    /// Initializes a new instance of the <see cref="BaseEntity"/> class.
    /// </summary>
    protected BaseEntity()
    { }

    /// <summary>
    /// Primary key ID used internally only.
    /// </summary>
    public long Id { get; set; }
}
