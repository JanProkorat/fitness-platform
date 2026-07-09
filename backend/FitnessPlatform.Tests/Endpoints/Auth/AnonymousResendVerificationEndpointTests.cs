using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.Auth;

/// <summary>
/// Integration tests for the anonymous, email-keyed resend-verification endpoint (#679).
/// Covers the AC's four non-rate-limit cases: unregistered email, already-verified
/// account, a real unverified send, and the per-email resend cap — all of which must
/// return an IDENTICAL generic 200 response (no-enumeration contract).
///
/// The per-IP rate-limit case needs the full rate-limiter middleware active, which the
/// shared <see cref="FitnessApiFactory"/> disables for test isolation — that case lives
/// in <see cref="AnonymousResendVerificationRateLimitTests"/> below, backed by
/// <see cref="RateLimitEnabledFactory"/> instead.
/// </summary>
[Collection(TestCollection.Name)]
public class AnonymousResendVerificationEndpointTests(FitnessApiFactory factory)
{
    private const string Route = "/auth/resend-verification/anonymous";
    private const string GenericMessage = "If an unverified account exists for this email, a verification email has been sent.";

    private static string UniqueEmail() => $"{Guid.NewGuid():N}@anon-resend-test.com";

    [Fact]
    public async Task UnregisteredEmail_ReturnsGenericSuccess_NoEmailSent()
    {
        var client = factory.CreateClient();
        var email = UniqueEmail();

        var response = await client.PostAsJsonAsync(Route, new { Email = email }, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<GenericResult>(cancellationToken: TestContext.Current.CancellationToken);
        body!.Message.Should().Be(GenericMessage);

        FakeEmailService.SentVerifications.Should().NotContain(v => v.Email == email,
            "an unregistered email must never trigger a send");
    }

    [Fact]
    public async Task AlreadyVerifiedEmail_ReturnsGenericSuccess_NoEmailSent()
    {
        var client = factory.CreateClient();
        var email = UniqueEmail();

        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Anon", "Verified", "Client");

        // Mark the freshly-registered account as verified directly in Postgres — no need
        // to drive the real token-verification flow just to reach this state.
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstAsync(u => u.Email == email, TestContext.Current.CancellationToken);
            user.EmailConfirmed = true;
            await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var response = await client.PostAsJsonAsync(Route, new { Email = email }, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<GenericResult>(cancellationToken: TestContext.Current.CancellationToken);
        body!.Message.Should().Be(GenericMessage);

        // Only the registration send exists for this email — the resend call itself
        // must not have added a second one.
        FakeEmailService.SentVerifications.Where(v => v.Email == email).Should().ContainSingle(
            "registration sends the original email, but the resend call on an already-verified account must not send another");
    }

    [Fact]
    public async Task UnverifiedEmail_ReturnsGenericSuccess_AndSendsEmailWithValidToken()
    {
        var client = factory.CreateClient();
        var email = UniqueEmail();

        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Anon", "Unverified", "Client");

        var response = await client.PostAsJsonAsync(Route, new { Email = email }, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<GenericResult>(cancellationToken: TestContext.Current.CancellationToken);
        body!.Message.Should().Be(GenericMessage);

        // Registration sends one verification email; the resend call sends a second,
        // distinct one (prior unused tokens are invalidated by the shared token service).
        var sentForEmail = FakeEmailService.SentVerifications.Where(v => v.Email == email).ToList();
        sentForEmail.Should().HaveCount(2, "registration sends one email, the resend call sends a second");

        var resendToken = sentForEmail[1].Token;

        // Prove the token is real and valid by actually verifying with it.
        var verifyResponse = await client.PostAsJsonAsync(
            "/auth/verify-email", new { Token = resendToken }, TestContext.Current.CancellationToken);
        verifyResponse.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task ResendCapReached_ReturnsGenericSuccess_NoAdditionalEmailSent()
    {
        var client = factory.CreateClient();
        var email = UniqueEmail();

        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Anon", "Capped", "Client");

        // Bump VerificationEmailsSent to the lifetime cap (4) directly — registration
        // already incremented it to 1.
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstAsync(u => u.Email == email, TestContext.Current.CancellationToken);
            user.VerificationEmailsSent = 4;
            await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var sentBeforeResend = FakeEmailService.SentVerifications.Count(v => v.Email == email);

        var response = await client.PostAsJsonAsync(Route, new { Email = email }, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<GenericResult>(cancellationToken: TestContext.Current.CancellationToken);
        body!.Message.Should().Be(GenericMessage);

        FakeEmailService.SentVerifications.Count(v => v.Email == email).Should().Be(sentBeforeResend,
            "the per-email resend cap must suppress the send without changing the response");
    }

    [Fact]
    public async Task MalformedEmail_Returns400()
    {
        var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(Route, new { Email = "not-an-email" }, TestContext.Current.CancellationToken);

        // Well-formedness validation is allowed to differ from the no-enumeration
        // contract — it never distinguishes registered vs. unregistered emails.
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    private record GenericResult(string Message);
}

/// <summary>
/// Rate-limit AC for the anonymous resend-verification endpoint (#679). The endpoint runs
/// under <see cref="Application.Domain.Constants.AppPolicies.AuthRateLimit"/> — 10
/// requests / 15 min per IP, the same budget shared with /auth/register, /auth/login, etc.
/// Needs the full rate-limiter middleware active, so this uses
/// <see cref="RateLimitEnabledFactory"/> (defined in RateLimitPolicyTests.cs) rather than
/// the shared <see cref="FitnessApiFactory"/>, which disables rate limiting for isolation.
/// </summary>
public class AnonymousResendVerificationRateLimitTests : IAsyncLifetime
{
    private readonly RateLimitEnabledFactory _factory = new();

    private const string Route = "/auth/resend-verification/anonymous";

    // A private IP not used by RateLimitPolicyTests' own buckets, in the 10.0.0.0/8
    // trusted range so partition-key injection via X-Test-Client-IP behaves the same way.
    private const string Ip = "10.0.4.1";

    public async ValueTask InitializeAsync() => await _factory.InitializeAsync();

    public async ValueTask DisposeAsync() => await _factory.DisposeAsync();

    private HttpClient CreateClientWithIp(string ip)
    {
        var client = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });
        client.DefaultRequestHeaders.Add(TestClientIpStartupFilter.Header, ip);
        return client;
    }

    [Fact]
    public async Task ExceedingPerIpBudget_ReturnsThrottledResponse_WithoutAnAdditionalEmail()
    {
        using var client = CreateClientWithIp(Ip);

        // SentVerifications is a STATIC list shared across the whole test run (including
        // classes running concurrently in other collections) — scope every email to a
        // run-unique prefix so assertions below never see another test's traffic.
        var runId = Guid.NewGuid().ToString("N");
        string BudgetEmail(int i) => $"budget-{runId}-{i}@ratelimit-anon-test.com";
        var finalEmail = $"final-{runId}@ratelimit-anon-test.com";

        // Exhaust the shared 'auth' per-IP budget (PermitLimit = 10 per 15 min).
        for (var i = 0; i < 10; i++)
        {
            var response = await client.PostAsJsonAsync(
                Route, new { Email = BudgetEmail(i) }, TestContext.Current.CancellationToken);
            response.StatusCode.Should().NotBe(HttpStatusCode.TooManyRequests,
                $"attempt #{i + 1} should not be rate-limited yet (budget = 10)");
        }

        // The 11th call from the same IP must be blocked. The AC accepts a documented
        // 429 as the throttled response for this branch — the limiter runs before the
        // handler, so it never reaches the no-enumeration generic-200 code path at all.
        var rateLimitedResponse = await client.PostAsJsonAsync(
            Route, new { Email = finalEmail }, TestContext.Current.CancellationToken);

        rateLimitedResponse.StatusCode.Should().Be(HttpStatusCode.TooManyRequests,
            "the 11th call from the same IP must be rate-limited (budget = 10 per 15 min)");

        FakeEmailService.SentVerifications.Should().NotContain(v => v.Email == finalEmail,
            "no email should be sent for the request that got rate-limited");
    }
}
