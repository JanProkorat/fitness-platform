using System.Net;
using System.Net.Http.Json;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.NutritionPlans;
using FitnessPlatform.Tests.Endpoints.TrainingPlans;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.Client.Plans;

/// <summary>
/// Integration tests for <c>GET /client/plans/{PlanId}/summary</c>. Real PostgreSQL and MongoDB: the
/// ownership filter, the nearest-measurement rule and the photo window cannot be proven against mocks.
/// </summary>
[Collection(TestCollection.Name)]
public class GetClientPlanSummaryIntegrationTests(FitnessApiFactory factory)
{
    private sealed record PhotoBody(Guid Id, string DisplayUrl, DateTime TakenAt);

    private sealed record SummaryBody(
        Guid PlanId,
        string PlanName,
        string Type,
        string CoachName,
        DateTime? StartDate,
        DateTime? EndDate,
        int? SessionsTotal,
        int? SessionsDone,
        decimal? WeightStartKg,
        decimal? WeightEndKg,
        decimal? WaistStartCm,
        decimal? WaistEndCm,
        PhotoBody? FirstPhoto,
        PhotoBody? LastPhoto);

    private sealed record ListItem(Guid PlanId, int? SessionsTotal, int? SessionsDone);

    private sealed record ListBody(List<ListItem> Items);

    /// <summary>Monday three weeks before the current week, so "today" falls inside week 4 of a 4-week plan.</summary>
    private static DateTime PlanStartMonday() => TrainingPlanTestHelpers.LastMonday().AddDays(-21);

    private static DateTime Utc(DateTime value) => DateTime.SpecifyKind(value, DateTimeKind.Utc);

    private async Task InsertAsync(TrainingPlan? trainingPlan = null, NutritionPlan? nutritionPlan = null)
    {
        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        var ct = TestContext.Current.CancellationToken;

        if (trainingPlan is not null)
        {
            await mongo.TrainingPlans.InsertOneAsync(trainingPlan, cancellationToken: ct);
        }

        if (nutritionPlan is not null)
        {
            await mongo.NutritionPlans.InsertOneAsync(nutritionPlan, cancellationToken: ct);
        }
    }

    [Fact]
    public async Task GetSummary_TrainingPlan_ReturnsSessionsMeasurementsAndPhotosOverThePlanWindow()
    {
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        var coach = await TestActors.Trainer(factory).WithName("Martin", "Novak")
            .CreateAsync(TestContext.Current.CancellationToken);

        var start = PlanStartMonday();
        var plannedEnd = start.AddDays(4 * 7 - 1);
        var planId = Guid.NewGuid();
        var plan = TrainingPlanTestHelpers.CreatePlan(
            externalId: planId, clientId: client.UserId, trainerId: coach.UserId,
            status: TrainingPlanStatus.Active, weekCount: 4);
        plan.StartDate = start;

        var sessionIds = new List<Guid>();
        foreach (var week in plan.Weeks)
        {
            week.Status = WeekStatus.Published;
            week.DatePublished = start.AddDays(-1);
            var sessionId = Guid.NewGuid();
            sessionIds.Add(sessionId);
            week.Days.First(d => d.DayOfWeek == 1).Sessions.Add(new TrainingSession
            {
                SessionId = sessionId,
                Name = $"Session {week.WeekNumber}",
                Order = 1,
                StandaloneExercises =
                [
                    new SessionExercise
                    {
                        ExerciseId = Guid.NewGuid(),
                        ExerciseExternalId = Guid.NewGuid(),
                        ExerciseName = "Plank",
                        Order = 1,
                    },
                ],
            });
        }

        SessionExecution Execution(int weekIndex, SessionExecutionStatus status) => new()
        {
            ExternalId = Guid.NewGuid(),
            ClientId = client.UserId,
            PlanId = planId,
            SessionId = sessionIds[weekIndex],
            Date = start.AddDays(7 * weekIndex),
            Status = status,
            DateCreated = DateTime.UtcNow,
        };

        await InsertAsync(trainingPlan: plan);
        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            await mongo.SessionExecutions.InsertManyAsync(
            [
                Execution(0, SessionExecutionStatus.Completed),
                Execution(1, SessionExecutionStatus.Completed),
                Execution(2, SessionExecutionStatus.Partial),
            ], cancellationToken: TestContext.Current.CancellationToken);

            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.BodyMeasurements.AddRange(
                // Outside the 14-day tolerance before the start: ignored.
                new BodyMeasurement { ClientProfileId = client.ProfileId, MeasuredAt = Utc(start.AddDays(-30)), WeightKg = 100m },
                // Nearest the start for both metrics; the only waist reading in range, so it also fills the end.
                new BodyMeasurement { ClientProfileId = client.ProfileId, MeasuredAt = Utc(start.AddDays(3)), WeightKg = 88m, WaistCm = 85m },
                new BodyMeasurement { ClientProfileId = client.ProfileId, MeasuredAt = Utc(plannedEnd.AddDays(-2)), WeightKg = 82m },
                // Outside the tolerance after the end: ignored.
                new BodyMeasurement { ClientProfileId = client.ProfileId, MeasuredAt = Utc(plannedEnd.AddDays(20)), WaistCm = 70m });

            PlanPhoto Photo(PlanPhotoCategory category, DateTime takenAt) => new()
            {
                ClientProfileId = client.ProfileId,
                Category = category,
                BlobUrl = $"plan-photos/{Guid.NewGuid()}.jpg",
                TakenAt = Utc(takenAt),
                UploadedByUserId = client.UserId,
            };

            var firstPhoto = Photo(PlanPhotoCategory.Body, start.AddDays(2));
            var lastPhoto = Photo(PlanPhotoCategory.FreeForm, start.AddDays(10));
            db.PlanPhotos.AddRange(
                firstPhoto,
                lastPhoto,
                Photo(PlanPhotoCategory.Food, start.AddDays(1)),
                Photo(PlanPhotoCategory.Body, start.AddDays(-5)),
                Photo(PlanPhotoCategory.Body, plannedEnd.AddDays(3)));
            await db.SaveChangesAsync(TestContext.Current.CancellationToken);

            var response = await client.Http.GetAsync($"/client/plans/{planId}/summary", TestContext.Current.CancellationToken);

            response.StatusCode.Should().Be(HttpStatusCode.OK);
            var body = await response.Content.ReadFromJsonAsync<SummaryBody>(TestContext.Current.CancellationToken);
            body!.Type.Should().Be("training");
            body.CoachName.Should().Be("Martin Novak");
            body.StartDate.Should().Be(start);
            body.EndDate.Should().Be(plannedEnd);
            body.WeightStartKg.Should().Be(88m);
            body.WeightEndKg.Should().Be(82m);
            body.WaistStartCm.Should().Be(85m);
            body.WaistEndCm.Should().Be(85m);
            body.FirstPhoto!.Id.Should().Be(firstPhoto.PublicId);
            body.LastPhoto!.Id.Should().Be(lastPhoto.PublicId);
            body.FirstPhoto.DisplayUrl.Should().EndWith("?signed=test", "the stored blob url must be signed, not returned raw");

            // The session counts must be the ones GET /client/plans reports for the same plan.
            body.SessionsTotal.Should().Be(4);
            body.SessionsDone.Should().Be(2);
            var listResponse = await client.Http.GetAsync("/client/plans", TestContext.Current.CancellationToken);
            var listItem = (await listResponse.Content.ReadFromJsonAsync<ListBody>(TestContext.Current.CancellationToken))!
                .Items.Single(item => item.PlanId == planId);
            (body.SessionsTotal, body.SessionsDone).Should().Be((listItem.SessionsTotal, listItem.SessionsDone));
        }
    }

    [Fact]
    public async Task GetSummary_NutritionPlanWithNoMeasurementsOrPhotos_ReturnsNullsAndNoSessions()
    {
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        var coach = await TestActors.Nutritionist(factory).WithName("Eva", "Svobodova")
            .CreateAsync(TestContext.Current.CancellationToken);

        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId, clientId: client.UserId, nutritionistId: coach.UserId,
            status: NutritionPlanStatus.Active, weekCount: 2);
        plan.StartDate = PlanStartMonday();
        plan.Weeks[0].Status = WeekStatus.Published;
        plan.Weeks[0].DatePublished = DateTime.UtcNow.AddDays(-1);
        await InsertAsync(nutritionPlan: plan);

        var response = await client.Http.GetAsync($"/client/plans/{planId}/summary", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<SummaryBody>(TestContext.Current.CancellationToken);
        body!.Type.Should().Be("nutrition");
        body.CoachName.Should().Be("Eva Svobodova");
        body.EndDate.Should().Be(PlanStartMonday().AddDays(2 * 7 - 1));
        body.SessionsTotal.Should().BeNull();
        body.SessionsDone.Should().BeNull();
        body.WeightStartKg.Should().BeNull();
        body.WeightEndKg.Should().BeNull();
        body.WaistStartCm.Should().BeNull();
        body.WaistEndCm.Should().BeNull();
        body.FirstPhoto.Should().BeNull();
        body.LastPhoto.Should().BeNull();
    }

    [Fact]
    public async Task GetSummary_AnotherClientsPlanOrUnknownId_Returns404()
    {
        var caller = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        var other = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);

        var trainingId = Guid.NewGuid();
        var trainingPlan = TrainingPlanTestHelpers.CreatePlan(
            externalId: trainingId, clientId: other.UserId, status: TrainingPlanStatus.Active, weekCount: 1);
        trainingPlan.Weeks[0].Status = WeekStatus.Published;
        var nutritionId = Guid.NewGuid();
        var nutritionPlan = PlanTestHelpers.CreatePlan(
            externalId: nutritionId, clientId: other.UserId, status: NutritionPlanStatus.Active, weekCount: 1);
        nutritionPlan.Weeks[0].Status = WeekStatus.Published;
        await InsertAsync(trainingPlan, nutritionPlan);

        foreach (var planId in new[] { trainingId, nutritionId, Guid.NewGuid() })
        {
            var response = await caller.Http.GetAsync($"/client/plans/{planId}/summary", TestContext.Current.CancellationToken);
            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }
    }

    [Fact]
    public async Task GetSummary_OwnDraftPlanOrPlanWithoutPublishedWeek_Returns404()
    {
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);

        var draftId = Guid.NewGuid();
        var draft = TrainingPlanTestHelpers.CreatePlan(
            externalId: draftId, clientId: client.UserId, status: TrainingPlanStatus.Draft, weekCount: 1);
        draft.Weeks[0].Status = WeekStatus.Published;
        var unpublishedId = Guid.NewGuid();
        var unpublished = TrainingPlanTestHelpers.CreatePlan(
            externalId: unpublishedId, clientId: client.UserId, status: TrainingPlanStatus.Active, weekCount: 1);
        unpublished.Weeks[0].Status = WeekStatus.Draft;
        await InsertAsync(trainingPlan: draft);
        await InsertAsync(trainingPlan: unpublished);

        foreach (var planId in new[] { draftId, unpublishedId })
        {
            var response = await client.Http.GetAsync($"/client/plans/{planId}/summary", TestContext.Current.CancellationToken);
            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }
    }

    [Fact]
    public async Task GetSummary_EmptyPlanId_Returns400()
    {
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);

        var response = await client.Http.GetAsync($"/client/plans/{Guid.Empty}/summary", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
