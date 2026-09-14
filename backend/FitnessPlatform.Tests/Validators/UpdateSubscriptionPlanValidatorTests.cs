using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.SubscriptionPlans.Shared;
using FitnessPlatform.Application.Features.SubscriptionPlans.UpdateSubscriptionPlan;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Validators;

/// <summary>
/// Tests for <see cref="UpdateSubscriptionPlanValidator"/>.
/// </summary>
public class UpdateSubscriptionPlanValidatorTests
{
    private readonly UpdateSubscriptionPlanValidator _validator = new();

    private static UpdateSubscriptionPlanRequest ValidRequest() => new()
    {
        Code = "small",
        NameCs = "Malý",
        NameEn = "Small",
        NameDe = "Klein",
        ApplicableRoles = ApplicableRoles.Both,
        CanCreatePlans = true,
        CanMessage = true,
        CanSendQuestionnaires = true,
        CanUseWeeklyCheckIns = true,
        CanUsePerClientCheckInConfig = true,
        Currency = "CZK",
        PriceMinorUnits = 29900,
        BillingInterval = BillingInterval.Monthly,
        MaxActiveClients = new OptionalField<int?>(10),
        IsActive = true,
    };

    [Fact]
    public void ValidRequest_PassesValidation()
    {
        var result = _validator.TestValidate(ValidRequest());
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Currency_NotThreeUppercaseLetters_FailsWithOutOfRangeCode()
    {
        var req = ValidRequest();
        req.Currency = "eur";

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Currency).WithErrorCode(ErrorCodes.OutOfRange);
    }

    [Fact]
    public void Currency_NotInSupportedAllowlist_FailsWithUnsupportedCurrencyCode()
    {
        var req = ValidRequest();
        req.Currency = "GBP";

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Currency).WithErrorCode(ErrorCodes.UnsupportedCurrency);
    }

    [Fact]
    public void PriceMinorUnits_Negative_FailsWithOutOfRangeCode()
    {
        var req = ValidRequest();
        req.PriceMinorUnits = -1;

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.PriceMinorUnits).WithErrorCode(ErrorCodes.OutOfRange);
    }

    [Fact]
    public void MaxActiveClients_Zero_FailsWithOutOfRangeCode()
    {
        var req = ValidRequest();
        req.MaxActiveClients = new OptionalField<int?>(0);

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.MaxActiveClients.Value).WithErrorCode(ErrorCodes.OutOfRange);
    }

    [Fact]
    public void MaxActiveClients_NotSet_FailsWithRequiredCode()
    {
        var req = ValidRequest();
        req.MaxActiveClients = default;

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.MaxActiveClients).WithErrorCode(ErrorCodes.Required);
    }

    [Fact]
    public void MaxActiveClients_ExplicitNull_PassesValidation()
    {
        var req = ValidRequest();
        req.MaxActiveClients = new OptionalField<int?>(null);

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void NameCs_Empty_FailsWithRequiredCode()
    {
        var req = ValidRequest();
        req.NameCs = "";

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.NameCs).WithErrorCode(ErrorCodes.Required);
    }

    [Fact]
    public void Code_Empty_FailsWithRequiredCode()
    {
        var req = ValidRequest();
        req.Code = "";

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Code).WithErrorCode(ErrorCodes.Required);
    }

    [Fact]
    public void Code_UppercaseLetters_FailsWithOutOfRangeCode()
    {
        var req = ValidRequest();
        req.Code = "Small";

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Code).WithErrorCode(ErrorCodes.OutOfRange);
    }

    [Fact]
    public void CanCreatePlans_NotSet_FailsWithRequiredCode()
    {
        var req = ValidRequest();
        req.CanCreatePlans = null;

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.CanCreatePlans).WithErrorCode(ErrorCodes.Required);
    }

    [Fact]
    public void IsActive_NotSet_FailsWithRequiredCode()
    {
        var req = ValidRequest();
        req.IsActive = null;

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.IsActive).WithErrorCode(ErrorCodes.Required);
    }

    [Fact]
    public void ExternalPriceId_TooLong_FailsWithOutOfRangeCode()
    {
        var req = ValidRequest();
        req.ExternalPriceId = new string('a', 201);

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.ExternalPriceId).WithErrorCode(ErrorCodes.OutOfRange);
    }
}
