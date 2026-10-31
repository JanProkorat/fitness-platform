using System.Net;
using System.Net.Http.Json;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Questionnaires.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.Questionnaires;

/// <summary>Integration tests for PUT /client/questionnaire/response/{id}.</summary>
[Collection(TestCollection.Name)]
public class UpdateResponseEndpointTests(FitnessApiFactory factory)
{
    private const string Choices = """{"options":["A","B"]}""";

    private static readonly SeedQuestion[] Form =
    [
        new("choice", QuestionTypes.SingleChoice, Choices),
        new("multi", QuestionTypes.MultiSelect, Choices),
        new("number", QuestionTypes.Number, """{"min":1,"max":10}"""),
        new("smiley", QuestionTypes.SmileyRating, """{"lowLabel":"low","highLabel":"high"}"""),
        new("scale", QuestionTypes.Scale),
        new("text", QuestionTypes.ShortText),
        new("section", QuestionTypes.Section),
        new("hidden", QuestionTypes.ShortText, Hidden: true),
    ];

    private static object Answer(Guid questionId, string? text = null, decimal? number = null, string? json = null) =>
        new { questionPublicId = questionId, valueText = text, valueNumber = number, valueJson = json };

    private Task<HttpResponseMessage> PutAsync(QuestionnaireAnswerScenario scenario, params object[] answers) =>
        scenario.Client.Http.PutAsJsonAsync(
            $"/client/questionnaire/response/{scenario.ResponsePublicId}",
            new { answers },
            TestContext.Current.CancellationToken);

    private async Task AssertCodedBadRequestAsync(HttpResponseMessage response)
    {
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.Should().Contain(ErrorCodes.QuestionnaireAnswerInvalid);
    }

    [Fact]
    public async Task Put_ValidAnswers_Returns204AndPersists()
    {
        var scenario = await QuestionnaireAnswerScenario.CreateAsync(factory, Form);

        var response = await PutAsync(
            scenario,
            Answer(scenario.QuestionIds["choice"], text: "A"),
            Answer(scenario.QuestionIds["multi"], json: """["A","B"]"""),
            Answer(scenario.QuestionIds["number"], number: 4.5m),
            Answer(scenario.QuestionIds["smiley"], number: 3),
            Answer(scenario.QuestionIds["scale"], number: 7),
            Answer(scenario.QuestionIds["text"], text: "hello"));

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var saved = await db.QuestionnaireResponses.Include(r => r.Answers)
            .FirstAsync(r => r.PublicId == scenario.ResponsePublicId, TestContext.Current.CancellationToken);
        saved.Status.Should().Be(QuestionnaireResponseStatus.InProgress);
        saved.Answers.Should().HaveCount(6);
    }

    [Fact]
    public async Task Put_ClearedAnswer_RemovesTheStoredAnswer()
    {
        var scenario = await QuestionnaireAnswerScenario.CreateAsync(factory, Form);
        await PutAsync(scenario, Answer(scenario.QuestionIds["text"], text: "hello"));

        var response = await PutAsync(scenario, Answer(scenario.QuestionIds["text"], text: "  "));

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var saved = await db.QuestionnaireResponses.Include(r => r.Answers)
            .FirstAsync(r => r.PublicId == scenario.ResponsePublicId, TestContext.Current.CancellationToken);
        saved.Answers.Should().BeEmpty();
    }

    [Theory]
    [InlineData("choice", "Z", null, null)]
    [InlineData("multi", null, null, """["A","A"]""")]
    [InlineData("multi", null, null, """["Z"]""")]
    [InlineData("multi", "Other", null, """["A"]""")]
    [InlineData("number", null, 11.0, null)]
    [InlineData("number", null, 0.0, null)]
    [InlineData("smiley", null, 6.0, null)]
    [InlineData("smiley", null, 2.5, null)]
    [InlineData("scale", null, 11.0, null)]
    [InlineData("text", "hello", 3.0, null)]
    public async Task Put_InvalidAnswerForType_Returns400WithCode(
        string key, string? text, double? number, string? json)
    {
        var scenario = await QuestionnaireAnswerScenario.CreateAsync(factory, Form);

        var response = await PutAsync(
            scenario,
            Answer(scenario.QuestionIds[key], text, number is null ? null : (decimal)number, json));

        await AssertCodedBadRequestAsync(response);
    }

    [Fact]
    public async Task Put_QuestionOfAnotherQuestionnaire_Returns400AndSavesNothing()
    {
        var scenario = await QuestionnaireAnswerScenario.CreateAsync(factory, Form);
        var other = await QuestionnaireAnswerScenario.CreateAsync(factory, Form);

        var response = await PutAsync(
            scenario,
            Answer(scenario.QuestionIds["text"], text: "valid"),
            Answer(other.QuestionIds["text"], text: "foreign"));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken))
            .Should().Contain(ErrorCodes.QuestionnaireQuestionNotInForm);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var saved = await db.QuestionnaireResponses.Include(r => r.Answers)
            .FirstAsync(r => r.PublicId == scenario.ResponsePublicId, TestContext.Current.CancellationToken);
        saved.Answers.Should().BeEmpty();
        saved.Status.Should().Be(QuestionnaireResponseStatus.Pending);
    }

    [Theory]
    [InlineData("hidden")]
    [InlineData("section")]
    [InlineData("unknown")]
    public async Task Put_UnknownHiddenOrSectionQuestion_Returns400(string key)
    {
        var scenario = await QuestionnaireAnswerScenario.CreateAsync(factory, Form);
        var questionId = key == "unknown" ? Guid.NewGuid() : scenario.QuestionIds[key];

        var response = await PutAsync(scenario, Answer(questionId, text: "x"));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken))
            .Should().Contain(ErrorCodes.QuestionnaireQuestionNotInForm);
    }

    [Theory]
    [MemberData(nameof(OutOfScopeLinks))]
    public async Task Put_ResponseOutsideTheCurrentCollaboration_Returns404(bool linkActive, bool activatedInFuture)
    {
        var scenario = await QuestionnaireAnswerScenario.CreateAsync(
            factory,
            Form,
            activatedAtUtc: activatedInFuture ? DateTime.UtcNow.AddHours(1) : null,
            linkActive: linkActive);

        var response = await PutAsync(scenario, Answer(scenario.QuestionIds["text"], text: "x"));

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    public static TheoryData<bool, bool> OutOfScopeLinks => new()
    {
        { false, false }, // inactive link
        { true, true }, // response predates the link's ActivatedAtUtc
    };

    [Fact]
    public async Task Put_OnSubmittedResponse_StillReturns409()
    {
        var scenario = await QuestionnaireAnswerScenario.CreateAsync(
            factory, Form, status: QuestionnaireResponseStatus.Submitted);

        var response = await PutAsync(scenario, Answer(scenario.QuestionIds["text"], text: "x"));

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }
}
