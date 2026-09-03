using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.SubscriptionPlans.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.SubscriptionPlans;

/// <summary>
/// Integration tests for <c>POST /admin/subscription-plans</c>
/// (<see cref="Application.Features.SubscriptionPlans.CreateSubscriptionPlan.CreateSubscriptionPlanEndpoint"/>).
/// Uses <see cref="FitnessApiFactory"/> since Admin is not publicly self-registerable — the
/// only way to prove the role gate is the real ASP.NET Core pipeline.
/// </summary>
[Collection(TestCollection.Name)]
public class CreateSubscriptionPlanEndpointTests(FitnessApiFactory factory)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() },
    };

    private static string UniqueCode() => $"tier-{Guid.NewGuid():N}"[..30];

    private static CreatePlanPayload ValidPayload(string code) => new(
        Code: code,
        NameCs: "Malý",
        NameEn: "Small",
        NameDe: "Klein",
        ApplicableRoles: "Both",
        CanCreatePlans: true,
        CanMessage: true,
        CanSendQuestionnaires: false,
        CanUseWeeklyCheckIns: false,
        CanUsePerClientCheckInConfig: false,
        MaxActiveClients: 10,
        PriceMinorUnits: 29900,
        Currency: "CZK",
        BillingInterval: "Monthly",
        ExternalPriceId: null,
        IsActive: true);

    [Fact]
    public async Task Create_ValidRequest_PersistsPlan()
    {
        var client = await TestHelpers.RegisterAdminAsync(factory, TestContext.Current.CancellationToken);
        var code = UniqueCode();

        var response = await client.PostAsJsonAsync(
            "/admin/subscription-plans", ValidPayload(code), TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var body = await response.Content.ReadFromJsonAsync<SubscriptionPlanDto>(
            JsonOptions, TestContext.Current.CancellationToken);
        body!.Code.Should().Be(code);
        body.PriceMinorUnits.Should().Be(29900);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var persisted = await db.SubscriptionPlans
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Code == code, TestContext.Current.CancellationToken);

        persisted.Should().NotBeNull();
        persisted!.NameEn.Should().Be("Small");
        persisted.ApplicableRoles.Should().Be(ApplicableRoles.Both);
        persisted.IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task Create_DuplicateCode_Returns409()
    {
        var client = await TestHelpers.RegisterAdminAsync(factory, TestContext.Current.CancellationToken);
        var code = UniqueCode();

        var first = await client.PostAsJsonAsync(
            "/admin/subscription-plans", ValidPayload(code), TestContext.Current.CancellationToken);
        first.StatusCode.Should().Be(HttpStatusCode.Created);

        var second = await client.PostAsJsonAsync(
            "/admin/subscription-plans", ValidPayload(code), TestContext.Current.CancellationToken);

        second.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Create_InvalidCurrency_Returns400()
    {
        var client = await TestHelpers.RegisterAdminAsync(factory, TestContext.Current.CancellationToken);
        var payload = ValidPayload(UniqueCode()) with { Currency = "GBP" };

        var response = await client.PostAsJsonAsync(
            "/admin/subscription-plans", payload, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Create_NegativePrice_Returns400()
    {
        var client = await TestHelpers.RegisterAdminAsync(factory, TestContext.Current.CancellationToken);
        var payload = ValidPayload(UniqueCode()) with { PriceMinorUnits = -1 };

        var response = await client.PostAsJsonAsync(
            "/admin/subscription-plans", payload, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Create_MaxActiveClientsZero_Returns400()
    {
        var client = await TestHelpers.RegisterAdminAsync(factory, TestContext.Current.CancellationToken);
        var payload = ValidPayload(UniqueCode()) with { MaxActiveClients = 0 };

        var response = await client.PostAsJsonAsync(
            "/admin/subscription-plans", payload, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Create_ConcurrentDuplicateCode_NeverReturns500()
    {
        var client = await TestHelpers.RegisterAdminAsync(factory, TestContext.Current.CancellationToken);
        var payload = ValidPayload(UniqueCode());

        var firstCall = client.PostAsJsonAsync(
            "/admin/subscription-plans", payload, TestContext.Current.CancellationToken);
        var secondCall = client.PostAsJsonAsync(
            "/admin/subscription-plans", payload, TestContext.Current.CancellationToken);

        var responses = await Task.WhenAll(firstCall, secondCall);

        // Whichever request loses the race — caught by the AnyAsync pre-check or by the
        // unique-constraint catch on SaveChangesAsync — must surface as 409, never 500.
        responses.Should().OnlyContain(r =>
            r.StatusCode == HttpStatusCode.Created || r.StatusCode == HttpStatusCode.Conflict);
        responses.Should().ContainSingle(r => r.StatusCode == HttpStatusCode.Created);
        responses.Should().ContainSingle(r => r.StatusCode == HttpStatusCode.Conflict);
    }

    private sealed record CreatePlanPayload(
        string Code,
        string NameCs,
        string NameEn,
        string NameDe,
        string ApplicableRoles,
        bool CanCreatePlans,
        bool CanMessage,
        bool CanSendQuestionnaires,
        bool CanUseWeeklyCheckIns,
        bool CanUsePerClientCheckInConfig,
        int? MaxActiveClients,
        long PriceMinorUnits,
        string Currency,
        string BillingInterval,
        string? ExternalPriceId,
        bool IsActive);
}
