using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;

namespace FitnessPlatform.Tests.Endpoints.WeeklyCheckIns;

/// <summary>
/// Integration tests for GET /trainer/clients/{clientUserId}/weekly-check-ins/history, read from the
/// coach's check-in form responses of the current collaboration.
/// </summary>
[Collection(TestCollection.Name)]
public class GetClientCheckInHistoryEndpointTests(FitnessApiFactory factory)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static async Task<HistoryBody> GetAsync(Actor trainer, Guid clientUserId, string query = "")
    {
        var response = await trainer.Http.GetAsync(
            $"/trainer/clients/{clientUserId}/weekly-check-ins/history{query}", Ct);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        return (await response.Content.ReadFromJsonAsync<HistoryBody>(cancellationToken: Ct))!;
    }

    [Fact]
    public async Task GetHistory_NoLink_Returns404()
    {
        var trainer = await TestActors.Trainer(factory).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);

        var response = await trainer.Http.GetAsync($"/trainer/clients/{client.UserId}/weekly-check-ins/history", Ct);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetHistory_LinkGrantsNothing_Returns403()
    {
        var trainer = await TestActors.Trainer(factory).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        await TestActors.Link(factory, trainer, client)
            .CanViewNutritionPlans(false)
            .CanViewTrainingPlans(false)
            .CreateAsync(Ct);

        var response = await trainer.Http.GetAsync($"/trainer/clients/{client.UserId}/weekly-check-ins/history", Ct);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetHistory_WeeksOutOfRange_Returns400()
    {
        var scenario = await CheckInFixtures.CreateScenarioAsync(factory);

        var response = await scenario.Coach.Http.GetAsync(
            $"/trainer/clients/{scenario.Client.UserId}/weekly-check-ins/history?weeks=27", Ct);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GetHistory_NoRows_ReturnsEightNoneWeeksOldestFirstEndingThisWeek()
    {
        var scenario = await CheckInFixtures.CreateScenarioAsync(factory);

        var body = await GetAsync(scenario.Coach, scenario.Client.UserId);

        var anchor = CheckInFixtures.Monday(0);
        body.Weeks.Should().HaveCount(8);
        body.Weeks.Select(w => w.Status).Should().OnlyContain(status => status == "none");
        body.Weeks.Select(w => w.WeekStartDate).Should().BeInAscendingOrder();
        body.Weeks[^1].WeekStartDate.Should().Be(anchor);
        body.Weeks[0].WeekStartDate.Should().Be(anchor.AddDays(-49));
        body.AnsweredCount.Should().Be(0);
        body.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task GetHistory_MixedWeeks_ReturnsStatusesCountsAndSentAt()
    {
        var scenario = await CheckInFixtures.CreateScenarioAsync(factory);

        await CheckInFixtures.AddCheckInAsync(
            factory, scenario, CheckInFixtures.Monday(0), DateTime.UtcNow.AddDays(2));
        await CheckInFixtures.AddCheckInAsync(
            factory, scenario, CheckInFixtures.Monday(1), DateTime.UtcNow.AddDays(-5),
            QuestionnaireResponseStatus.Submitted, DateTime.UtcNow.AddDays(-6));
        await CheckInFixtures.AddCheckInAsync(
            factory, scenario, CheckInFixtures.Monday(2), DateTime.UtcNow.AddHours(-1));

        var body = await GetAsync(scenario.Coach, scenario.Client.UserId, "?weeks=4");

        body.Weeks.Select(w => w.Status).Should().Equal("none", "missed", "answered", "waiting");
        body.Weeks[0].SentAt.Should().BeNull();
        body.Weeks[1..].Should().OnlyContain(w => w.SentAt != null && w.HungerScore == null);
        body.AnsweredCount.Should().Be(1);
        body.TotalCount.Should().Be(2);
    }

    [Fact]
    public async Task GetHistory_SameWeekAnsweredAndMissed_AnsweredWinsAndCountsOnce()
    {
        var scenario = await CheckInFixtures.CreateScenarioAsync(factory);
        var week = CheckInFixtures.Monday(0);

        await CheckInFixtures.AddCheckInAsync(factory, scenario, week, DateTime.UtcNow.AddHours(-3));
        await CheckInFixtures.AddCheckInAsync(
            factory, scenario, week, DateTime.UtcNow.AddHours(5),
            QuestionnaireResponseStatus.Submitted, DateTime.UtcNow.AddHours(-1));

        var body = await GetAsync(scenario.Coach, scenario.Client.UserId, "?weeks=1");

        body.Weeks.Should().ContainSingle().Which.Status.Should().Be("answered");
        body.AnsweredCount.Should().Be(1);
        body.TotalCount.Should().Be(1);
    }

    [Fact]
    public async Task GetHistory_CountsCoverRowsOutsideWindow()
    {
        var scenario = await CheckInFixtures.CreateScenarioAsync(factory);

        await CheckInFixtures.AddCheckInAsync(
            factory, scenario, CheckInFixtures.Monday(10), DateTime.UtcNow.AddDays(-69),
            QuestionnaireResponseStatus.Submitted, DateTime.UtcNow.AddDays(-69));
        await CheckInFixtures.AddCheckInAsync(
            factory, scenario, CheckInFixtures.Monday(9), DateTime.UtcNow.AddDays(-62));

        var body = await GetAsync(scenario.Coach, scenario.Client.UserId, "?weeks=1");

        body.Weeks.Should().ContainSingle().Which.Status.Should().Be("none");
        body.AnsweredCount.Should().Be(1);
        body.TotalCount.Should().Be(2);
    }

    [Fact]
    public async Task GetHistory_OtherCoachsRowsAndEarlierCollaboration_AreIgnored()
    {
        var scenario = await CheckInFixtures.CreateScenarioAsync(factory, activatedAtUtc: DateTime.UtcNow.AddDays(-3));
        var otherCoach = await CheckInFixtures.CreateScenarioAsync(factory, client: scenario.Client);
        await CheckInFixtures.AddCheckInAsync(
            factory, otherCoach, CheckInFixtures.Monday(0), DateTime.UtcNow.AddDays(2),
            QuestionnaireResponseStatus.Submitted, DateTime.UtcNow.AddHours(-2));
        await CheckInFixtures.AddCheckInAsync(
            factory, scenario, CheckInFixtures.Monday(2), DateTime.UtcNow.AddDays(-10),
            QuestionnaireResponseStatus.Submitted, DateTime.UtcNow.AddDays(-12));

        var body = await GetAsync(scenario.Coach, scenario.Client.UserId, "?weeks=1");

        body.Weeks.Should().ContainSingle().Which.Status.Should().Be("none");
        body.AnsweredCount.Should().Be(0);
        body.TotalCount.Should().Be(0);
    }

    private sealed record HistoryBody(List<WeekBody> Weeks, int AnsweredCount, int TotalCount);

    private sealed record WeekBody(DateOnly WeekStartDate, string Status, DateTime? SentAt, int? HungerScore);
}
