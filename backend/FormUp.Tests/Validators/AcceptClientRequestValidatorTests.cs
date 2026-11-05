using FormUp.Application.Domain.Constants;
using FormUp.Application.Features.Trainers.ClientRequests.AcceptClientRequest;
using FluentValidation.TestHelper;

namespace FormUp.Tests.Validators;

/// <summary>
/// Coverage of the onboarding-form choice rule of the accept-request input validation.
/// </summary>
public class AcceptClientRequestValidatorTests
{
    private readonly AcceptClientRequestValidator _validator = new();

    [Fact]
    public void Validate_SkipOnboardingFormWithQuestionnaire_FailsWithItsOwnCode()
    {
        var request = new AcceptClientRequestRequest
        {
            PublicId = Guid.NewGuid(),
            SkipOnboardingForm = true,
            QuestionnairePublicId = Guid.NewGuid()
        };

        _validator.TestValidate(request)
            .ShouldHaveValidationErrorFor(x => x.QuestionnairePublicId)
            .WithErrorCode(ErrorCodes.SkipOnboardingFormWithQuestionnaire);
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(true, false)]
    [InlineData(false, true)]
    public void Validate_OtherChoiceCombinations_Pass(bool skip, bool withQuestionnaire)
    {
        var request = new AcceptClientRequestRequest
        {
            PublicId = Guid.NewGuid(),
            SkipOnboardingForm = skip,
            QuestionnairePublicId = withQuestionnaire ? Guid.NewGuid() : null
        };

        _validator.TestValidate(request).ShouldNotHaveAnyValidationErrors();
    }
}
