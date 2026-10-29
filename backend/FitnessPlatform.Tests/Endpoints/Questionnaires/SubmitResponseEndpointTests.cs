using System.Net;
using System.Net.Http.Json;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Questionnaires.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.Questionnaires;

/// <summary>Integration tests for POST /client/questionnaire/response/{id}/submit.</summary>
[Collection(TestCollection.Name)]
public class SubmitResponseEndpointTests(FitnessApiFactory factory)
{
    private static readonly SeedQuestion[] Form =
    [
        new("required", QuestionTypes.ShortText, Required: true),
        new("optional", QuestionTypes.ShortText),
        new("hiddenRequired", QuestionTypes.ShortText, Required: true, Hidden: true),
        new("sectionRequired", QuestionTypes.Section, Required: true),
    ];

    private Task<HttpResponseMessage> SubmitAsync(QuestionnaireAnswerScenario scenario) =>
        scenario.Client.Http.PostAsync(
            $"/client/questionnaire/response/{scenario.ResponsePublicId}/submit",
            null,
            TestContext.Current.CancellationToken);

    private async Task SeedAnswerAsync(QuestionnaireAnswerScenario scenario, string key, string? text)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var ct = TestContext.Current.CancellationToken;
        var responseId = await db.QuestionnaireResponses
            .Where(r => r.PublicId == scenario.ResponsePublicId).Select(r => r.Id).FirstAsync(ct);
        var questionId = await db.QuestionnaireQuestions
            .Where(q => q.PublicId == scenario.QuestionIds[key]).Select(q => q.Id).FirstAsync(ct);
        db.QuestionnaireAnswers.Add(new QuestionnaireAnswer
        {
            PublicId = Guid.NewGuid(),
            ResponseId = responseId,
            QuestionId = questionId,
            ValueText = text,
        });
        await db.SaveChangesAsync(ct);
    }

    [Fact]
    public async Task Submit_RequiredVisibleQuestionUnanswered_Returns400WithCode()
    {
        var scenario = await QuestionnaireAnswerScenario.CreateAsync(factory, Form);

        var response = await SubmitAsync(scenario);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken))
            .Should().Contain(ErrorCodes.QuestionnaireRequiredAnswerMissing);
    }

    [Fact]
    public async Task Submit_RequiredAnswerBlank_Returns400WithCode()
    {
        var scenario = await QuestionnaireAnswerScenario.CreateAsync(factory, Form);
        await SeedAnswerAsync(scenario, "required", "   ");

        var response = await SubmitAsync(scenario);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Submit_OnlyHiddenAndSectionQuestionsUnanswered_Succeeds()
    {
        var scenario = await QuestionnaireAnswerScenario.CreateAsync(factory, Form);
        await SeedAnswerAsync(scenario, "required", "done");

        var response = await SubmitAsync(scenario);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        (await db.QuestionnaireResponses.Where(r => r.PublicId == scenario.ResponsePublicId)
            .Select(r => r.Status).FirstAsync(TestContext.Current.CancellationToken))
            .Should().Be(QuestionnaireResponseStatus.Submitted);
    }

    [Theory]
    [InlineData(false, false)] // inactive link
    [InlineData(true, true)] // response predates the link's ActivatedAtUtc
    public async Task Submit_ResponseOutsideTheCurrentCollaboration_Returns404(bool linkActive, bool activatedInFuture)
    {
        var scenario = await QuestionnaireAnswerScenario.CreateAsync(
            factory,
            Form,
            activatedAtUtc: activatedInFuture ? DateTime.UtcNow.AddHours(1) : null,
            linkActive: linkActive);
        await SeedAnswerAsync(scenario, "required", "done");

        var response = await SubmitAsync(scenario);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Submit_AlreadySubmitted_StillReturns409()
    {
        var scenario = await QuestionnaireAnswerScenario.CreateAsync(
            factory, Form, status: QuestionnaireResponseStatus.Submitted);

        var response = await SubmitAsync(scenario);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }
}
