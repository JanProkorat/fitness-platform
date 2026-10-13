using System.Net;
using System.Net.Http.Json;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.Trainers;

/// <summary>
/// Integration tests for the nutrition-profile fields (dislikes, habits, fibre) on
/// GET /trainer/clients/{clientId}, which are gated on the nutrition link capability.
/// </summary>
[Collection(TestCollection.Name)]
public class GetClientDashboardNutritionProfileTests(FitnessApiFactory factory)
{
    private async Task SeedProfileAsync(Actor client)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var onboarding = EntityBuilder.ClientOnboardingData
            .WithGeneratedId()
            .WithClientProfileId(client.ProfileId)
            .WithDislikes("Mushrooms")
            .WithHabits("Cooks on Sundays")
            .Build();
        db.ClientOnboardingData.Add(onboarding);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);

        db.ClientNutritionTargets.Add(EntityBuilder.ClientNutritionTargets
            .WithGeneratedId()
            .WithClientOnboardingDataId(onboarding.Id)
            .WithFibreGrams(28m)
            .Build());
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task<OnboardingBody> GetOnboardingAsync(Actor trainer, Actor client)
    {
        var response = await trainer.Http.GetAsync(
            $"/trainer/clients/{client.PublicId}", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<DashboardBody>(
            cancellationToken: TestContext.Current.CancellationToken);
        return body!.Onboarding!;
    }

    [Fact]
    public async Task GetDashboard_NutritionCapability_ExposesDislikesHabitsAndFibre()
    {
        var trainer = await TestActors.Nutritionist(factory).CreateAsync(TestContext.Current.CancellationToken);
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        await TestActors.Link(factory, trainer, client).CreateAsync(TestContext.Current.CancellationToken);
        await SeedProfileAsync(client);

        var onboarding = await GetOnboardingAsync(trainer, client);

        onboarding.Dislikes.Should().Equal("Mushrooms");
        onboarding.Habits.Should().Equal("Cooks on Sundays");
        onboarding.FibreGrams.Should().Be(28m);
    }

    [Fact]
    public async Task GetDashboard_TrainingOnlyLink_HidesDislikesHabitsAndFibre()
    {
        var trainer = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        await TestActors.Link(factory, trainer, client)
            .CanViewNutritionPlans(false)
            .CreateAsync(TestContext.Current.CancellationToken);
        await SeedProfileAsync(client);

        var onboarding = await GetOnboardingAsync(trainer, client);

        onboarding.Dislikes.Should().BeNull();
        onboarding.Habits.Should().BeNull();
        onboarding.FibreGrams.Should().BeNull();
    }

    private sealed record DashboardBody(OnboardingBody? Onboarding);

    private sealed record OnboardingBody(List<string>? Dislikes, List<string>? Habits, decimal? FibreGrams);
}
