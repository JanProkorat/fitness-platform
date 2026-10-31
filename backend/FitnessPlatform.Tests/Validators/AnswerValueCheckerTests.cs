using FitnessPlatform.Application.Features.Questionnaires.Shared;
using FluentAssertions;

namespace FitnessPlatform.Tests.Validators;

public class AnswerValueCheckerTests
{
    private const string Choices = """{"options":["A","B","C"]}""";
    private const string ChoicesOther = """{"options":["A","B"],"allowOther":true}""";

    [Theory]
    [InlineData(QuestionTypes.ShortText, null)]
    [InlineData(QuestionTypes.Section, null)]
    [InlineData(QuestionTypes.SingleChoice, Choices)]
    public void FindProblem_BlankAnswer_IsValidForEveryType(string type, string? config)
    {
        AnswerValueChecker.FindProblem(type, config, "  ", null, "", null).Should().BeNull();
        AnswerValueChecker.IsBlank("  ", null, "", null).Should().BeTrue();
    }

    [Theory]
    // single_choice
    [InlineData(QuestionTypes.SingleChoice, Choices, "A", null, null, null, true)]
    [InlineData(QuestionTypes.SingleChoice, Choices, "Z", null, null, null, false)]
    [InlineData(QuestionTypes.SingleChoice, ChoicesOther, "Z", null, null, null, true)]
    [InlineData(QuestionTypes.SingleChoice, Choices, "A", 1.0, null, null, false)]
    // multi_select
    [InlineData(QuestionTypes.MultiSelect, Choices, null, null, """["A","B"]""", null, true)]
    [InlineData(QuestionTypes.MultiSelect, Choices, null, null, "not json", null, false)]
    [InlineData(QuestionTypes.MultiSelect, Choices, null, null, """{"a":1}""", null, false)]
    [InlineData(QuestionTypes.MultiSelect, Choices, null, null, """["A",1]""", null, false)]
    [InlineData(QuestionTypes.MultiSelect, Choices, null, null, """["A","A"]""", null, false)]
    [InlineData(QuestionTypes.MultiSelect, Choices, null, null, """["Z"]""", null, false)]
    [InlineData(QuestionTypes.MultiSelect, Choices, "Other", null, """["A"]""", null, false)]
    [InlineData(QuestionTypes.MultiSelect, ChoicesOther, "Other", null, """["A"]""", null, true)]
    // short_text
    [InlineData(QuestionTypes.ShortText, null, "hello", null, null, null, true)]
    [InlineData(QuestionTypes.ShortText, null, "hello", 3.0, null, null, false)]
    [InlineData(QuestionTypes.ShortText, null, "hello", null, """["x"]""", null, false)]
    // number
    [InlineData(QuestionTypes.Number, """{"min":10,"max":20}""", null, 15.0, null, null, true)]
    [InlineData(QuestionTypes.Number, """{"min":10,"max":20}""", null, 9.0, null, null, false)]
    [InlineData(QuestionTypes.Number, """{"min":10,"max":20}""", null, 21.0, null, null, false)]
    [InlineData(QuestionTypes.Number, null, null, 12.5, null, null, true)]
    [InlineData(QuestionTypes.Number, null, "x", 12.5, null, null, false)]
    // smiley / star
    [InlineData(QuestionTypes.SmileyRating, null, null, 1.0, null, null, true)]
    [InlineData(QuestionTypes.SmileyRating, null, null, 5.0, null, null, true)]
    [InlineData(QuestionTypes.SmileyRating, null, null, 6.0, null, null, false)]
    [InlineData(QuestionTypes.SmileyRating, null, null, 0.0, null, null, false)]
    [InlineData(QuestionTypes.StarRating, null, null, 2.5, null, null, false)]
    [InlineData(QuestionTypes.StarRating, null, null, 4.0, null, null, true)]
    // scale (default 1-10, config overrides)
    [InlineData(QuestionTypes.Scale, null, null, 10.0, null, null, true)]
    [InlineData(QuestionTypes.Scale, null, null, 11.0, null, null, false)]
    [InlineData(QuestionTypes.Scale, null, null, 5.5, null, null, false)]
    [InlineData(QuestionTypes.Scale, """{"min":0,"max":5}""", null, 0.0, null, null, true)]
    [InlineData(QuestionTypes.Scale, """{"min":0,"max":5}""", null, 6.0, null, null, false)]
    // file_upload
    [InlineData(QuestionTypes.FileUpload, null, null, null, null, "https://cdn.example.com/a.png", true)]
    [InlineData(QuestionTypes.FileUpload, null, null, null, null, "http://cdn.example.com/a.png", false)]
    [InlineData(QuestionTypes.FileUpload, null, null, null, null, "javascript:alert(1)", false)]
    [InlineData(QuestionTypes.FileUpload, null, null, null, null, "/relative/a.png", false)]
    // section never takes an answer
    [InlineData(QuestionTypes.Section, null, "x", null, null, null, false)]
    public void FindProblem_PerType_AcceptsOnlyTheDocumentedEncoding(
        string type, string? config, string? valueText, double? valueNumber, string? valueJson, string? fileUrl,
        bool expectedValid)
    {
        var problem = AnswerValueChecker.FindProblem(
            type, config, valueText, valueNumber is null ? null : (decimal)valueNumber, valueJson, fileUrl);

        (problem is null).Should().Be(expectedValid, "problem was: {0}", problem);
    }
}
