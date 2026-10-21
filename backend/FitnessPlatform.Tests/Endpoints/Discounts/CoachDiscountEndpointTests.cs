using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Discounts.Shared;
using FitnessPlatform.Application.Features.CoachPackages.Shared;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using static FitnessPlatform.Tests.Endpoints.PaymentSettings.PaymentSettingsFixtures;

namespace FitnessPlatform.Tests.Endpoints.Discounts;

/// <summary>
/// Integration tests for the coach discount endpoints under /payments/discounts.
/// </summary>
[Collection(TestCollection.Name)]
public class CoachDiscountEndpointTests(FitnessApiFactory factory)
{
    private static readonly JsonSerializerOptions WireOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    private static object DiscountBody(IEnumerable<Guid>? packageIds = null, bool all = false, string name = "Spring sale") => new
    {
        Name = name,
        Type = "Percentage",
        Value = 10m,
        Duration = "EveryPayment",
        AppliesToAllPackages = all,
        PackageIds = packageIds ?? []
    };

    private async Task<Guid> CreatePackageAsync(Actor coach)
    {
        var response = await coach.Http.PostAsJsonAsync(
            "/payments/packages",
            new { Name = "Online coaching", Price = 1500m, Billing = "Monthly" },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);

        return (await response.Content.ReadFromJsonAsync<CoachPackageDto>(WireOptions, TestContext.Current.CancellationToken))!.PackageId;
    }

    private async Task<CoachDiscountDto> CreateDiscountAsync(Actor coach, object body)
    {
        var response = await coach.Http.PostAsJsonAsync("/payments/discounts", body, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);

        return (await response.Content.ReadFromJsonAsync<CoachDiscountDto>(WireOptions, TestContext.Current.CancellationToken))!;
    }

    private async Task<CoachDiscountDto> GetAsync(Actor coach, Guid discountId) =>
        (await coach.Http.GetFromJsonAsync<CoachDiscountDto>(
            $"/payments/discounts/{discountId}", WireOptions, TestContext.Current.CancellationToken))!;

    [Fact]
    public async Task Create_LimitedToOwnPackage_Returns201WithPackageIds()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        var packageId = await CreatePackageAsync(coach);

        var discount = await CreateDiscountAsync(coach, DiscountBody([packageId]));

        discount.PackageIds.Should().Equal(packageId);
        discount.AppliesToAllPackages.Should().BeFalse();
        (await GetAsync(coach, discount.DiscountId)).PackageIds.Should().Equal(packageId);
    }

    [Fact]
    public async Task Create_AppliesToAllPackages_NeedsNoPackageList()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);

        var discount = await CreateDiscountAsync(coach, DiscountBody(all: true));

        discount.AppliesToAllPackages.Should().BeTrue();
        discount.PackageIds.Should().BeEmpty();
    }

    [Fact]
    public async Task Create_InvalidBody_Returns400()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);

        var response = await coach.Http.PostAsJsonAsync(
            "/payments/discounts", DiscountBody(), TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Create_ForeignUnknownOrArchivedPackage_Returns400WithIdenticalCode()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        var other = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        var foreignPackage = await CreatePackageAsync(other);
        var archivedPackage = await CreatePackageAsync(coach);
        await coach.Http.PostAsync($"/payments/packages/{archivedPackage}/archive", JsonContent.Create(new { }), TestContext.Current.CancellationToken);

        foreach (var packageId in new[] { foreignPackage, Guid.NewGuid(), archivedPackage })
        {
            var response = await coach.Http.PostAsJsonAsync(
                "/payments/discounts", DiscountBody([packageId]), TestContext.Current.CancellationToken);

            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            (await ProblemCodeAsync(response)).Should().Be("DISCOUNT_PACKAGE_INVALID");
        }
    }

    [Fact]
    public async Task Update_ReplacesPackageList()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        var first = await CreatePackageAsync(coach);
        var second = await CreatePackageAsync(coach);
        var discount = await CreateDiscountAsync(coach, DiscountBody([first]));

        var response = await coach.Http.PutAsJsonAsync(
            $"/payments/discounts/{discount.DiscountId}",
            DiscountBody([second], name: "Renamed"),
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await GetAsync(coach, discount.DiscountId);
        updated.Name.Should().Be("Renamed");
        updated.PackageIds.Should().Equal(second);
    }

    [Fact]
    public async Task Update_ArchivedDiscount_Returns409DiscountArchived()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        var discount = await CreateDiscountAsync(coach, DiscountBody(all: true));
        await coach.Http.PostAsync($"/payments/discounts/{discount.DiscountId}/archive", JsonContent.Create(new { }), TestContext.Current.CancellationToken);

        var response = await coach.Http.PutAsJsonAsync(
            $"/payments/discounts/{discount.DiscountId}", DiscountBody(all: true), TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ProblemCodeAsync(response)).Should().Be("DISCOUNT_ARCHIVED");
    }

    [Fact]
    public async Task Archive_AlreadyArchived_Returns204()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        var discount = await CreateDiscountAsync(coach, DiscountBody(all: true));
        var url = $"/payments/discounts/{discount.DiscountId}/archive";

        var first = await coach.Http.PostAsync(url, JsonContent.Create(new { }), TestContext.Current.CancellationToken);
        var second = await coach.Http.PostAsync(url, JsonContent.Create(new { }), TestContext.Current.CancellationToken);

        first.StatusCode.Should().Be(HttpStatusCode.NoContent);
        second.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await GetAsync(coach, discount.DiscountId)).ArchivedAt.Should().NotBeNull();
    }

    [Theory]
    [InlineData("GET")]
    [InlineData("PUT")]
    [InlineData("ARCHIVE")]
    public async Task ForeignDiscount_Returns404(string operation)
    {
        var owner = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        var intruder = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        var discount = await CreateDiscountAsync(owner, DiscountBody(all: true));

        foreach (var discountId in new[] { discount.DiscountId, Guid.NewGuid() })
        {
            var response = operation switch
            {
                "GET" => await intruder.Http.GetAsync($"/payments/discounts/{discountId}", TestContext.Current.CancellationToken),
                "PUT" => await intruder.Http.PutAsJsonAsync($"/payments/discounts/{discountId}", DiscountBody(all: true), TestContext.Current.CancellationToken),
                _ => await intruder.Http.PostAsync($"/payments/discounts/{discountId}/archive", JsonContent.Create(new { }), TestContext.Current.CancellationToken)
            };

            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        (await GetAsync(owner, discount.DiscountId)).ArchivedAt.Should().BeNull();
    }

    [Theory]
    [InlineData("GET", "/payments/discounts", false, SubscriptionStatus.Active)]
    [InlineData("POST", "/payments/discounts", false, SubscriptionStatus.Active)]
    [InlineData("GET", "/payments/discounts/00000000-0000-0000-0000-000000000001", true, SubscriptionStatus.PastDue)]
    [InlineData("PUT", "/payments/discounts/00000000-0000-0000-0000-000000000001", true, SubscriptionStatus.Canceled)]
    [InlineData("POST", "/payments/discounts/00000000-0000-0000-0000-000000000001/archive", true, SubscriptionStatus.Incomplete)]
    public async Task Endpoints_NotEntitledToPayments_Return403(
        string method, string route, bool planAllowsPayments, SubscriptionStatus status)
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        await SubscribeAsync(factory, coach, planAllowsPayments, status);

        using var request = new HttpRequestMessage(new HttpMethod(method), route);

        if (method is "POST" or "PUT")
        {
            request.Content = JsonContent.Create(DiscountBody(all: true));
        }

        var response = await coach.Http.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await ProblemCodeAsync(response)).Should().Be("PAYMENTS_NOT_ENTITLED");
    }
}
