using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.SessionTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;

namespace FitnessPlatform.Tests.Endpoints.SessionTemplates;

/// <summary>
/// Integration test for <c>POST /training/session-templates/from-plan</c>
/// (<see cref="Application.Features.SessionTemplates.SaveSessionTemplateFromPlan.SaveSessionTemplateFromPlanEndpoint"/>) —
/// only the success path, which calls <c>Send.CreatedAtAsync</c> and therefore needs the real
/// <c>LinkGenerator</c> that <see cref="FitnessApiFactory"/> provides (unavailable in the
/// lightweight <c>Factory.Create&lt;T&gt;()</c> host used by <see cref="SessionTemplateEndpointTests"/>).
/// Same precedent as <c>SaveMealTemplateFromPlanEndpointTests</c>.
/// </summary>
[Collection(TestCollection.Name)]
public class SaveSessionTemplateFromPlanEndpointTests(FitnessApiFactory factory)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private static string UniqueEmail() => $"{Guid.NewGuid():N}@save-session-template-from-plan-test.com";

    private async Task<(HttpClient Client, Guid TrainerId)> RegisterTrainerAsync()
    {
        var client = factory.CreateClient();
        var email = UniqueEmail();
        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "SaveFromPlan", "SessionTemplateTest", "Trainer");
        var (accessToken, _) = await TestHelpers.LoginAsync(client, email, "TestPass1!");
        TestHelpers.SetBearerToken(client, accessToken);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.FirstAsync(
            u => u.Email == email, TestContext.Current.CancellationToken);

        return (client, user.Id);
    }

    private async Task<(TrainingPlan Plan, TrainingSession Session)> InsertPlanWithSessionAsync(Guid trainerId)
    {
        // The route authorizes on the caller's live link to the plan's client, not on authorship
        // alone, so the source plan needs a real linked client rather than a fabricated id.
        var clientUserId = await TestHelpers.RegisterLinkedClientAsync(
            factory, trainerId, TestContext.Current.CancellationToken);

        var session = new TrainingSession
        {
            SessionId = Guid.NewGuid(),
            Name = "Push Day",
            Order = 1,
            Workouts =
            [
                new TrainingWorkout
                {
                    WorkoutId = Guid.NewGuid(),
                    Order = 0,
                    Name = "Main",
                    Exercises =
                    [
                        new SessionExercise
                        {
                            ExerciseExternalId = Guid.NewGuid(),
                            ExerciseName = "Bench Press",
                            Order = 1
                        }
                    ]
                }
            ],
            StandaloneExercises =
            [
                new SessionExercise
                {
                    ExerciseExternalId = Guid.NewGuid(),
                    ExerciseName = "Plank",
                    Order = 1
                }
            ]
        };

        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            TrainerId = trainerId,
            ClientId = clientUserId,
            Name = "Test Plan",
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Days = [new TrainingDay { DayOfWeek = 1, Sessions = [session] }]
                }
            ]
        };

        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        await mongo.TrainingPlans.InsertOneAsync(plan, cancellationToken: TestContext.Current.CancellationToken);
        return (plan, session);
    }

    [Fact]
    public async Task SaveSessionTemplateFromPlan_ValidRequest_CopiesWorkoutsAndStandaloneExercises()
    {
        var (client, trainerId) = await RegisterTrainerAsync();
        var (plan, session) = await InsertPlanWithSessionAsync(trainerId);

        var response = await client.PostAsJsonAsync(
            "/training/session-templates/from-plan",
            new
            {
                PlanId = plan.ExternalId,
                WeekNumber = 1,
                DayOfWeek = 1,
                SessionId = session.SessionId,
                Name = "From Plan Session",
                Visibility = LibraryVisibility.Private
            },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var body = await response.Content.ReadFromJsonAsync<SessionTemplateDetailResponse>(
            JsonOptions, TestContext.Current.CancellationToken);
        body!.Workouts.Should().HaveCount(1);
        body.Workouts[0].Exercises.Should().ContainSingle(e => e.ExerciseName == "Bench Press");
        body.StandaloneExercises.Should().ContainSingle(e => e.ExerciseName == "Plank");

        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        var persisted = await mongo.SessionTemplates
            .Find(t => t.ExternalId == body.TemplateId)
            .FirstOrDefaultAsync(TestContext.Current.CancellationToken);

        persisted.Should().NotBeNull();
        persisted!.OwnerId.Should().Be(trainerId);
        persisted.Workouts.Should().HaveCount(1);
        persisted.StandaloneExercises.Should().HaveCount(1);
    }
}
