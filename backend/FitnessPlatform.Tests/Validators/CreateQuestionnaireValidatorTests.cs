using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Questionnaires.CreateQuestionnaire;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Validators;

/// <summary>
/// Tests for <see cref="CreateQuestionnaireValidator"/>.
/// </summary>
public class CreateQuestionnaireValidatorTests
{
    private readonly CreateQuestionnaireValidator _validator = new();

    [Theory]
    [InlineData(QuestionnaireType.Onboarding)]
    [InlineData(QuestionnaireType.CheckIn)]
    public void ValidRequest_PassesValidation(QuestionnaireType type)
    {
        var result = _validator.TestValidate(new CreateQuestionnaireRequest { Title = "Intake", Type = type });

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Type_UndefinedEnumValue_Fails()
    {
        var result = _validator.TestValidate(
            new CreateQuestionnaireRequest { Title = "Intake", Type = (QuestionnaireType)99 });

        result.ShouldHaveValidationErrorFor(x => x.Type);
    }

    [Fact]
    public void Title_Empty_Fails()
    {
        var result = _validator.TestValidate(new CreateQuestionnaireRequest { Title = "" });

        result.ShouldHaveValidationErrorFor(x => x.Title);
    }
}
