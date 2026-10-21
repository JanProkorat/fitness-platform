using FitnessPlatform.Application.Features.Discounts.Shared;

namespace FitnessPlatform.Application.Features.Discounts.UpdateCoachDiscount;

/// <summary>
/// Validates the <see cref="UpdateCoachDiscountRequest"/> with the shared discount input rules.
/// </summary>
public class UpdateCoachDiscountValidator : CoachDiscountInputValidator<UpdateCoachDiscountRequest>;
