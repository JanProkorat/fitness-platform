using System.Net;
using System.Net.Http.Json;
using FormUp.Tests.Endpoints.Auth;
using FormUp.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;

namespace FormUp.Tests.Endpoints.Client.PushToken;

/// <summary>
/// The anonymous removal sits on its own policy (60 per 15 minutes per IP), not the auth budget. Runs on
/// <see cref="RateLimitEnabledFactory"/>, which keeps limiting on and lets a test pin the client IP.
/// </summary>
[Collection("RateLimitPolicyTests")]
public class RemovePushTokenRateLimitTests(RateLimitEnabledFactory factory)
{
    private static int _ipCounter;

    private static string UniqueIp()
    {
        var next = (uint)Interlocked.Increment(ref _ipCounter);
        return $"10.78.{(next >> 8) & 255}.{next & 255}";
    }

    private static Task<HttpResponseMessage> RemoveAsync(HttpClient client) =>
        client.PostAsJsonAsync(
            "/client/push-token/remove",
            new { token = $"ExponentPushToken[{Guid.NewGuid():N}]" },
            TestContext.Current.CancellationToken);

    [Fact]
    public async Task Remove_MoreThanSixtyRequestsFromOneIp_Returns429OnTheSixtyFirst()
    {
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        client.DefaultRequestHeaders.Add(TestClientIpStartupFilter.Header, UniqueIp());

        for (var attempt = 1; attempt <= 60; attempt++)
        {
            var response = await RemoveAsync(client);
            response.StatusCode.Should().Be(HttpStatusCode.NoContent, $"request {attempt} is within the budget");
        }

        var limited = await RemoveAsync(client);

        limited.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
    }
}
