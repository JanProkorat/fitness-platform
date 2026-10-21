using System.Net;
using System.Net.Http.Json;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.Trainers;

/// <summary>
/// <c>GET /trainer/client-requests</c>: a pending requester's onboarding answers are visible to the
/// addressed coach only, and never after the request is answered.
/// </summary>
[Collection(TestCollection.Name)]
public class GetIncomingRequestsOnboardingTests(FitnessApiFactory factory)
{
    private record ListResult(List<RequestItem> Requests);

    private record RequestItem(
        Guid PublicId, Guid ClientPublicId, decimal? HeightCm, decimal? WeightKg,
        string? PrimaryGoal, string? DerivedActivityLevel);

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private async Task<(Actor Client, Actor Coach)> RequestWithOnboardingAsync()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var profile = await db.ClientProfiles.FirstAsync(p => p.Id == client.ProfileId, Ct);
            profile.HeightCm = 181m;
            profile.WeightKg = 82.5m;
            profile.OnboardingData = new ClientOnboardingData
            {
                HeightCm = 181m,
                WeightKg = 82.5m,
                PrimaryGoal = PrimaryGoal.LoseFat,
                NutritionTargets = new ClientNutritionTargets { DerivedActivityLevel = ActivityLevel.ModeratelyActive },
            };
            await db.SaveChangesAsync(Ct);
        }

        (await client.Http.PostAsJsonAsync("/client/requests", new { ProfessionalPublicId = coach.PublicId }, Ct))
            .StatusCode.Should().Be(HttpStatusCode.Created);
        return (client, coach);
    }

    private static async Task<List<RequestItem>> ListAsync(Actor coach)
    {
        var response = await coach.Http.GetAsync("/trainer/client-requests", Ct);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        return (await response.Content.ReadFromJsonAsync<ListResult>(cancellationToken: Ct))!.Requests;
    }

    [Fact]
    public async Task AddresseeCoach_SeesClientIdAndOnboardingAnswers()
    {
        var (client, coach) = await RequestWithOnboardingAsync();

        var item = (await ListAsync(coach)).Should().ContainSingle().Subject;

        item.ClientPublicId.Should().Be(client.PublicId);
        item.HeightCm.Should().Be(181m);
        item.WeightKg.Should().Be(82.5m);
        item.PrimaryGoal.Should().Be(PrimaryGoal.LoseFat.ToString());
        item.DerivedActivityLevel.Should().Be(ActivityLevel.ModeratelyActive.ToString());
    }

    [Fact]
    public async Task AnotherCoach_DoesNotSeeTheRequestOrItsAnswers()
    {
        await RequestWithOnboardingAsync();
        var other = await TestActors.Trainer(factory).CreateAsync(Ct);

        (await ListAsync(other)).Should().BeEmpty();
    }

    [Theory]
    [InlineData(ClientRequestStatus.Accepted)]
    [InlineData(ClientRequestStatus.Rejected)]
    [InlineData(ClientRequestStatus.Cancelled)]
    public async Task AnsweredRequest_IsNotListed_SoAnswersDoNotLeak(ClientRequestStatus status)
    {
        var (client, coach) = await RequestWithOnboardingAsync();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var request = await db.ClientRequests.SingleAsync(r => r.ClientProfileId == client.ProfileId, Ct);
            request.Status = status;
            await db.SaveChangesAsync(Ct);
        }

        (await ListAsync(coach)).Should().BeEmpty();
    }

    [Fact]
    public async Task ClientWithoutOnboarding_HasNullAnswers()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        (await client.Http.PostAsJsonAsync("/client/requests", new { ProfessionalPublicId = coach.PublicId }, Ct))
            .StatusCode.Should().Be(HttpStatusCode.Created);

        var item = (await ListAsync(coach)).Should().ContainSingle().Subject;

        item.PrimaryGoal.Should().BeNull();
        item.DerivedActivityLevel.Should().BeNull();
    }
}
