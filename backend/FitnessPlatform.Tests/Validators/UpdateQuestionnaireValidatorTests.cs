using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Questionnaires.UpdateQuestionnaire;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Validators;

/// <summary>
/// Tests for <see cref="UpdateQuestionnaireValidator"/>: question type membership and per-type config shape.
/// </summary>
public class UpdateQuestionnaireValidatorTests
{
    private readonly UpdateQuestionnaireValidator _validator = new();

    private static UpdateQuestionnaireRequest RequestWith(string? type, string? config) => new()
    {
        PublicId = Guid.NewGuid(),
        Title = "Intake",
        Questions = [new UpdateQuestionDto { Type = type!, Label = "Question", Config = config }],
    };

    private bool HasErrorCode(UpdateQuestionnaireRequest request, string errorCode) =>
        _validator.TestValidate(request).Errors.Any(e => e.ErrorCode == errorCode);

    [Theory]
    [InlineData("single_choice", "{\"options\":[\"A\",\"B\"]}")]
    [InlineData("single_choice", "{\"options\":[\"A\",\"B\"],\"allowOther\":true}")]
    [InlineData("multi_select", "{\"options\":[\"Knee\",\"Back\"],\"allowOther\":false}")]
    [InlineData("short_text", null)]
    [InlineData("number", null)]
    [InlineData("number", "{\"min\":30,\"max\":250,\"unit\":\"kg\",\"step\":1}")]
    [InlineData("number", "{\"unit\":\"kg\"}")]
    [InlineData("smiley_rating", "{\"lowLabel\":\"Bad\",\"highLabel\":\"Great\"}")]
    [InlineData("star_rating", null)]
    [InlineData("scale", "{\"min\":1,\"max\":10,\"labelMin\":\"Low\",\"labelMax\":\"High\"}")]
    [InlineData("file_upload", null)]
    public void Question_ValidTypeAndConfig_Passes(string type, string? config)
    {
        var result = _validator.TestValidate(RequestWith(type, config));

        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("text")]
    [InlineData("SINGLE_CHOICE")]
    [InlineData("rating")]
    [InlineData("")]
    [InlineData(null)]
    public void Question_UnknownType_FailsWithQuestionTypeInvalid(string? type)
    {
        HasErrorCode(RequestWith(type, null), ErrorCodes.QuestionTypeInvalid).Should().BeTrue();
    }

    [Theory]
    [InlineData("single_choice", null)]
    [InlineData("single_choice", "{}")]
    [InlineData("single_choice", "{\"options\":[]}")]
    [InlineData("multi_select", "{\"options\":[\"A\",\" \"]}")]
    [InlineData("multi_select", "{\"options\":[\"A\",null]}")]
    [InlineData("single_choice", "not json")]
    [InlineData("number", "{\"min\":10,\"max\":5}")]
    [InlineData("number", "{\"min\":\"low\"}")]
    [InlineData("smiley_rating", null)]
    [InlineData("smiley_rating", "{\"lowLabel\":\"Bad\"}")]
    [InlineData("smiley_rating", "{\"lowLabel\":\"Bad\",\"highLabel\":\" \"}")]
    [InlineData("scale", "[1,2]")]
    [InlineData("star_rating", "not json")]
    public void Question_InvalidConfig_FailsWithQuestionConfigInvalid(string type, string? config)
    {
        HasErrorCode(RequestWith(type, config), ErrorCodes.QuestionConfigInvalid).Should().BeTrue();
    }

    [Fact]
    public void Type_UndefinedEnumValue_Fails()
    {
        var request = RequestWith("short_text", null);
        request.Type = (QuestionnaireType)99;

        _validator.TestValidate(request).ShouldHaveValidationErrorFor(x => x.Type);
    }

    [Fact]
    public void Type_Omitted_Passes()
    {
        var request = RequestWith("short_text", null);
        request.Type = null;

        _validator.TestValidate(request).IsValid.Should().BeTrue();
    }
}
