using FitnessPlatform.Application.Domain.Common;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// Grants one coach read access to one <see cref="PlanPhoto"/>. Rows are written when the photo
/// is uploaded and never recomputed, so a coach who links later does not see older photos.
/// </summary>
public class PlanPhotoViewer : TimestampableEntity
{
    /// <summary>
    /// Internal ID of the photo this row grants access to.
    /// </summary>
    public long PlanPhotoId { get; set; }

    /// <summary>
    /// The <c>ApplicationUser.Id</c> of the coach who may see the photo.
    /// </summary>
    public Guid ProfessionalUserId { get; set; }

    /// <summary>
    /// Navigation property to the photo.
    /// </summary>
    public PlanPhoto PlanPhoto { get; set; } = null!;

    /// <summary>
    /// Navigation property to the coach.
    /// </summary>
    public ApplicationUser ProfessionalUser { get; set; } = null!;
}
