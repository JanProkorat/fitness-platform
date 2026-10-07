using System.Text.Json;
using System.Text.RegularExpressions;
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
    [InlineData("/nutrition/plan-templates/{templateId}/copy")]
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

    [Fact]
    public async Task Swagger_PlanTemplatePaths_PlaceholdersMatchDeclaredPathParametersCaseSensitively()
    {
        using var client = factory.CreateClient();

        var json = await client.GetStringAsync("/swagger/v1/swagger.json", TestContext.Current.CancellationToken);
        using var document = JsonDocument.Parse(json);

        var mismatches = new List<string>();
        var checkedPaths = 0;

        foreach (var path in document.RootElement.GetProperty("paths").EnumerateObject())
        {
            if (!path.Name.StartsWith("/nutrition/plan-templates", StringComparison.Ordinal))
            {
                continue;
            }

            checkedPaths++;
            var placeholders = Regex.Matches(path.Name, "{([^}]+)}").Select(m => m.Groups[1].Value).ToList();

            foreach (var operation in path.Value.EnumerateObject())
            {
                var declared = new HashSet<string>(StringComparer.Ordinal);

                if (operation.Value.TryGetProperty("parameters", out var parameters))
                {
                    foreach (var parameter in parameters.EnumerateArray())
                    {
                        if (parameter.GetProperty("in").GetString() == "path")
                        {
                            declared.Add(parameter.GetProperty("name").GetString()!);
                        }
                    }
                }

                mismatches.AddRange(placeholders
                    .Where(placeholder => !declared.Contains(placeholder))
                    .Select(placeholder => $"{operation.Name.ToUpperInvariant()} {path.Name}: {{{placeholder}}}"));
            }
        }

        checkedPaths.Should().BeGreaterThan(0);
        mismatches.Should().BeEmpty("a placeholder that differs in case from its parameter is never substituted by the generated client");
    }
}
