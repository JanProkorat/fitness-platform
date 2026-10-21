using System.Net;
using System.Net.Http.Json;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FluentAssertions;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.WeeklyCheckIns;

/// <summary>
/// Integration tests for GET /client/weekly-check-ins/history.
/// Uses Testcontainers PostgreSQL (Docker required).
/// </summary>
[Collection(TestCollection.Name)]
public class GetMyCheckInHistoryEndpointTests(FitnessApiFactory factory)
{
    private const string Route = "/client/weekly-check-ins/history";

    private async Task<Guid> InsertAsync(
        Guid clientUserId,
        Guid professionalUserId,
        Profession profession,
        DateOnly weekStartDate,
        DateTime sentAt,
        WeeklyCheckInStatus status = WeeklyCheckInStatus.Pending,
        DateTime? respondedAt = null,
        DateTime? dismissedAt = null,
        Guid? id = null,
        DateTime? dueAt = null,
        DateTime? reviewedAt = null)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var checkIn = new WeeklyCheckIn
        {
            Id = id ?? Guid.NewGuid(),
            ClientUserId = clientUserId,
            ProfessionalUserId = professionalUserId,
            Profession = profession,
            WeekStartDate = weekStartDate,
            SentAt = sentAt,
            Status = status,
            RespondedAt = respondedAt,
            DismissedByClientAt = dismissedAt,
            DueAt = dueAt,
            ReviewedByTrainerAt = reviewedAt,
            Flags = [CheckInFlag.Traveling],
            Note = "private note",
            HungerScore = 4,
            DateCreated = DateTime.UtcNow,
            DateModified = DateTime.UtcNow,
        };
        db.WeeklyCheckIns.Add(checkIn);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        return checkIn.Id;
    }

    private static DateOnly Monday(int weeksAgo)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var days = ((int)today.DayOfWeek - (int)DayOfWeek.Monday + 7) % 7;
        return today.AddDays(-days - (7 * weeksAgo));
    }

    [Fact]
    public async Task GetHistory_NoCheckIns_ReturnsEmptyListAndZeroTotal()
    {
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);

        var response = await client.Http.GetAsync(Route, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Headers.GetValues("X-Total-Count").Single().Should().Be("0");
        var body = await response.Content.ReadFromJsonAsync<HistoryBody>(
            cancellationToken: TestContext.Current.CancellationToken);
        body!.Items.Should().BeEmpty();
    }

    [Fact]
    public async Task GetHistory_ReturnsOnlyCallersOwnCheckIns_AllStatuses_WithoutPrivateFields()
    {
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        var other = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        var trainer = await TestActors.Trainer(factory).WithName("Tom", "Coach").CreateAsync(TestContext.Current.CancellationToken);

        var dueAt = DateTime.UtcNow.AddDays(-12);
        var reviewedAt = DateTime.UtcNow.AddDays(-11);
        var answeredId = await InsertAsync(client.UserId, trainer.UserId, Profession.Training, Monday(2),
            DateTime.UtcNow.AddDays(-14), WeeklyCheckInStatus.Reviewed, respondedAt: DateTime.UtcNow.AddDays(-13),
            dueAt: dueAt, reviewedAt: reviewedAt);
        var expiredId = await InsertAsync(client.UserId, trainer.UserId, Profession.Training, Monday(1),
            DateTime.UtcNow.AddDays(-7), WeeklyCheckInStatus.Expired);
        var dismissedId = await InsertAsync(client.UserId, trainer.UserId, Profession.Training, Monday(0),
            DateTime.UtcNow.AddDays(-1), WeeklyCheckInStatus.Dismissed, dismissedAt: DateTime.UtcNow);
        await InsertAsync(other.UserId, trainer.UserId, Profession.Training, Monday(2), DateTime.UtcNow.AddDays(-14));

        var response = await client.Http.GetAsync(Route, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Headers.GetValues("X-Total-Count").Single().Should().Be("3");
        var body = await response.Content.ReadFromJsonAsync<HistoryBody>(
            cancellationToken: TestContext.Current.CancellationToken);
        body!.Items.Select(i => i.Id).Should().Equal(dismissedId, expiredId, answeredId);
        body.Items[0].Status.Should().Be("Dismissed");
        body.Items[1].Status.Should().Be("Expired");
        body.Items[2].Status.Should().Be("Reviewed");
        body.Items[2].DueAt.Should().BeCloseTo(dueAt, TimeSpan.FromSeconds(1));
        body.Items[2].ReviewedAt.Should().BeCloseTo(reviewedAt, TimeSpan.FromSeconds(1));
        body.Items[1].DueAt.Should().BeNull();
        body.Items[1].ReviewedAt.Should().BeNull();
        body.Items[2].ProfessionalName.Should().Be("Tom Coach");
        body.Items[2].Profession.Should().Be("Training");
        body.Items[2].RespondedAt.Should().NotBeNull();

        var raw = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        raw.Should().NotContainEquivalentOf("flags")
            .And.NotContainEquivalentOf("hungerScore")
            .And.NotContainEquivalentOf("private note")
            .And.NotContainEquivalentOf("\"note\"");
    }

    [Fact]
    public async Task GetHistory_TiedWeekAndSentAt_OrdersByIdDescending()
    {
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        var trainer = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        var nutritionist = await TestActors.Nutritionist(factory).CreateAsync(TestContext.Current.CancellationToken);
        var sentAt = DateTime.UtcNow.AddDays(-3);
        var week = Monday(1);

        var lowId = await InsertAsync(client.UserId, trainer.UserId, Profession.Training, week, sentAt,
            id: Guid.Parse("00000000-0000-0000-0000-000000000001"));
        var highId = await InsertAsync(client.UserId, nutritionist.UserId, Profession.Nutrition, week, sentAt,
            id: Guid.Parse("00000000-0000-0000-0000-000000000002"));
        var olderSent = await InsertAsync(client.UserId, nutritionist.UserId, Profession.Training, week,
            sentAt.AddHours(-5));

        var response = await client.Http.GetAsync(Route, TestContext.Current.CancellationToken);

        var body = await response.Content.ReadFromJsonAsync<HistoryBody>(
            cancellationToken: TestContext.Current.CancellationToken);
        body!.Items.Select(i => i.Id).Should().Equal(highId, lowId, olderSent);
    }

    [Fact]
    public async Task GetHistory_Paged_ReturnsRequestedSliceAndFullTotal()
    {
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        var trainer = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        var ids = new List<Guid>();
        foreach (var weeksAgo in Enumerable.Range(0, 5))
        {
            ids.Add(await InsertAsync(client.UserId, trainer.UserId, Profession.Training, Monday(weeksAgo),
                DateTime.UtcNow.AddDays(-7 * weeksAgo)));
        }

        var response = await client.Http.GetAsync(
            $"{Route}?page=2&pageSize=2", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Headers.GetValues("X-Total-Count").Single().Should().Be("5");
        var body = await response.Content.ReadFromJsonAsync<HistoryBody>(
            cancellationToken: TestContext.Current.CancellationToken);
        body!.Items.Select(i => i.Id).Should().Equal(ids[2], ids[3]);
    }

    [Fact]
    public async Task GetHistory_InvalidPageSize_Returns400()
    {
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);

        var response = await client.Http.GetAsync(
            $"{Route}?pageSize=101", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    private record HistoryBody(List<HistoryItem> Items);

    private record HistoryItem(
        Guid Id,
        Guid ProfessionalUserId,
        string ProfessionalName,
        string Profession,
        DateOnly WeekStartDate,
        DateTime SentAt,
        string Status,
        DateTime? RespondedAt,
        DateTime? DueAt,
        DateTime? ReviewedAt);
}
