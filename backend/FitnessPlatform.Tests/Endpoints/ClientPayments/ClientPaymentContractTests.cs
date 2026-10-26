using System.Text.Json;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;

namespace FitnessPlatform.Tests.Endpoints.ClientPayments;

/// <summary>
/// Swagger contract of the client payment endpoints, which the generated clients are built from and the
/// integration tests (calling routes directly) cannot see.
/// </summary>
[Collection(TestCollection.Name)]
public class ClientPaymentContractTests(FitnessApiFactory factory)
{
    [Fact]
    public async Task Swagger_ClientPaymentRoutes_UseCamelCasePlaceholdersAndTheOneOffPostDeclares201Only()
    {
        using var client = factory.CreateClient();
        var json = await client.GetStringAsync("/swagger/v1/swagger.json", TestContext.Current.CancellationToken);
        using var document = JsonDocument.Parse(json);
        var paths = document.RootElement.GetProperty("paths");

        // NSwag sends a PascalCase placeholder literally, so every route must be listed under its camelCase form.
        (string Route, string Verb)[] expected =
        [
            ("/payments/clients/{clientId}/summary", "get"),
            ("/payments/clients/{clientId}/payments", "get"),
            ("/payments/clients/{clientId}/history", "get"),
            ("/payments/clients/{clientId}/terms", "put"),
            ("/payments/clients/{clientId}/one-off", "post"),
            ("/payments/clients/{clientId}/payments/{paymentId}/mark-paid", "post"),
            ("/payments/clients/{clientId}/payments/{paymentId}/waive", "post"),
            ("/payments/clients/{clientId}/payments/{paymentId}/request", "post"),
            ("/client/payments", "get"),
            ("/client/payments/{paymentId}", "get")
        ];

        foreach (var (route, verb) in expected)
        {
            paths.TryGetProperty(route, out var pathItem).Should().BeTrue("the spec must contain {0}", route);
            pathItem.TryGetProperty(verb, out _).Should().BeTrue("{0} must be a {1}", route, verb);
        }

        // The generated client only accepts the statuses the spec declares.
        var responses = paths.GetProperty("/payments/clients/{clientId}/one-off").GetProperty("post").GetProperty("responses");
        responses.TryGetProperty("201", out _).Should().BeTrue();
        responses.TryGetProperty("200", out _).Should().BeFalse();
    }
}
