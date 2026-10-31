using System.Net;
using System.Net.Http.Json;
using FitnessPlatform.Application.Features.Questionnaires.GetClientQuestionnaire;
using FitnessPlatform.Application.Features.Questionnaires.Shared;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;

namespace FitnessPlatform.Tests.Endpoints.Questionnaires;

/// <summary>Integration tests for GET /client/questionnaire query binding.</summary>
[Collection(TestCollection.Name)]
public class GetClientQuestionnaireEndpointTests(FitnessApiFactory factory)
{
    private static readonly SeedQuestion[] Form = [new("text", QuestionTypes.ShortText)];

    [Fact]
    public async Task Get_WithResponsePublicId_BindsItAndReturnsThatResponse()
    {
        var scenario = await QuestionnaireAnswerScenario.CreateAsync(factory, Form);

        var body = await scenario.Client.Http.GetFromJsonAsync<GetClientQuestionnaireResponse>(
            $"/client/questionnaire?responsePublicId={scenario.ResponsePublicId}",
            TestContext.Current.CancellationToken);

        body!.ExistingResponsePublicId.Should().Be(scenario.ResponsePublicId);
        body.QuestionnairePublicId.Should().Be(scenario.QuestionnairePublicId);
    }

    [Fact]
    public async Task Get_WithLinkPublicId_BindsItAndReturnsThatLinksQuestionnaire()
    {
        var scenario = await QuestionnaireAnswerScenario.CreateAsync(factory, Form);

        var response = await scenario.Client.Http.GetAsync(
            $"/client/questionnaire?linkPublicId={scenario.LinkPublicId}",
            TestContext.Current.CancellationToken);

        // The seeded questionnaire is the coach's default, so the link resolves to it.
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<GetClientQuestionnaireResponse>(
            TestContext.Current.CancellationToken);
        body!.LinkPublicId.Should().Be(scenario.LinkPublicId);
    }

    [Fact]
    public async Task Get_WithUnknownResponsePublicId_Returns404()
    {
        var scenario = await QuestionnaireAnswerScenario.CreateAsync(factory, Form);

        var response = await scenario.Client.Http.GetAsync(
            $"/client/questionnaire?responsePublicId={Guid.NewGuid()}",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
