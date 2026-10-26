using System.Net;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using static FitnessPlatform.Tests.Endpoints.ClientPayments.ClientPaymentFixtures;
using static FitnessPlatform.Tests.Endpoints.PaymentSettings.PaymentSettingsFixtures;

namespace FitnessPlatform.Tests.Endpoints.Professionals;

/// <summary>
/// Integration tests for the packages and contact details GET /professionals/{publicId} adds for a client.
/// </summary>
[Collection(TestCollection.Name)]
public class GetPublicProfilePackagesTests(FitnessApiFactory factory)
{
    private record ProfilePackage(
        string Name, PackageBillingInterval Billing, int? IntervalWeeks, int? RunsForPayments, string? Description,
        decimal Price, PaymentCurrency Currency);

    private record ProfileCertificate(string Title, string? Issuer, string? Year);

    private record PublicProfile(
        List<string> Certificates,
        List<ProfileCertificate> CertificateDetails,
        List<ProfilePackage> Packages,
        string? ContactEmail,
        string? ContactPhone);

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static async Task<PublicProfile> ReadProfileAsync(Actor client, Actor coach)
    {
        var response = await client.Http.GetAsync($"/professionals/{coach.PublicId}", Ct);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        return await ReadAsync<PublicProfile>(response);
    }

    [Fact]
    public async Task GetPublicProfile_ListsOnlyTheShownPackagesAndGivesContactOnlyToALinkedClient()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(Ct);
        await SubscribeAsync(factory, coach, canUsePayments: true);
        var shown = await CreatePackageAsync(coach, 1800m, "Coaching", runsFor: 12);
        var archived = await CreatePackageAsync(coach, 100m, "Archived");
        var hidden = await CreatePackageAsync(coach, 200m, "Hidden");
        await CreatePackageAsync(coach, 50m, "Euro", currency: "EUR");
        await coach.Http.PostAsync($"/payments/packages/{archived}/archive", Empty(), Ct);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            (await db.CoachPackages.SingleAsync(p => p.PublicId == hidden, Ct)).ShowOnProfile = false;
            (await db.Users.SingleAsync(u => u.Id == coach.UserId, Ct)).PhoneNumber = "+420123456789";
            await db.SaveChangesAsync(Ct);
        }

        var client = await TestActors.Client(factory).CreateAsync(Ct);

        var unlinked = await ReadProfileAsync(client, coach);

        unlinked.Packages.Should().ContainSingle().Which.Should().BeEquivalentTo(
            new ProfilePackage("Coaching", PackageBillingInterval.Monthly, null, 12, null, 1800m, PaymentCurrency.CZK));
        unlinked.ContactEmail.Should().BeNull();
        unlinked.ContactPhone.Should().BeNull();

        await TestActors.Link(factory, coach, client).CreateAsync(Ct);

        var linked = await ReadProfileAsync(client, coach);

        linked.ContactEmail.Should().Be(coach.Email);
        linked.ContactPhone.Should().Be("+420123456789");
        linked.Packages.Select(p => p.Name).Should().Equal("Coaching");
    }

    [Fact]
    public async Task GetPublicProfile_EndedLink_DoesNotRevealContactDetails()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        await TestActors.Link(factory, coach, client).CreateAsync(Ct);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            (await db.Users.SingleAsync(u => u.Id == coach.UserId, Ct)).PhoneNumber = "+420123456789";
            await db.SaveChangesAsync(Ct);
        }

        (await ReadProfileAsync(client, coach)).ContactEmail.Should().Be(coach.Email);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await db.ClientProfessionalLinks
                .Where(l => l.ProfessionalProfileId == coach.ProfileId)
                .ExecuteUpdateAsync(s => s.SetProperty(l => l.IsActive, false), Ct);
        }

        var ended = await ReadProfileAsync(client, coach);

        ended.ContactEmail.Should().BeNull();
        ended.ContactPhone.Should().BeNull();
    }

    [Fact]
    public async Task GetPublicProfile_CoachWithoutPayments_ListsNoPackages()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(Ct);
        await SubscribeAsync(factory, coach, canUsePayments: true);
        await CreatePackageAsync(coach);
        await SetSubscriptionLockedAsync(coach);
        var client = await TestActors.Client(factory).CreateAsync(Ct);

        (await ReadProfileAsync(client, coach)).Packages.Should().BeEmpty();
    }

    [Fact]
    public async Task GetPublicProfile_ObjectCertificates_ExposeIssuerAndYearNextToTheUnchangedTitles()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var profile = await db.ProfessionalProfiles.SingleAsync(p => p.UserId == coach.UserId, Ct);
            profile.Certificates = """["Legacy",{"title":"NASM CPT","issuer":"NASM","year":"2021"},{"title":"Numeric","year":2019},{"title":"Bare","issuer":""}]""";
            await db.SaveChangesAsync(Ct);
        }

        var profileBody = await ReadProfileAsync(client, coach);

        profileBody.Certificates.Should().Equal("Legacy", "NASM CPT", "Numeric", "Bare");
        profileBody.CertificateDetails.Should().BeEquivalentTo(
            [
                new ProfileCertificate("Legacy", null, null),
                new ProfileCertificate("NASM CPT", "NASM", "2021"),
                new ProfileCertificate("Numeric", null, "2019"),
                new ProfileCertificate("Bare", null, null)
            ],
            options => options.WithStrictOrdering());
    }

    private async Task SetSubscriptionLockedAsync(Actor coach)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        (await db.CoachSubscriptions.SingleAsync(cs => cs.ProfessionalProfileId == coach.ProfileId, Ct)).Status = SubscriptionStatus.Canceled;
        await db.SaveChangesAsync(Ct);
    }
}
