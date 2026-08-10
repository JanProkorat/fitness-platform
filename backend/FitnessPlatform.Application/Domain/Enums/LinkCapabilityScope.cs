namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Explicit per-relationship domain scope a professional can request when forming or
/// reactivating a <see cref="Entities.ClientProfessionalLink"/>. Narrows the
/// CanViewNutritionPlans / CanViewTrainingPlans flags stamped on that link relative to
/// the full set implied by the relevant professional's held identity roles — it can
/// only narrow, never widen, beyond what those roles already allow.
/// </summary>
public enum LinkCapabilityScope
{
    /// <summary>
    /// Grant every domain implied by the professional's held roles. This is the
    /// implicit default when the caller supplies no explicit scope, preserving the
    /// existing both-flags-from-held-roles behavior (#776).
    /// </summary>
    Both,

    /// <summary>
    /// Grant nutrition-plan access only, even if the professional also holds the
    /// Trainer role.
    /// </summary>
    NutritionOnly,

    /// <summary>
    /// Grant training-plan access only, even if the professional also holds the
    /// Nutritionist role.
    /// </summary>
    TrainingOnly
}
