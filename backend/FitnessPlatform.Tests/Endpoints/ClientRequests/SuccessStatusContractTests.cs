using System.Text.Json;
using System.Text.RegularExpressions;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;

namespace FitnessPlatform.Tests.Endpoints.ClientRequests;

/// <summary>
/// Swagger contract for the invite, request and notification endpoints the client apps call: the
/// generated client only accepts statuses the spec declares, so each endpoint must declare exactly
/// the success status it sends, and every path placeholder must match a declared path parameter.
/// </summary>
[Collection(TestCollection.Name)]
public class SuccessStatusContractTests(FitnessApiFactory factory)
{
    [Theory]
    [InlineData("post", "/client/requests", "201")]
    [InlineData("post", "/client/invites/{id}/accept", "204")]
    [InlineData("post", "/client/invites/{id}/decline", "204")]
    [InlineData("delete", "/trainer/pending-invites/{id}", "204")]
    [InlineData("post", "/client/notifications/{id}/read", "204")]
    [InlineData("post", "/client/notifications/read-all", "204")]
    [InlineData("post", "/client/push-token", "204")]
    [InlineData("delete", "/client/push-token", "204")]
    [InlineData("get", "/trainer/client-requests", "200")]
    [InlineData("post", "/trainer/client-requests/{publicId}/accept", "204")]
    [InlineData("post", "/trainer/client-requests/{publicId}/reject", "204")]
    [InlineData("get", "/client/invites", "200")]
    [InlineData("get", "/client/notifications", "200")]
    [InlineData("get", "/professionals/search", "200")]
    [InlineData("get", "/professionals/{publicId}", "200")]
    public async Task Swagger_Endpoint_DeclaresExactlyTheSuccessStatusItSends(string method, string route, string expected)
    {
        using var client = factory.CreateClient();
        var json = await client.GetStringAsync("/swagger/v1/swagger.json", TestContext.Current.CancellationToken);
        using var document = JsonDocument.Parse(json);

        document.RootElement.GetProperty("paths").TryGetProperty(route, out var pathItem)
            .Should().BeTrue("the spec must contain {0}", route);
        var operation = pathItem.GetProperty(method);

        var success = operation.GetProperty("responses").EnumerateObject()
            .Select(r => r.Name).Where(code => code.StartsWith('2')).ToList();
        success.Should().Equal([expected], "the generated client throws on an undeclared success status");

        var placeholders = Regex.Matches(route, "{([^}]+)}").Select(m => m.Groups[1].Value).ToList();
        var declared = operation.TryGetProperty("parameters", out var parameters)
            ? parameters.EnumerateArray()
                .Where(p => p.GetProperty("in").GetString() == "path")
                .Select(p => p.GetProperty("name").GetString()!)
                .ToList()
            : [];
        declared.Should().BeEquivalentTo(placeholders, "a placeholder differing in case is sent literally by the client");
    }
}
