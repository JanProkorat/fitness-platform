using System.Text.Json;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;

namespace FitnessPlatform.Tests.Endpoints.NutritionPlanTemplates;

/// <summary>
/// Swagger contract for the plan-template endpoints that send 201: the generated client only accepts
/// statuses the spec declares, so each must list 201 and not 200.
/// </summary>
[Collection(TestCollection.Name)]
public class TemplateCreatedContractTests(FitnessApiFactory factory)
{
    [Theory]
    [InlineData("/nutrition/plan-templates")]
    [InlineData("/nutrition/plan-templates/{TemplateId}/copy")]
    [InlineData("/nutrition/plan-templates/from-plan")]
    [InlineData("/nutrition/plan-templates/{templateId}/instantiate")]
    public async Task Swagger_TemplateCreatingPost_DeclaresCreatedAndNotOk(string route)
    {
        using var client = factory.CreateClient();

        var json = await client.GetStringAsync("/swagger/v1/swagger.json", TestContext.Current.CancellationToken);
        using var document = JsonDocument.Parse(json);

        var paths = document.RootElement.GetProperty("paths");
        paths.TryGetProperty(route, out var pathItem).Should().BeTrue("the spec must contain {0}", route);

        var responses = pathItem.GetProperty("post").GetProperty("responses");

        responses.TryGetProperty("201", out _).Should().BeTrue();
        responses.TryGetProperty("200", out _).Should().BeFalse();
    }
}
