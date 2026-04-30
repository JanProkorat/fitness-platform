namespace FitnessPlatform.Application.Features.ClientPlans.GeneratePlanPhotoUploadUrl;

/// <summary>
/// Request model for generating a pre-signed plan photo upload URL.
/// </summary>
public class GeneratePlanPhotoUploadUrlRequest
{
    /// <summary>
    /// Route: the plan's public identifier (NutritionPlan.ExternalId or TrainingPlan.ExternalId).
    /// </summary>
    public Guid PlanId { get; set; }

    /// <summary>
    /// MIME type of the image file (e.g. "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif")
    /// </summary>
    public string ContentType { get; set; } = string.Empty;

    /// <summary>
    /// Declared file size in bytes. Must not exceed 5 MiB.
    /// </summary>
    public long SizeBytes { get; set; }
}
