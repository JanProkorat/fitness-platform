using System.Text.Json;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;

namespace FitnessPlatform.Tests.Endpoints.ClientPayments;

/// <summary>
/// Swagger contract of the client payment endpoints: every route is in the spec under the expected verb, and
/// the one that creates a payment declares 201 and not 200, which the generated clients need.
/// </summary>
[Collection(TestCollection.Name)]
public class ClientPaymentContractTests(FitnessApiFactory factory)
{
    private async Task<JsonElement> PathsAsync()
    {
        using var client = factory.CreateClient();
        var json = await client.GetStringAsync("/swagger/v1/swagger.json", TestContext.Current.CancellationToken);

        return JsonDocument.Parse(json).RootElement.GetProperty("paths").Clone();
    }

    [Theory]
    [InlineData("/payments/clients/{clientId}/summary", "get")]
    [InlineData("/payments/clients/{clientId}/payments", "get")]
    [InlineData("/payments/clients/{clientId}/history", "get")]
    [InlineData("/payments/clients/{clientId}/terms", "put")]
    [InlineData("/payments/clients/{clientId}/one-off", "post")]
    [InlineData("/payments/clients/{clientId}/payments/{paymentId}/mark-paid", "post")]
    [InlineData("/payments/clients/{clientId}/payments/{paymentId}/waive", "post")]
    [InlineData("/payments/clients/{clientId}/payments/{paymentId}/request", "post")]
    [InlineData("/client/payments", "get")]
    [InlineData("/client/payments/{paymentId}", "get")]
    public async Task Swagger_ContainsTheRouteUnderTheExpectedVerb(string route, string verb)
    {
        var paths = await PathsAsync();

        paths.TryGetProperty(route, out var pathItem).Should().BeTrue("the spec must contain {0}", route);
        pathItem.TryGetProperty(verb, out _).Should().BeTrue();
    }

    [Fact]
    public async Task Swagger_OneOffPayment_DeclaresCreatedAndNotOk()
    {
        var paths = await PathsAsync();

        var responses = paths.GetProperty("/payments/clients/{clientId}/one-off").GetProperty("post").GetProperty("responses");

        responses.TryGetProperty("201", out _).Should().BeTrue();
        responses.TryGetProperty("200", out _).Should().BeFalse();
    }
}
