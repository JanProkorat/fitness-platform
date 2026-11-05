using FormUp.Application.Features.Discounts.Shared;

namespace FormUp.Application.Features.Discounts.CreateCoachDiscount;

/// <summary>
/// Validates the <see cref="CreateCoachDiscountRequest"/> with the shared discount input rules.
/// </summary>
public class CreateCoachDiscountValidator : CoachDiscountInputValidator<CreateCoachDiscountRequest>;
