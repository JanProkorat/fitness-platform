using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FluentAssertions;
using FormUp.Application.Domain.Enums;
using FormUp.Application.Features.Users.GetMySubscription;
using FormUp.Tests.Builders;
using FormUp.Tests.Infrastructure;

namespace FormUp.Tests.Endpoints.Users;

/// <summary>
/// Integration tests for <c>GET /users/me/subscription</c> (<see cref="GetMySubscriptionEndpoint"/>).
/// </summary>
[Collection(TestCollection.Name)]
public class GetMySubscriptionEndpointTests(FitnessApiFactory factory)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() },
    };

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static async Task<GetMySubscriptionResponse> GetAsync(Actor coach)
    {
        var response = await coach.Http.GetAsync("/users/me/subscription", Ct);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        return (await response.Content.ReadFromJsonAsync<GetMySubscriptionResponse>(JsonOptions, Ct))!;
    }

    [Fact]
    public async Task Get_CoachWithoutSubscription_ShowsTheFreePlanWithoutAStatus()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        await TestActors.Link(factory, coach, client).CreateAsync(Ct);

        var block = await GetAsync(coach);

        block.PlanCode.Should().Be("free");
        block.Status.Should().BeNull();
        block.ActiveClientCount.Should().Be(1);
        block.ClientLimit.Should().Be(2);
        block.SecondRole.Should().Be(SecondRoleState.Included);
        block.PriceLines.Should().ContainSingle(line => line.Kind == SubscriptionPriceLineKind.Plan && line.AmountMinorUnits == 0);
        block.Features.CanCreatePlans.Should().BeTrue();
        block.Features.CanSendQuestionnaires.Should().BeFalse();
    }

    [Fact]
    public async Task Get_CoachOnAPaidPlanWithTheAddOn_ShowsBothPriceLinesAndThePlanLimit()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(Ct);
        await CoachSubscriptionBuilder.SubscribeToPlanAsync(factory, coach, "start", paysSecondRoleAddOn: true);

        var block = await GetAsync(coach);

        block.PlanCode.Should().Be("start");
        block.Status.Should().Be(SubscriptionStatus.Active);
        block.ClientLimit.Should().Be(10);
        block.SecondRole.Should().Be(SecondRoleState.PaidAddOn);
        block.PriceLines.Select(line => line.Kind).Should()
            .Equal(SubscriptionPriceLineKind.Plan, SubscriptionPriceLineKind.SecondRoleAddOn);
        block.PriceLines.Should().OnlyContain(line => line.Currency == "CZK" && line.AmountMinorUnits > 0);
    }

    [Fact]
    public async Task Get_CoachOnAPaidPlanWithoutTheAddOn_ShowsTheSecondRoleAsNotAvailable()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(Ct);
        await CoachSubscriptionBuilder.SubscribeToPlanAsync(factory, coach, "start");

        var block = await GetAsync(coach);

        block.SecondRole.Should().Be(SecondRoleState.NotAvailable);
        block.PriceLines.Should().ContainSingle();
    }

    [Fact]
    public async Task Get_CanceledSubscription_ShowsTheFreeFlagsUnderTheAssignedPlan()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(Ct);
        await CoachSubscriptionBuilder.SubscribeToPlanAsync(factory, coach, "studio", SubscriptionStatus.Canceled);

        var block = await GetAsync(coach);

        block.PlanCode.Should().Be("studio");
        block.Status.Should().Be(SubscriptionStatus.Canceled);
        block.Features.CanSendQuestionnaires.Should().BeFalse("a canceled subscription falls back to the Free flags");
        block.ClientLimit.Should().Be(2);
    }
}
