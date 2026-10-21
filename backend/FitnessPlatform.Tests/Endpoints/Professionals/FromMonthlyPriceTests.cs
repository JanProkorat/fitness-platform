using System.Net;
using System.Net.Http.Json;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using static FitnessPlatform.Tests.Endpoints.PaymentSettings.PaymentSettingsFixtures;

namespace FitnessPlatform.Tests.Endpoints.Professionals;

/// <summary>
/// The derived "from" price on the public profile and the search list.
/// </summary>
[Collection(TestCollection.Name)]
public class FromMonthlyPriceTests(FitnessApiFactory factory)
{
    private sealed record ProfileBody(decimal? FromMonthlyPrice);

    private sealed record SearchItem(Guid PublicId, decimal? FromMonthlyPrice);

    private sealed record SearchBody(List<SearchItem> Items);

    private async Task AddPackageAsync(
        Actor coach,
        decimal price,
        PackageBillingInterval billing = PackageBillingInterval.Monthly,
        bool showOnProfile = true,
        bool archived = false)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        db.CoachPackages.Add(new CoachPackage
        {
            PublicId = Guid.NewGuid(),
            ProfessionalProfileId = coach.ProfileId,
            Name = "Package",
            Price = price,
            Billing = billing,
            IntervalWeeks = billing == PackageBillingInterval.EveryNWeeks ? 2 : null,
            ShowOnProfile = showOnProfile,
            ArchivedAt = archived ? DateTime.UtcNow : null
        });

        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task<decimal?> ReadProfilePriceAsync(Actor coach, Actor client)
    {
        var response = await client.Http.GetAsync($"/professionals/{coach.PublicId}", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        return (await response.Content.ReadFromJsonAsync<ProfileBody>(TestContext.Current.CancellationToken))!.FromMonthlyPrice;
    }

    [Fact]
    public async Task PublicProfile_SeveralMonthlyPackages_ShowsTheLowestPrice()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        await AddPackageAsync(coach, 2500m);
        await AddPackageAsync(coach, 1800m);

        (await ReadProfilePriceAsync(coach, client)).Should().Be(1800m);
    }

    [Fact]
    public async Task PublicProfile_OnlyArchivedHiddenWeeklyOrOneOffPackages_ShowsNoPrice()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        await AddPackageAsync(coach, 900m, archived: true);
        await AddPackageAsync(coach, 800m, showOnProfile: false);
        await AddPackageAsync(coach, 700m, PackageBillingInterval.EveryNWeeks);
        await AddPackageAsync(coach, 600m, PackageBillingInterval.OneOff);

        (await ReadProfilePriceAsync(coach, client)).Should().BeNull();
    }

    [Fact]
    public async Task PublicProfile_CoachNotEntitledToPayments_ShowsNoPrice()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        await AddPackageAsync(coach, 1800m);
        await SubscribeAsync(factory, coach, canUsePayments: false);

        (await ReadProfilePriceAsync(coach, client)).Should().BeNull();
    }

    [Fact]
    public async Task Search_MixedCoaches_ResolvesEachPriceInOneBatch()
    {
        var tag = Guid.NewGuid().ToString("N");
        var priced = await TestActors.Trainer(factory).WithName("Priced", $"Batch{tag}").CreateAsync(TestContext.Current.CancellationToken);
        var locked = await TestActors.Trainer(factory).WithName("Locked", $"Batch{tag}").CreateAsync(TestContext.Current.CancellationToken);
        var bare = await TestActors.Trainer(factory).WithName("Bare", $"Batch{tag}").CreateAsync(TestContext.Current.CancellationToken);
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        await AddPackageAsync(priced, 1500m);
        await AddPackageAsync(locked, 1200m);
        await SubscribeAsync(factory, locked, canUsePayments: false);

        var response = await client.Http.GetAsync($"/professionals/search?search=Batch{tag}", TestContext.Current.CancellationToken);
        var body = await response.Content.ReadFromJsonAsync<SearchBody>(TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        body!.Items.Single(i => i.PublicId == priced.PublicId).FromMonthlyPrice.Should().Be(1500m);
        body.Items.Single(i => i.PublicId == locked.PublicId).FromMonthlyPrice.Should().BeNull();
        body.Items.Single(i => i.PublicId == bare.PublicId).FromMonthlyPrice.Should().BeNull();
    }
}
