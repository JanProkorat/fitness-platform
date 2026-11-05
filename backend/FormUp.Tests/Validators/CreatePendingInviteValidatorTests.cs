using FormUp.Application.Domain.Constants;
using FormUp.Application.Features.Trainers.PendingInvites.Create;
using FluentValidation.TestHelper;

namespace FormUp.Tests.Validators;

/// <summary>
/// Coverage of the package rules of the pending invite input validation.
/// </summary>
public class CreatePendingInviteValidatorTests
{
    private readonly CreatePendingInviteValidator _validator = new();

    [Fact]
    public void Validate_DiscountWithoutPackage_FailsWithItsOwnCode()
    {
        var request = new CreatePendingInviteRequest { Email = "client@example.com", DiscountId = Guid.NewGuid() };

        _validator.TestValidate(request)
            .ShouldHaveValidationErrorFor(x => x.PackageId)
            .WithErrorCode(ErrorCodes.InviteDiscountNeedsPackage);
    }

    [Fact]
    public void Validate_SkipOnboardingFormWithQuestionnaire_FailsWithItsOwnCode()
    {
        var request = new CreatePendingInviteRequest
        {
            Email = "client@example.com",
            SkipOnboardingForm = true,
            QuestionnairePublicId = Guid.NewGuid()
        };

        _validator.TestValidate(request)
            .ShouldHaveValidationErrorFor(x => x.QuestionnairePublicId)
            .WithErrorCode(ErrorCodes.SkipOnboardingFormWithQuestionnaire);
    }

    [Theory]
    [InlineData(true, false)]
    [InlineData(false, true)]
    public void Validate_SkipOrQuestionnaireAlone_Passes(bool skip, bool withQuestionnaire)
    {
        var request = new CreatePendingInviteRequest
        {
            Email = "client@example.com",
            SkipOnboardingForm = skip,
            QuestionnairePublicId = withQuestionnaire ? Guid.NewGuid() : null
        };

        _validator.TestValidate(request).ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(true, false)]
    [InlineData(true, true)]
    public void Validate_PackageAndDiscountCombinations_Pass(bool withPackage, bool withDiscount)
    {
        var request = new CreatePendingInviteRequest
        {
            Email = "client@example.com",
            PackageId = withPackage ? Guid.NewGuid() : null,
            DiscountId = withDiscount ? Guid.NewGuid() : null
        };

        _validator.TestValidate(request).ShouldNotHaveAnyValidationErrors();
    }
}
