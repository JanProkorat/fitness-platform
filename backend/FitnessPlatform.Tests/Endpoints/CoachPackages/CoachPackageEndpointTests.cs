using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.CoachPackages.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using static FitnessPlatform.Tests.Endpoints.PaymentSettings.PaymentSettingsFixtures;

namespace FitnessPlatform.Tests.Endpoints.CoachPackages;

/// <summary>
/// Integration tests for the coach package endpoints under /payments/packages.
/// </summary>
[Collection(TestCollection.Name)]
public class CoachPackageEndpointTests(FitnessApiFactory factory)
{
    private static readonly JsonSerializerOptions WireOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    private static object ValidBody(decimal price = 1500m, string name = "Online coaching") => new
    {
        Name = name,
        Price = price,
        Billing = "Monthly",
        ShowOnProfile = true
    };

    private async Task<CoachPackageDto> CreateAsync(Actor coach, object? body = null)
    {
        var response = await coach.Http.PostAsJsonAsync(
            "/payments/packages", body ?? ValidBody(), TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);

        return (await response.Content.ReadFromJsonAsync<CoachPackageDto>(WireOptions, TestContext.Current.CancellationToken))!;
    }

    private async Task<List<decimal>> ReadPriceHistoryAsync(Guid packageId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        return await db.CoachPackagePrices.AsNoTracking()
            .Where(p => p.CoachPackage.PublicId == packageId)
            .OrderBy(p => p.EffectiveFromUtc).ThenBy(p => p.Id)
            .Select(p => p.Price)
            .ToListAsync(TestContext.Current.CancellationToken);
    }

    private async Task<List<(string? Old, string? New)>> ReadAuditAsync(Guid packageId, string action)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var rows = await db.AuditLogs.AsNoTracking()
            .Where(a => a.EntityId == packageId && a.Action == action)
            .ToListAsync(TestContext.Current.CancellationToken);

        return rows.Select(a => (a.OldValues, a.NewValues)).ToList();
    }

    [Fact]
    public async Task Create_ValidPackage_Returns201WithFirstPriceRowAndAuditEntry()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);

        var package = await CreateAsync(coach);

        package.Price.Should().Be(1500m);
        package.Billing.Should().Be(PackageBillingInterval.Monthly);
        (await ReadPriceHistoryAsync(package.PackageId)).Should().Equal(1500m);
        (await ReadAuditAsync(package.PackageId, "CreateCoachPackage")).Should().ContainSingle()
            .Which.New.Should().Contain("1500");
    }

    [Fact]
    public async Task Create_InvalidBody_Returns400()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);

        var response = await coach.Http.PostAsJsonAsync(
            "/payments/packages", ValidBody(price: 0m), TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Update_ChangedPrice_AddsPriceRowAndAuditsOldAndNewPrice()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        var package = await CreateAsync(coach);

        var response = await coach.Http.PutAsJsonAsync(
            $"/payments/packages/{package.PackageId}", ValidBody(price: 1800m), TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await ReadPriceHistoryAsync(package.PackageId)).Should().Equal(1500m, 1800m);

        var audit = (await ReadAuditAsync(package.PackageId, "ChangeCoachPackagePrice")).Should().ContainSingle().Subject;
        audit.Old.Should().Contain("1500");
        audit.New.Should().Contain("1800");
    }

    [Fact]
    public async Task Update_SamePrice_AddsNoPriceRowAndNoPriceAudit()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        var package = await CreateAsync(coach);

        var response = await coach.Http.PutAsJsonAsync(
            $"/payments/packages/{package.PackageId}", ValidBody(name: "Renamed"), TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await ReadPriceHistoryAsync(package.PackageId)).Should().Equal(1500m);
        (await ReadAuditAsync(package.PackageId, "ChangeCoachPackagePrice")).Should().BeEmpty();
    }

    [Fact]
    public async Task Update_ArchivedPackage_Returns409PackageArchived()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        var package = await CreateAsync(coach);
        await coach.Http.PostAsync($"/payments/packages/{package.PackageId}/archive", JsonContent.Create(new { }), TestContext.Current.CancellationToken);

        var response = await coach.Http.PutAsJsonAsync(
            $"/payments/packages/{package.PackageId}", ValidBody(price: 2000m), TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ProblemCodeAsync(response)).Should().Be("PACKAGE_ARCHIVED");
    }

    [Fact]
    public async Task Archive_AlreadyArchived_Returns204AndKeepsFirstTimestamp()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        var package = await CreateAsync(coach);
        var url = $"/payments/packages/{package.PackageId}/archive";

        var first = await coach.Http.PostAsync(url, JsonContent.Create(new { }), TestContext.Current.CancellationToken);
        var archivedAt = (await GetAsync(coach, package.PackageId)).ArchivedAt;
        var second = await coach.Http.PostAsync(url, JsonContent.Create(new { }), TestContext.Current.CancellationToken);

        first.StatusCode.Should().Be(HttpStatusCode.NoContent);
        second.StatusCode.Should().Be(HttpStatusCode.NoContent);
        archivedAt.Should().NotBeNull();
        (await GetAsync(coach, package.PackageId)).ArchivedAt.Should().Be(archivedAt);
    }

    [Theory]
    [InlineData("GET")]
    [InlineData("PUT")]
    [InlineData("ARCHIVE")]
    public async Task ForeignPackage_Returns404(string operation)
    {
        var owner = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        var intruder = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        var package = await CreateAsync(owner);
        var unknownId = Guid.NewGuid();

        foreach (var packageId in new[] { package.PackageId, unknownId })
        {
            var response = operation switch
            {
                "GET" => await intruder.Http.GetAsync($"/payments/packages/{packageId}", TestContext.Current.CancellationToken),
                "PUT" => await intruder.Http.PutAsJsonAsync($"/payments/packages/{packageId}", ValidBody(), TestContext.Current.CancellationToken),
                _ => await intruder.Http.PostAsync($"/payments/packages/{packageId}/archive", JsonContent.Create(new { }), TestContext.Current.CancellationToken)
            };

            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        (await GetAsync(owner, package.PackageId)).ArchivedAt.Should().BeNull();
    }

    [Fact]
    public async Task List_ReturnsOnlyOwnActivePackages_ArchivedOnRequest()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        var other = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        var active = await CreateAsync(coach, ValidBody(name: "Active"));
        var archived = await CreateAsync(coach, ValidBody(name: "Archived"));
        await CreateAsync(other);
        await coach.Http.PostAsync($"/payments/packages/{archived.PackageId}/archive", JsonContent.Create(new { }), TestContext.Current.CancellationToken);

        var activeOnly = await coach.Http.GetFromJsonAsync<ListBody>("/payments/packages", WireOptions, TestContext.Current.CancellationToken);
        var everything = await coach.Http.GetFromJsonAsync<ListBody>("/payments/packages?includeArchived=true", WireOptions, TestContext.Current.CancellationToken);

        activeOnly!.Items.Select(p => p.PackageId).Should().Equal(active.PackageId);
        everything!.Items.Select(p => p.PackageId).Should().Equal(active.PackageId, archived.PackageId);
    }

    [Theory]
    [InlineData("GET", "/payments/packages", false, SubscriptionStatus.Active)]
    [InlineData("POST", "/payments/packages", false, SubscriptionStatus.Active)]
    [InlineData("GET", "/payments/packages/00000000-0000-0000-0000-000000000001", true, SubscriptionStatus.PastDue)]
    [InlineData("PUT", "/payments/packages/00000000-0000-0000-0000-000000000001", true, SubscriptionStatus.Canceled)]
    [InlineData("POST", "/payments/packages/00000000-0000-0000-0000-000000000001/archive", true, SubscriptionStatus.Incomplete)]
    public async Task Endpoints_NotEntitledToPayments_Return403(
        string method, string route, bool planAllowsPayments, SubscriptionStatus status)
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        await SubscribeAsync(factory, coach, planAllowsPayments, status);

        using var request = new HttpRequestMessage(new HttpMethod(method), route);

        if (method is "POST" or "PUT")
        {
            request.Content = JsonContent.Create(ValidBody());
        }

        var response = await coach.Http.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await ProblemCodeAsync(response)).Should().Be("PAYMENTS_NOT_ENTITLED");
    }

    private async Task<CoachPackageDto> GetAsync(Actor coach, Guid packageId) =>
        (await coach.Http.GetFromJsonAsync<CoachPackageDto>(
            $"/payments/packages/{packageId}", WireOptions, TestContext.Current.CancellationToken))!;

    private sealed record ListBody(List<CoachPackageDto> Items);
}
