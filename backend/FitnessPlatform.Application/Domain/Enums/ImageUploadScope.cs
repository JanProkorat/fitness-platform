namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Identifies the logical bucket scope for an image upload request.
/// Each scope maps to a specific blob-path convention under the storage root.
/// </summary>
public enum ImageUploadScope
{
    /// <summary>
    /// User or professional avatar.
    /// Blob path: <c>avatars/{userId}.{ext}</c>
    /// </summary>
    Avatar,

    /// <summary>
    /// Food item image.
    /// Blob path: <c>foods/{foodId}.{ext}</c>
    /// </summary>
    Food,

    /// <summary>
    /// Recipe image (primary or gallery slot).
    /// Blob path: <c>recipes/{recipeId}/{slot}.{ext}</c>
    /// </summary>
    Recipe,

    /// <summary>
    /// Nutrition or training plan photo.
    /// Blob path: <c>plan-photos/{planId}/{photoId}.{ext}</c>
    /// </summary>
    PlanPhoto,

    /// <summary>
    /// Client diary photo (progress photo, etc.).
    /// Blob path: <c>diary/{diaryId}/{photoId}.{ext}</c>
    /// </summary>
    Diary,
}
