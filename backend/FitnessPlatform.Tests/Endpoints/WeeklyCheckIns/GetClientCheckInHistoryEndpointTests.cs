using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.WeeklyCheckIns;

/// <summary>
/// Integration tests for GET /trainer/clients/{clientUserId}/weekly-check-ins/history.
/// Trainers are created with the default Europe/Prague time zone.
/// </summary>
[Collection(TestCollection.Name)]
public class GetClientCheckInHistoryEndpointTests(FitnessApiFactory factory)
{
    private static DateOnly Anchor() =>
        WeeklyCheckInScheduler.NextIsoMonday(
            TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("Europe/Prague")));

    private async Task<(Actor Trainer, Actor Client)> LinkedPairAsync()
    {
        var trainer = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        await TestActors.Link(factory, trainer, client).CreateAsync(TestContext.Current.CancellationToken);
        return (trainer, client);
    }

    private async Task InsertAsync(
        Guid clientUserId,
        Guid professionalUserId,
        DateOnly week,
        WeeklyCheckInStatus status,
        DateTime? respondedAt = null,
        DateTime? dueAt = null,
        Profession profession = Profession.Training,
        DateTime? sentAt = null)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        db.WeeklyCheckIns.Add(new WeeklyCheckIn
        {
            ClientUserId = clientUserId,
            ProfessionalUserId = professionalUserId,
            Profession = profession,
            WeekStartDate = week,
            SentAt = sentAt ?? DateTime.UtcNow.AddDays(-1),
            RespondedAt = respondedAt,
            DueAt = dueAt,
            Status = status,
            DateCreated = DateTime.UtcNow,
            DateModified = DateTime.UtcNow
        });

        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private static async Task<HistoryBody> GetAsync(Actor trainer, Guid clientUserId, string query = "")
    {
        var response = await trainer.Http.GetAsync(
            $"/trainer/clients/{clientUserId}/weekly-check-ins/history{query}",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<HistoryBody>(
            cancellationToken: TestContext.Current.CancellationToken);
        return body!;
    }

    [Fact]
    public async Task GetHistory_NoLink_Returns404()
    {
        var trainer = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);

        var response = await trainer.Http.GetAsync(
            $"/trainer/clients/{client.UserId}/weekly-check-ins/history",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetHistory_LinkGrantsNothing_Returns403()
    {
        var trainer = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        await TestActors.Link(factory, trainer, client)
            .CanViewNutritionPlans(false)
            .CanViewTrainingPlans(false)
            .CreateAsync(TestContext.Current.CancellationToken);

        var response = await trainer.Http.GetAsync(
            $"/trainer/clients/{client.UserId}/weekly-check-ins/history",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetHistory_WeeksOutOfRange_Returns400()
    {
        var (trainer, client) = await LinkedPairAsync();

        var response = await trainer.Http.GetAsync(
            $"/trainer/clients/{client.UserId}/weekly-check-ins/history?weeks=27",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GetHistory_NoRows_ReturnsEightNoneWeeksOldestFirstEndingAtAnchor()
    {
        var (trainer, client) = await LinkedPairAsync();

        var body = await GetAsync(trainer, client.UserId);

        var anchor = Anchor();
        body.Weeks.Should().HaveCount(8);
        body.Weeks.Select(w => w.Status).Should().OnlyContain(status => status == "none");
        body.Weeks.Select(w => w.WeekStartDate).Should().BeInAscendingOrder();
        body.Weeks[^1].WeekStartDate.Should().Be(anchor);
        body.Weeks[0].WeekStartDate.Should().Be(anchor.AddDays(-49));
        body.AnsweredCount.Should().Be(0);
        body.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task GetHistory_MixedWeeks_ReturnsStatusesAndCounts()
    {
        var (trainer, client) = await LinkedPairAsync();
        var anchor = Anchor();

        await InsertAsync(client.UserId, trainer.UserId, anchor, WeeklyCheckInStatus.Pending,
            dueAt: DateTime.UtcNow.AddDays(2));
        await InsertAsync(client.UserId, trainer.UserId, anchor.AddDays(-7), WeeklyCheckInStatus.Responded,
            respondedAt: DateTime.UtcNow.AddDays(-6));
        await InsertAsync(client.UserId, trainer.UserId, anchor.AddDays(-14), WeeklyCheckInStatus.Expired,
            dueAt: DateTime.UtcNow.AddDays(-12));

        var body = await GetAsync(trainer, client.UserId, "?weeks=4");

        body.Weeks.Select(w => w.Status).Should().Equal("none", "missed", "answered", "waiting");
        body.AnsweredCount.Should().Be(1);
        body.TotalCount.Should().Be(2);
    }

    [Fact]
    public async Task GetHistory_PendingPastDueAt_CountsAsMissed()
    {
        var (trainer, client) = await LinkedPairAsync();
        var anchor = Anchor();

        await InsertAsync(client.UserId, trainer.UserId, anchor, WeeklyCheckInStatus.Pending,
            dueAt: DateTime.UtcNow.AddHours(-1));

        var body = await GetAsync(trainer, client.UserId, "?weeks=1");

        body.Weeks.Should().ContainSingle().Which.Status.Should().Be("missed");
        body.TotalCount.Should().Be(1);
    }

    [Fact]
    public async Task GetHistory_CountsCoverRowsOutsideWindow()
    {
        var (trainer, client) = await LinkedPairAsync();
        var anchor = Anchor();

        await InsertAsync(client.UserId, trainer.UserId, anchor.AddDays(-70), WeeklyCheckInStatus.Responded,
            respondedAt: DateTime.UtcNow.AddDays(-69));
        await InsertAsync(client.UserId, trainer.UserId, anchor.AddDays(-63), WeeklyCheckInStatus.Expired);

        var body = await GetAsync(trainer, client.UserId, "?weeks=1");

        body.Weeks.Should().ContainSingle().Which.Status.Should().Be("none");
        body.AnsweredCount.Should().Be(1);
        body.TotalCount.Should().Be(2);
    }

    [Fact]
    public async Task GetHistory_SameWeekTwoProfessions_AnsweredWinsAndCountsOnce()
    {
        var (trainer, client) = await LinkedPairAsync();
        var anchor = Anchor();

        await InsertAsync(client.UserId, trainer.UserId, anchor, WeeklyCheckInStatus.Expired,
            profession: Profession.Training);
        await InsertAsync(client.UserId, trainer.UserId, anchor, WeeklyCheckInStatus.Responded,
            respondedAt: DateTime.UtcNow.AddHours(-3), profession: Profession.Nutrition);

        var body = await GetAsync(trainer, client.UserId, "?weeks=1");

        body.Weeks.Should().ContainSingle().Which.Status.Should().Be("answered");
        body.AnsweredCount.Should().Be(1);
        body.TotalCount.Should().Be(1);
    }

    [Fact]
    public async Task GetHistory_OtherProfessionalsRows_AreIgnored()
    {
        var (trainer, client) = await LinkedPairAsync();
        var otherTrainer = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        var anchor = Anchor();

        await InsertAsync(client.UserId, otherTrainer.UserId, anchor, WeeklyCheckInStatus.Responded,
            respondedAt: DateTime.UtcNow.AddHours(-2));

        var body = await GetAsync(trainer, client.UserId, "?weeks=1");

        body.Weeks.Should().ContainSingle().Which.Status.Should().Be("none");
        body.AnsweredCount.Should().Be(0);
        body.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task GetHistory_MixedWeeks_SentAtComesFromRowAndIsNullForNone()
    {
        var (trainer, client) = await LinkedPairAsync();
        var anchor = Anchor();
        var waitingSent = new DateTime(2030, 1, 1, 8, 0, 0, DateTimeKind.Utc);
        var answeredSent = new DateTime(2030, 1, 2, 8, 0, 0, DateTimeKind.Utc);
        var missedSent = new DateTime(2030, 1, 3, 8, 0, 0, DateTimeKind.Utc);

        await InsertAsync(client.UserId, trainer.UserId, anchor, WeeklyCheckInStatus.Pending,
            dueAt: DateTime.UtcNow.AddDays(2), sentAt: waitingSent);
        await InsertAsync(client.UserId, trainer.UserId, anchor.AddDays(-7), WeeklyCheckInStatus.Responded,
            respondedAt: DateTime.UtcNow.AddDays(-6), sentAt: answeredSent);
        await InsertAsync(client.UserId, trainer.UserId, anchor.AddDays(-14), WeeklyCheckInStatus.Expired,
            sentAt: missedSent);

        var body = await GetAsync(trainer, client.UserId, "?weeks=4");

        body.Weeks.Select(w => w.SentAt).Should().Equal(null, missedSent, answeredSent, waitingSent);
    }

    [Fact]
    public async Task GetHistory_SameWeekTwoProfessions_SentAtBelongsToWinningRow()
    {
        var (trainer, client) = await LinkedPairAsync();
        var anchor = Anchor();
        var losingSent = new DateTime(2030, 2, 1, 8, 0, 0, DateTimeKind.Utc);
        var winningSent = new DateTime(2030, 2, 2, 8, 0, 0, DateTimeKind.Utc);

        await InsertAsync(client.UserId, trainer.UserId, anchor, WeeklyCheckInStatus.Expired,
            profession: Profession.Training, sentAt: losingSent);
        await InsertAsync(client.UserId, trainer.UserId, anchor, WeeklyCheckInStatus.Responded,
            respondedAt: DateTime.UtcNow.AddHours(-3), profession: Profession.Nutrition, sentAt: winningSent);

        var body = await GetAsync(trainer, client.UserId, "?weeks=1");

        body.Weeks.Should().ContainSingle().Which.SentAt.Should().Be(winningSent);
    }

    [Fact]
    public async Task GetHistory_SameWeekTwoProfessionsBothMissed_SentAtIsTheLaterOne()
    {
        var (trainer, client) = await LinkedPairAsync();
        var anchor = Anchor();
        var earlierSent = new DateTime(2030, 3, 1, 8, 0, 0, DateTimeKind.Utc);
        var laterSent = new DateTime(2030, 3, 2, 8, 0, 0, DateTimeKind.Utc);

        await InsertAsync(client.UserId, trainer.UserId, anchor, WeeklyCheckInStatus.Expired,
            profession: Profession.Nutrition, sentAt: laterSent);
        await InsertAsync(client.UserId, trainer.UserId, anchor, WeeklyCheckInStatus.Expired,
            profession: Profession.Training, sentAt: earlierSent);

        var body = await GetAsync(trainer, client.UserId, "?weeks=1");

        var week = body.Weeks.Should().ContainSingle().Subject;
        week.Status.Should().Be("missed");
        week.SentAt.Should().Be(laterSent);
        body.TotalCount.Should().Be(1);
    }

    private sealed record HistoryBody(List<WeekBody> Weeks, int AnsweredCount, int TotalCount);

    private sealed record WeekBody(DateOnly WeekStartDate, string Status, DateTime? SentAt);
}
