using System.Net;
using System.Net.Http.Json;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using static FitnessPlatform.Tests.Endpoints.PaymentSettings.PaymentSettingsFixtures;

namespace FitnessPlatform.Tests.Endpoints.PaymentSettings;

/// <summary>
/// The payments entitlement gate on every coach-facing payments endpoint.
/// </summary>
[Collection(TestCollection.Name)]
public class PaymentSettingsEntitlementTests(FitnessApiFactory factory)
{
    [Theory]
    [InlineData("GET", "/payments/settings", false, SubscriptionStatus.Active)]
    [InlineData("PUT", "/payments/settings", false, SubscriptionStatus.Active)]
    [InlineData("PUT", "/payments/bank-account", false, SubscriptionStatus.Active)]
    [InlineData("POST", "/payments/bank-account/code", false, SubscriptionStatus.Active)]
    [InlineData("GET", "/payments/settings", true, SubscriptionStatus.PastDue)]
    [InlineData("PUT", "/payments/settings", true, SubscriptionStatus.Canceled)]
    [InlineData("PUT", "/payments/bank-account", true, SubscriptionStatus.Incomplete)]
    [InlineData("POST", "/payments/bank-account/code", true, SubscriptionStatus.PastDue)]
    public async Task CoachEndpoints_PlanWithoutPaymentsOrSubscriptionNotInGoodStanding_Return403(
        string method, string route, bool planAllowsPayments, SubscriptionStatus status)
    {
        var coach = await TestActors.Trainer(factory).WithPassword(Password).CreateAsync(TestContext.Current.CancellationToken);
        await SubscribeAsync(factory, coach, planAllowsPayments, status);

        using var request = new HttpRequestMessage(new HttpMethod(method), route);

        if (method == "PUT")
        {
            request.Content = JsonContent.Create(new
            {
                PaymentDueDays = 7,
                MessageFormat = "PackageName",
                VariableSymbolFormat = "YearMonthClientNumber",
                Iban = ValidIban,
                AccountHolder = "Martin Král",
                Password
            });
        }

        var response = await coach.Http.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await ProblemCodeAsync(response)).Should().Be("PAYMENTS_NOT_ENTITLED");
        (await ReadSettingsAsync(factory, coach)).Should().BeNull();
    }

    [Fact]
    public async Task CoachEndpoints_PlanWithPaymentsInGoodStanding_AreAllowed()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        await SubscribeAsync(factory, coach, canUsePayments: true, SubscriptionStatus.Trialing);

        var response = await coach.Http.GetAsync("/payments/settings", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
