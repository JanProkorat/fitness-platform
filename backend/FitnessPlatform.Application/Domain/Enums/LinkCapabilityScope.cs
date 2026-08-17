namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Which link-capability domain(s) an operation cares about. Used in two places:
/// (1) on the write side, the explicit per-relationship domain scope a professional can
/// request when forming or reactivating a <see cref="Entities.ClientProfessionalLink"/> —
/// narrowing the CanViewNutritionPlans / CanViewTrainingPlans flags stamped on that link
/// relative to the full set implied by the relevant professional's held identity roles (it
/// can only narrow, never widen, beyond what those roles already allow); (2) on the read
/// side, the domain predicate a batch query such as
/// <see cref="Services.ClientLinkAuthorizationService.GetAccessibleClientsAsync"/> pushes
/// down into its <c>WHERE</c> clause to scope which active links qualify.
/// </summary>
public enum LinkCapabilityScope
{
    /// <summary>
    /// Write side: grant every domain implied by the professional's held roles. This is
    /// the implicit default when the caller supplies no explicit scope, preserving the
    /// existing both-flags-from-held-roles behavior (#776).
    /// Read side: require both <c>CanViewTrainingPlans</c> AND <c>CanViewNutritionPlans</c>
    /// on the link.
    /// </summary>
    Both,

    /// <summary>
    /// Write side: grant nutrition-plan access only, even if the professional also holds
    /// the Trainer role. Read side: require only <c>CanViewNutritionPlans</c> on the link.
    /// </summary>
    NutritionOnly,

    /// <summary>
    /// Write side: grant training-plan access only, even if the professional also holds
    /// the Nutritionist role. Read side: require only <c>CanViewTrainingPlans</c> on the
    /// link.
    /// </summary>
    TrainingOnly
}
