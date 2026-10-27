using System.Net;
using System.Net.Http.Json;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.Client.Collaborations;

/// <summary>
/// Integration tests for the check-in days of <c>GET /client/collaborations</c>.
/// </summary>
[Collection(TestCollection.Name)]
public class GetCollaborationsCheckInIntegrationTests(FitnessApiFactory factory)
{
    private record CollaborationsResult(List<CollaborationItem> Collaborations);

    private record CollaborationItem(Guid ProfessionalPublicId, List<CheckInItem> CheckIns);

    private record CheckInItem(string Profession, string DayOfWeek);

    private async Task<(Actor Coach, Actor Client)> LinkedPairAsync(bool nutrition = true, bool training = true)
    {
        var ct = TestContext.Current.CancellationToken;
        var coach = await TestActors.Professional(factory, UserRole.Trainer, UserRole.Nutritionist).CreateAsync(ct);
        var client = await TestActors.Client(factory).CreateAsync(ct);
        await TestActors.Link(factory, coach, client)
            .CanViewNutritionPlans(nutrition)
            .CanViewTrainingPlans(training)
            .CreateAsync(ct);

        return (coach, client);
    }

    private async Task AddSettingAsync(Actor coach, Profession profession, DayOfWeek day, bool enabled = true)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.WeeklyCheckInSettings.Add(new WeeklyCheckInSetting
        {
            UserId = coach.UserId,
            Profession = profession,
            DayOfWeek = day,
            TimeOfDay = TimeSpan.FromHours(8),
            Enabled = enabled,
            DateCreated = DateTime.UtcNow,
            DateModified = DateTime.UtcNow
        });
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task AddOverrideAsync(Actor coach, Actor client, Profession profession, DayOfWeek? day, bool? enabled = null)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.WeeklyCheckInClientOverrides.Add(new WeeklyCheckInClientOverride
        {
            ProfessionalUserId = coach.UserId,
            ClientUserId = client.UserId,
            Profession = profession,
            DayOfWeek = day,
            Enabled = enabled,
            DateCreated = DateTime.UtcNow,
            DateModified = DateTime.UtcNow
        });
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task<List<CheckInItem>> GetCheckInsAsync(Actor client, Actor coach)
    {
        var ct = TestContext.Current.CancellationToken;
        var response = await client.Http.GetAsync("/client/collaborations", ct);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<CollaborationsResult>(cancellationToken: ct);

        return body!.Collaborations.Single(c => c.ProfessionalPublicId == coach.PublicId).CheckIns;
    }

    [Fact]
    public async Task GetAll_SettingEnabledWithoutOverride_ReturnsSettingDay()
    {
        var (coach, client) = await LinkedPairAsync();
        await AddSettingAsync(coach, Profession.Training, DayOfWeek.Wednesday);

        var checkIns = await GetCheckInsAsync(client, coach);

        checkIns.Should().ContainSingle().Which.Should().Be(new CheckInItem("Training", "Wednesday"));
    }

    [Fact]
    public async Task GetAll_OverrideHasDay_OverrideDayWins()
    {
        var (coach, client) = await LinkedPairAsync();
        await AddSettingAsync(coach, Profession.Training, DayOfWeek.Wednesday);
        await AddOverrideAsync(coach, client, Profession.Training, DayOfWeek.Friday);

        var checkIns = await GetCheckInsAsync(client, coach);

        checkIns.Should().ContainSingle().Which.DayOfWeek.Should().Be("Friday");
    }

    [Fact]
    public async Task GetAll_SettingDisabledEvenWithEnabledOverride_ReturnsNoEntry()
    {
        var (coach, client) = await LinkedPairAsync();
        await AddSettingAsync(coach, Profession.Training, DayOfWeek.Wednesday, enabled: false);
        await AddOverrideAsync(coach, client, Profession.Training, DayOfWeek.Friday, enabled: true);

        (await GetCheckInsAsync(client, coach)).Should().BeEmpty();
    }

    [Fact]
    public async Task GetAll_OverrideDisablesEnabledSetting_ReturnsNoEntry()
    {
        var (coach, client) = await LinkedPairAsync();
        await AddSettingAsync(coach, Profession.Training, DayOfWeek.Wednesday);
        await AddOverrideAsync(coach, client, Profession.Training, null, enabled: false);

        (await GetCheckInsAsync(client, coach)).Should().BeEmpty();
    }

    [Fact]
    public async Task GetAll_NoSettingRow_ReturnsNoEntry()
    {
        var (coach, client) = await LinkedPairAsync();

        (await GetCheckInsAsync(client, coach)).Should().BeEmpty();
    }

    [Fact]
    public async Task GetAll_TrainingOnlyLinkOfDualRoleCoach_OmitsNutritionCheckIn()
    {
        var (coach, client) = await LinkedPairAsync(nutrition: false, training: true);
        await AddSettingAsync(coach, Profession.Training, DayOfWeek.Monday);
        await AddSettingAsync(coach, Profession.Nutrition, DayOfWeek.Thursday);

        var checkIns = await GetCheckInsAsync(client, coach);

        checkIns.Should().ContainSingle().Which.Profession.Should().Be("Training");
    }

    [Fact]
    public async Task GetAll_TwoClientsOfOneCoach_EachSeesOnlyOwnOverride()
    {
        var ct = TestContext.Current.CancellationToken;
        var (coach, client) = await LinkedPairAsync();
        var otherClient = await TestActors.Client(factory).CreateAsync(ct);
        await TestActors.Link(factory, coach, otherClient).CanViewTrainingPlans().CreateAsync(ct);
        await AddSettingAsync(coach, Profession.Training, DayOfWeek.Wednesday);
        await AddOverrideAsync(coach, otherClient, Profession.Training, DayOfWeek.Saturday);

        var own = await GetCheckInsAsync(client, coach);
        var theirs = await GetCheckInsAsync(otherClient, coach);

        own.Should().ContainSingle().Which.DayOfWeek.Should().Be("Wednesday");
        theirs.Should().ContainSingle().Which.DayOfWeek.Should().Be("Saturday");
    }
}
