using System.Net;
using System.Net.Http.Json;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.ClientPayments.SetClientPaymentTerms;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using static FitnessPlatform.Tests.Endpoints.ClientPayments.ClientPaymentFixtures;
using static FitnessPlatform.Tests.Endpoints.PaymentSettings.PaymentSettingsFixtures;

namespace FitnessPlatform.Tests.Endpoints.ClientPayments;

/// <summary>
/// Integration tests for PUT /payments/clients/{ClientId}/terms.
/// </summary>
[Collection(TestCollection.Name)]
public class SetClientPaymentTermsEndpointTests(FitnessApiFactory factory)
{
    [Fact]
    public async Task SetTerms_FirstTime_CreatesTheAssignmentAndThisAndNextPeriod()
    {
        var world = await CreateWorldAsync(factory);
        var packageId = await CreatePackageAsync(world.Coach, 2500m);

        var response = await SetTermsAsync(world, packageId);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await ReadAsync<SetClientPaymentTermsResponse>(response);
        body.PackageId.Should().Be(packageId);
        body.Amount.Should().Be(2500m);
        body.AppliesFromPeriodStart.Should().Be(Today);

        var rows = (await ListAsync(world)).OrderBy(p => p.PeriodStart).ToList();
        rows.Should().HaveCount(2);
        rows[0].PeriodStart.Should().Be(Today);
        rows[0].Status.Should().Be(ClientPaymentStatus.Upcoming);
        rows[0].Amount.Should().Be(2500m);
        rows[0].VariableSymbol.Should().Be($"{Today.Year}{Today.Month:D2}0001");
        rows[1].PeriodStart.Should().BeAfter(Today);
    }

    [Fact]
    public async Task SetTerms_SecondClientOfTheCoach_GetsTheNextClientNumber()
    {
        var world = await CreateWorldAsync(factory);
        var other = await AddClientAsync(world);
        var packageId = await CreatePackageAsync(world.Coach);

        await SetTermsOkAsync(world, packageId);
        var otherWorld = world with { Client = other };
        await SetTermsOkAsync(otherWorld, packageId);

        var rows = await ListAsync(otherWorld);
        rows.Select(p => p.VariableSymbol).Should().OnlyContain(symbol => symbol!.EndsWith("0002"));
    }

    [Fact]
    public async Task SetTerms_SameTermsAgain_ChangesNothing()
    {
        var world = await CreateWorldAsync(factory);
        var packageId = await CreatePackageAsync(world.Coach);
        await SetTermsOkAsync(world, packageId);

        await SetTermsOkAsync(world, packageId);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        (await db.ClientPaymentTerms.CountAsync(
            t => t.ClientPaymentAssignment.ClientProfileId == world.Client.ProfileId,
            TestContext.Current.CancellationToken)).Should().Be(1);
        (await ListAsync(world)).Should().HaveCount(2);
    }

    [Fact]
    public async Task SetTerms_ChangedPackage_AppliesFromTheNextPeriodAndKeepsTheCurrentOne()
    {
        var world = await CreateWorldAsync(factory);
        var original = await CreatePackageAsync(world.Coach, 2500m, "Online coaching");
        var cheaper = await CreatePackageAsync(world.Coach, 1000m, "Light");
        await SetTermsOkAsync(world, original);

        await SetTermsOkAsync(world, cheaper);

        var rows = (await ListAsync(world)).OrderBy(p => p.PeriodStart).ToList();
        rows[0].Amount.Should().Be(2500m, "the current period had already started when the terms changed");
        rows[0].PackageName.Should().Be("Online coaching");
        rows[1].Amount.Should().Be(1000m);
        rows[1].PackageName.Should().Be("Light");
    }

    [Fact]
    public async Task SetTerms_WithDiscount_PricesTheRowsWithIt()
    {
        var world = await CreateWorldAsync(factory);
        var packageId = await CreatePackageAsync(world.Coach, 2500m);
        var discountId = await CreateDiscountAsync(world.Coach, 30m);

        await SetTermsOkAsync(world, packageId, discountId);

        var rows = await ListAsync(world);
        rows.Should().OnlyContain(p => p.Amount == 1750m && p.BasePrice == 2500m);
        rows[0].DiscountLabel.Should().Contain("Friends & family").And.Contain("30");
    }

    [Fact]
    public async Task SetTerms_WithCustomPrice_ReplacesPackagePriceAndDiscount()
    {
        var world = await CreateWorldAsync(factory);
        var packageId = await CreatePackageAsync(world.Coach, 2500m);

        await SetTermsOkAsync(world, packageId, customPrice: 1200m);

        (await ListAsync(world)).Should().OnlyContain(p => p.Amount == 1200m);
    }

    [Fact]
    public async Task SetTerms_FirstPeriodStartInTheFuture_CreatesOnlyThatPeriod()
    {
        var world = await CreateWorldAsync(factory);
        var packageId = await CreatePackageAsync(world.Coach);
        var start = Today.AddDays(40);

        await SetTermsOkAsync(world, packageId, firstPeriodStart: start);

        var rows = await ListAsync(world);
        rows.Should().ContainSingle().Which.PeriodStart.Should().Be(start);
    }

    [Fact]
    public async Task SetTerms_FirstPeriodStartInThePast_Returns400()
    {
        var world = await CreateWorldAsync(factory);
        var packageId = await CreatePackageAsync(world.Coach);

        var response = await SetTermsAsync(world, packageId, firstPeriodStart: Today.AddDays(-5));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await ErrorCodesAsync(response)).Should().Contain("PAYMENT_START_DATE_INVALID");
    }

    [Fact]
    public async Task SetTerms_DiscountAndCustomPrice_Returns400()
    {
        var world = await CreateWorldAsync(factory);
        var packageId = await CreatePackageAsync(world.Coach);
        var discountId = await CreateDiscountAsync(world.Coach);

        var response = await SetTermsAsync(world, packageId, discountId, customPrice: 1000m);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await ErrorCodesAsync(response)).Should().Contain("PAYMENT_TERMS_DISCOUNT_AND_CUSTOM_PRICE");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(10_000_000)]
    public async Task SetTerms_CustomPriceOutsideTheRange_Returns400(int price)
    {
        var world = await CreateWorldAsync(factory);
        var packageId = await CreatePackageAsync(world.Coach);

        var response = await SetTermsAsync(world, packageId, customPrice: price);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await ErrorCodesAsync(response)).Should().Contain("PAYMENT_AMOUNT_INVALID");
    }

    [Fact]
    public async Task SetTerms_PackageOfAnotherCoach_Returns404()
    {
        var world = await CreateWorldAsync(factory);
        var otherCoach = await CreateWorldAsync(factory);
        var foreignPackage = await CreatePackageAsync(otherCoach.Coach);

        var response = await SetTermsAsync(world, foreignPackage);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task SetTerms_DiscountOfAnotherCoach_Returns404()
    {
        var world = await CreateWorldAsync(factory);
        var otherCoach = await CreateWorldAsync(factory);
        var packageId = await CreatePackageAsync(world.Coach);
        var foreignDiscount = await CreateDiscountAsync(otherCoach.Coach);

        var response = await SetTermsAsync(world, packageId, foreignDiscount);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task SetTerms_ArchivedPackage_Returns409PackageArchived()
    {
        var world = await CreateWorldAsync(factory);
        var packageId = await CreatePackageAsync(world.Coach);
        await world.Coach.Http.PostAsync($"/payments/packages/{packageId}/archive", Empty(), TestContext.Current.CancellationToken);

        var response = await SetTermsAsync(world, packageId);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ProblemCodeAsync(response)).Should().Be("PACKAGE_ARCHIVED");
    }

    [Fact]
    public async Task SetTerms_ArchivedDiscount_Returns409DiscountArchived()
    {
        var world = await CreateWorldAsync(factory);
        var packageId = await CreatePackageAsync(world.Coach);
        var discountId = await CreateDiscountAsync(world.Coach);
        await world.Coach.Http.PostAsync($"/payments/discounts/{discountId}/archive", Empty(), TestContext.Current.CancellationToken);

        var response = await SetTermsAsync(world, packageId, discountId);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ProblemCodeAsync(response)).Should().Be("DISCOUNT_ARCHIVED");
    }

    [Fact]
    public async Task SetTerms_DiscountThatDoesNotCoverThePackage_Returns409DiscountPackageInvalid()
    {
        var world = await CreateWorldAsync(factory);
        var packageId = await CreatePackageAsync(world.Coach, name: "Online coaching");
        var otherPackage = await CreatePackageAsync(world.Coach, name: "Nutrition");
        var discountId = await CreateDiscountAsync(world.Coach, packageIds: [otherPackage]);

        var response = await SetTermsAsync(world, packageId, discountId);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ProblemCodeAsync(response)).Should().Be("DISCOUNT_PACKAGE_INVALID");
    }

    [Fact]
    public async Task SetTerms_ClientWithNoLiveLink_Returns404()
    {
        var world = await CreateWorldAsync(factory);
        var stranger = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        var packageId = await CreatePackageAsync(world.Coach);

        var response = await world.Coach.Http.PutAsJsonAsync(
            $"/payments/clients/{stranger.PublicId}/terms", new { PackageId = packageId }, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task SetTerms_LinkThatGrantsNoPlanDomain_StillAllowed()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        await SubscribeAsync(factory, coach, canUsePayments: true);
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        await TestActors.Link(factory, coach, client).CanViewNutritionPlans(false).CanViewTrainingPlans(false)
            .CreateAsync(TestContext.Current.CancellationToken);
        var world = new PaymentWorld(factory, coach, client);
        var packageId = await CreatePackageAsync(coach);

        var response = await SetTermsAsync(world, packageId);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task SetTerms_CoachBelowThePaymentsTier_Returns403PaymentsNotEntitled()
    {
        var world = await CreateWorldAsync(factory);
        var packageId = await CreatePackageAsync(world.Coach);
        var unentitled = await CreateWorldAsync(factory, entitled: false);

        var response = await SetTermsAsync(unentitled, packageId);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await ProblemCodeAsync(response)).Should().Be("PAYMENTS_NOT_ENTITLED");
    }

    [Fact]
    public async Task SetTerms_CoachWhoseLastCoachRoleWasRemoved_Returns403()
    {
        var coach = await TestActors.Trainer(factory).WithRemovedCoachRoles(UserRole.Trainer)
            .CreateAsync(TestContext.Current.CancellationToken);
        await SubscribeAsync(factory, coach, canUsePayments: true);
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        await TestActors.Link(factory, coach, client).CreateAsync(TestContext.Current.CancellationToken);

        var response = await coach.Http.PutAsJsonAsync(
            $"/payments/clients/{client.PublicId}/terms", new { PackageId = Guid.NewGuid() }, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task SetTerms_AuditEntryNamesThePackageAndNeverTheClientOrAnIban()
    {
        var world = await CreateWorldAsync(factory);
        var packageId = await CreatePackageAsync(world.Coach, name: "Online coaching");

        await SetTermsOkAsync(world, packageId);

        var audit = (await ReadAuditAsync(world)).Should().ContainSingle(a => a.Action == "SetClientPaymentTerms").Subject;
        audit.NewValues.Should().Contain("Online coaching");
        audit.NewValues.Should().NotContain("Eva").And.NotContain("Svobodov").And.NotContain(ValidIban);
        audit.EntityType.Should().Be("ClientPaymentAssignment");
    }

    [Fact]
    public async Task SetTerms_ConcurrentReadsOfTheNextPeriod_CreateExactlyOneRow()
    {
        var world = await CreateWorldAsync(factory);
        var packageId = await CreatePackageAsync(world.Coach);
        await SetTermsOkAsync(world, packageId, firstPeriodStart: Today);

        // Both rows exist already; delete the future one so every reader has to recreate it at once.
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await db.ClientPayments
                .Where(p => p.ClientPaymentAssignment.ClientProfileId == world.Client.ProfileId && p.PeriodStart > Today)
                .ExecuteDeleteAsync(TestContext.Current.CancellationToken);
        }

        var responses = await Task.WhenAll(Enumerable.Range(0, 6).Select(_ =>
            world.Coach.Http.GetAsync($"{world.Route}/payments", TestContext.Current.CancellationToken)));

        responses.Should().OnlyContain(r => r.StatusCode == HttpStatusCode.OK);
        (await ListAsync(world)).Should().HaveCount(2);
    }
}
