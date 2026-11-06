using System.Text.Json;
using FormUp.Tests.Infrastructure;
using FluentAssertions;

namespace FormUp.Tests.Architecture;

/// <summary>
/// Swagger contract for operations whose declared status codes once drifted from what they send: the
/// generated clients only accept statuses the spec declares, so each operation must list exactly the
/// codes it can return (FastEndpoints adds 401 and, for role-gated routes, 403 itself).
/// </summary>
[Collection(TestCollection.Name)]
public class StatusCodeContractTests(FitnessApiFactory factory)
{
    [Theory]
    [InlineData("put", "/users/me", "200,400,401,404")]
    [InlineData("put", "/users/me/timezone", "200,400,401,404")]
    [InlineData("put", "/trainer/profile", "200,400,401,403,404")]
    [InlineData("post", "/auth/password/reset", "200,400,404,429")]
    [InlineData("put", "/auth/password/reset", "200,400,429")]
    [InlineData("post", "/foods/{foodId}/gallery/promote", "204,400,401,403,404,409")]
    [InlineData("post", "/recipes/{recipeId}/gallery/promote", "204,400,401,403,404,409")]
    public async Task Swagger_Operation_DeclaresExactlyTheStatusCodesItCanReturn(string method, string route, string expected)
    {
        using var client = factory.CreateClient();
        var json = await client.GetStringAsync("/swagger/v1/swagger.json", TestContext.Current.CancellationToken);
        using var document = JsonDocument.Parse(json);

        document.RootElement.GetProperty("paths").TryGetProperty(route, out var pathItem)
            .Should().BeTrue("the spec must contain {0}", route);

        var codes = pathItem.GetProperty(method).GetProperty("responses").EnumerateObject()
            .Select(response => response.Name)
            .Order(StringComparer.Ordinal)
            .ToList();

        codes.Should().Equal(expected.Split(','), "the generated client throws on an undeclared status");
    }
}
