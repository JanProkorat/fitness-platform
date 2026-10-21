using System.Net;
using System.Net.Http.Json;
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

    private static Task<HttpResponseMessage> GetAsync(Actor client, Actor coach) =>
        client.Http.GetAsync($"/client/coaches/{coach.PublicId}/bank-account", TestContext.Current.CancellationToken);

    [Fact]
    public async Task Get_LinkGrantingNoPlanCapability_ReturnsTheBankDetails()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        await SetBankAccountAsync(factory, coach, ValidIban, "Martin Král");
        await TestActors.Link(factory, coach, client)
            .CanViewNutritionPlans(false)
            .CanViewTrainingPlans(false)
            .CreateAsync(TestContext.Current.CancellationToken);

        var response = await GetAsync(client, coach);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var details = await response.Content.ReadFromJsonAsync<BankDetails>(TestContext.Current.CancellationToken);
        details.Should().Be(new BankDetails(ValidIban, "Martin Král", 7));
    }

    [Theory]
    [InlineData("no link")]
    [InlineData("ended link")]
    [InlineData("no iban")]
    [InlineData("not entitled")]
    public async Task Get_NoLiveLinkNoIbanOrPaymentsLocked_Returns404(string scenario)
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);

        if (scenario != "no iban")
        {
            await SetBankAccountAsync(factory, coach, ValidIban);
        }

        if (scenario == "ended link")
        {
            await TestActors.Link(factory, coach, client).Inactive().CreateAsync(TestContext.Current.CancellationToken);
        }
        else if (scenario != "no link")
        {
            await TestActors.Link(factory, coach, client).CreateAsync(TestContext.Current.CancellationToken);
        }

        if (scenario == "not entitled")
        {
            await SubscribeAsync(factory, coach, canUsePayments: false);
        }

        var response = await GetAsync(client, coach);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
