using System.Net;
using System.Net.Http.Json;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using static FitnessPlatform.Tests.Endpoints.PaymentSettings.PaymentSettingsFixtures;

namespace FitnessPlatform.Tests.Endpoints.PaymentSettings;

/// <summary>
/// Integration tests for <c>GET /client/coaches/{CoachId}/bank-account</c>.
/// </summary>
[Collection(TestCollection.Name)]
public class GetCoachBankDetailsEndpointTests(FitnessApiFactory factory)
{
    private sealed record BankDetails(string Iban, string AccountHolder, int PaymentDueDays);

    private async Task<(Actor Coach, Actor Client)> CoachWithAccountAsync()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        await SetBankAccountAsync(factory, coach, ValidIban, "Martin Král");

        return (coach, client);
    }

    private static Task<HttpResponseMessage> GetAsync(Actor client, Actor coach) =>
        client.Http.GetAsync($"/client/coaches/{coach.PublicId}/bank-account", TestContext.Current.CancellationToken);

    [Fact]
    public async Task Get_LinkedClient_ReturnsTheBankDetails()
    {
        var (coach, client) = await CoachWithAccountAsync();
        await TestActors.Link(factory, coach, client).CreateAsync(TestContext.Current.CancellationToken);

        var response = await GetAsync(client, coach);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var details = await response.Content.ReadFromJsonAsync<BankDetails>(TestContext.Current.CancellationToken);
        details.Should().Be(new BankDetails(ValidIban, "Martin Král", 7));
    }

    [Fact]
    public async Task Get_LinkGrantingNoPlanCapability_StillReturnsTheBankDetails()
    {
        var (coach, client) = await CoachWithAccountAsync();
        await TestActors.Link(factory, coach, client)
            .CanViewNutritionPlans(false)
            .CanViewTrainingPlans(false)
            .CreateAsync(TestContext.Current.CancellationToken);

        var response = await GetAsync(client, coach);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Get_NoLinkOrEndedLink_Returns404(bool linkEnded)
    {
        var (coach, client) = await CoachWithAccountAsync();

        if (linkEnded)
        {
            await TestActors.Link(factory, coach, client).Inactive().CreateAsync(TestContext.Current.CancellationToken);
        }

        var response = await GetAsync(client, coach);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Get_LinkedCoachWithoutAnIban_Returns404()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        await TestActors.Link(factory, coach, client).CreateAsync(TestContext.Current.CancellationToken);

        var response = await GetAsync(client, coach);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Theory]
    [InlineData(false, SubscriptionStatus.Active)]
    [InlineData(true, SubscriptionStatus.PastDue)]
    public async Task Get_CoachWhoseSubscriptionLocksPayments_Returns404(bool canUsePayments, SubscriptionStatus status)
    {
        var (coach, client) = await CoachWithAccountAsync();
        await TestActors.Link(factory, coach, client).CreateAsync(TestContext.Current.CancellationToken);
        await SubscribeAsync(factory, coach, canUsePayments, status);

        var response = await GetAsync(client, coach);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
