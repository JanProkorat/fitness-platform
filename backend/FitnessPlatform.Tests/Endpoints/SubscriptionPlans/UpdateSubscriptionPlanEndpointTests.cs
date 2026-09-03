using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.SubscriptionPlans.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.SubscriptionPlans;

/// <summary>
/// Integration tests for <c>PUT /admin/subscription-plans/{Code}</c>
/// (<see cref="Application.Features.SubscriptionPlans.UpdateSubscriptionPlan.UpdateSubscriptionPlanEndpoint"/>).
/// Uses <see cref="FitnessApiFactory"/> since Admin is not publicly self-registerable — the
/// only way to prove the role gate is the real ASP.NET Core pipeline.
/// </summary>
[Collection(TestCollection.Name)]
public class UpdateSubscriptionPlanEndpointTests(FitnessApiFactory factory)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() },
    };

    private static string UniqueCode() => $"tier-{Guid.NewGuid():N}"[..30];

    private async Task<string> SeedPlanAsync()
    {
        var code = UniqueCode();

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.SubscriptionPlans.Add(new SubscriptionPlan
        {
            Code = code,
            NameCs = "Původní",
            NameEn = "Original",
            NameDe = "Original",
            ApplicableRoles = ApplicableRoles.Trainer,
            Currency = "CZK",
            PriceMinorUnits = 10000,
            BillingInterval = BillingInterval.Monthly,
            MaxActiveClients = 5,
            IsActive = true,
        });
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);

        return code;
    }

    private static UpdatePlanPayload UpdatedPayload(string code) => new(
        Code: code,
        NameCs: "Aktualizováno",
        NameEn: "Updated",
        NameDe: "Aktualisiert",
        ApplicableRoles: "Both",
        CanCreatePlans: true,
        CanMessage: true,
        CanSendQuestionnaires: true,
        CanUseWeeklyCheckIns: true,
        CanUsePerClientCheckInConfig: true,
        MaxActiveClients: 20,
        PriceMinorUnits: 50000,
        Currency: "EUR",
        BillingInterval: "Annual",
        ExternalPriceId: "price_123",
        IsActive: true);

    [Fact]
    public async Task Update_ValidRequest_ChangesFields()
    {
        var client = await TestHelpers.RegisterAdminAsync(factory, TestContext.Current.CancellationToken);
        var code = await SeedPlanAsync();

        var response = await client.PutAsJsonAsync(
            $"/admin/subscription-plans/{code}", UpdatedPayload(code), TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<SubscriptionPlanDto>(
            JsonOptions, TestContext.Current.CancellationToken);
        body!.NameEn.Should().Be("Updated");
        body.Currency.Should().Be("EUR");

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var persisted = await db.SubscriptionPlans
            .AsNoTracking()
            .FirstAsync(p => p.Code == code, TestContext.Current.CancellationToken);

        persisted.NameEn.Should().Be("Updated");
        persisted.PriceMinorUnits.Should().Be(50000);
        persisted.BillingInterval.Should().Be(BillingInterval.Annual);
    }

    [Fact]
    public async Task Update_BodyIncludesDifferentCode_RouteCodeWinsAndCodeIsUnchanged()
    {
        var client = await TestHelpers.RegisterAdminAsync(factory, TestContext.Current.CancellationToken);
        var code = await SeedPlanAsync();
        var attemptedNewCode = UniqueCode();

        var response = await client.PutAsJsonAsync(
            $"/admin/subscription-plans/{code}",
            UpdatedPayload(attemptedNewCode),
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<SubscriptionPlanDto>(
            JsonOptions, TestContext.Current.CancellationToken);
        body!.Code.Should().Be(code);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        (await db.SubscriptionPlans.AsNoTracking().AnyAsync(
            p => p.Code == code, TestContext.Current.CancellationToken)).Should().BeTrue();
        (await db.SubscriptionPlans.AsNoTracking().AnyAsync(
            p => p.Code == attemptedNewCode, TestContext.Current.CancellationToken)).Should().BeFalse();
    }

    [Fact]
    public async Task Update_UnknownCode_Returns404()
    {
        var client = await TestHelpers.RegisterAdminAsync(factory, TestContext.Current.CancellationToken);
        var unknownCode = UniqueCode();

        var response = await client.PutAsJsonAsync(
            $"/admin/subscription-plans/{unknownCode}",
            UpdatedPayload(unknownCode),
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    private sealed record UpdatePlanPayload(
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
