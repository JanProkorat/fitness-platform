using System.Net;
using System.Net.Http.Json;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.WeeklyCheckIns;

/// <summary>
/// Integration tests for the hunger score exposed by GET /trainer/weekly-check-ins/{id}.
/// </summary>
[Collection(TestCollection.Name)]
public class GetCheckInDetailHungerScoreTests(FitnessApiFactory factory)
{
    private async Task<(Actor Trainer, Guid CheckInId)> SeedAsync(int? hungerScore)
    {
        var trainer = await TestActors.Nutritionist(factory).CreateAsync(TestContext.Current.CancellationToken);
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var checkIn = new WeeklyCheckIn
        {
            ClientUserId = client.UserId,
            ProfessionalUserId = trainer.UserId,
            Profession = Profession.Nutrition,
            WeekStartDate = DateOnly.FromDateTime(DateTime.UtcNow),
            SentAt = DateTime.UtcNow.AddHours(-2),
            RespondedAt = DateTime.UtcNow,
            Status = WeeklyCheckInStatus.Responded,
            HungerScore = hungerScore,
            DateCreated = DateTime.UtcNow,
            DateModified = DateTime.UtcNow
        };
        db.WeeklyCheckIns.Add(checkIn);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        return (trainer, checkIn.Id);
    }

    [Theory]
    [InlineData(2)]
    [InlineData(null)]
    public async Task GetDetail_ReturnsStoredHungerScore(int? hungerScore)
    {
        var (trainer, checkInId) = await SeedAsync(hungerScore);

        var response = await trainer.Http.GetAsync(
            $"/trainer/weekly-check-ins/{checkInId}", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<DetailBody>(
            cancellationToken: TestContext.Current.CancellationToken);
        body!.HungerScore.Should().Be(hungerScore);
    }

    private sealed record DetailBody(int? HungerScore);
}
