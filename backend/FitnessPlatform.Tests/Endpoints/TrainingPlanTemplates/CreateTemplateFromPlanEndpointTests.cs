using System.Net;
using System.Net.Http.Json;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;

namespace FitnessPlatform.Tests.Endpoints.TrainingPlanTemplates;

/// <summary>
/// Testcontainers integration tests for <c>POST /training/plan-templates/from-plan</c> (#862) —
/// verbatim content copy with client-only fields stripped, fresh <c>SessionId</c>/<c>WorkoutId</c>/
/// <c>ExerciseId</c> minting (defence in depth, unlike the nutrition-side sibling), the cloning
/// ban on <see cref="TrainingSession.AllExercises"/>, and the shaped 404 for a plan the caller
/// doesn't own (identical for missing vs. unowned, since <see cref="TrainingPlan"/> is not an
/// <see cref="Application.Domain.Documents.ILibraryDocument"/>).
/// </summary>
[Collection(TestCollection.Name)]
public class CreateTemplateFromPlanEndpointTests(FitnessApiFactory factory)
{
    private static string UniqueEmail(string tag) => $"{Guid.NewGuid():N}@from-plan-training-{tag}.com";

    private async Task<(HttpClient Client, Guid UserId)> RegisterTrainerAsync(string tag)
    {
        var client = factory.CreateClient();
        var email = UniqueEmail(tag);
        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Test", "Trainer", "Trainer");
        var (token, _) = await TestHelpers.LoginAsync(client, email, "TestPass1!");
        TestHelpers.SetBearerToken(client, token);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.FirstAsync(u => u.Email == email, TestContext.Current.CancellationToken);

        return (client, user.Id);
    }

    private async Task SeedPlanAsync(TrainingPlan plan)
    {
        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        await mongo.TrainingPlans.InsertOneAsync(plan, cancellationToken: TestContext.Current.CancellationToken);
    }

    private async Task<TrainingPlanTemplate> FetchTemplateAsync(Guid externalId)
    {
        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        return await mongo.TrainingPlanTemplates
            .Find(t => t.ExternalId == externalId)
            .FirstAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task FromPlan_OwnedPlan_CopiesContentStripsClientOnlyFieldsAndMintsFreshIds()
    {
        var (trainer, trainerId) = await RegisterTrainerAsync("owned");

        // Plan routes authorize on the live link, so the source plan must belong to a
        // client this trainer is actually linked to.
        var linkedClientId = await TestHelpers.RegisterLinkedClientAsync(
            factory, trainerId, TestContext.Current.CancellationToken);

        var sourceSessionId = Guid.NewGuid();
        var sourceWorkoutId = Guid.NewGuid();
        var sourceWorkoutExerciseId = Guid.NewGuid();
        var sourceStandaloneExerciseId = Guid.NewGuid();

        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = linkedClientId,
            TrainerId = trainerId,
            Name = "Source Plan",
            Status = TrainingPlanStatus.Active,
            Goal = PrimaryGoal.LoseFat,
            TargetWeightKg = 70,
            StartDate = DateTime.UtcNow.Date,
            Version = 1,
            DateCreated = DateTime.UtcNow,
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    Days =
                    [
                        new TrainingDay
                        {
                            DayOfWeek = 1,
                            Sessions =
                            [
                                new TrainingSession
                                {
                                    SessionId = sourceSessionId,
                                    Name = "Push Day",
                                    Order = 1,
                                    // Non-Standard format at session level, with a populated WodConfig —
                                    // pins that from-plan copies formats and format configs verbatim
                                    // (#862 review MINOR: no prior test exercised a non-Standard format).
                                    Format = WorkoutFormat.EMOM,
                                    FormatConfig = new WodConfig { IntervalSeconds = 60, TotalRounds = 10 },
                                    Workouts =
                                    [
                                        new TrainingWorkout
                                        {
                                            WorkoutId = sourceWorkoutId,
                                            Order = 0,
                                            Name = "Main",
                                            Exercises = [new SessionExercise { ExerciseId = sourceWorkoutExerciseId, ExerciseName = "Bench Press", Order = 1 }]
                                        }
                                    ],
                                    StandaloneExercises = [new SessionExercise { ExerciseId = sourceStandaloneExerciseId, ExerciseName = "Plank", Order = 2 }]
                                }
                            ]
                        }
                    ]
                }
            ]
        };
        await SeedPlanAsync(plan);

        var response = await trainer.PostAsJsonAsync("/training/plan-templates/from-plan", new
        {
            PlanId = plan.ExternalId,
            Name = "Template From Plan"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<TemplateSummaryDto>(
            cancellationToken: TestContext.Current.CancellationToken);
        body.Should().NotBeNull();

        var template = await FetchTemplateAsync(body!.TemplateId);
        template.Goal.Should().Be(PrimaryGoal.LoseFat, "Goal copies through from the plan");
        template.Difficulty.Should().BeNull("TrainingPlan carries no Difficulty field to copy from");
        template.Weeks.Should().HaveCount(1);

        var day = template.Weeks[0].Days.Should().ContainSingle().Subject;
        var session = day.Sessions.Should().ContainSingle().Subject;

        session.SessionId.Should().NotBe(sourceSessionId, "from-plan mints a fresh SessionId as defence in depth");
        session.Workouts.Should().ContainSingle().Which.WorkoutId.Should().NotBe(
            sourceWorkoutId, "from-plan mints a fresh WorkoutId as defence in depth");
        session.Workouts[0].Exercises.Should().ContainSingle().Which.ExerciseId.Should().NotBe(
            sourceWorkoutExerciseId, "from-plan mints a fresh ExerciseId as defence in depth");

        // The non-Standard format and its WodConfig copy through verbatim alongside the id
        // remapping above.
        session.Format.Should().Be(WorkoutFormat.EMOM, "session Format copies through from the plan");
        session.FormatConfig.Should().NotBeNull();
        session.FormatConfig!.IntervalSeconds.Should().Be(60);
        session.FormatConfig!.TotalRounds.Should().Be(10);

        // The cloning ban: exactly one standalone exercise survives — never inflated by the
        // workout's nested exercise via the computed AllExercises view.
        var standaloneExercise = session.StandaloneExercises.Should().ContainSingle().Subject;
        standaloneExercise.ExerciseId.Should().NotBe(sourceStandaloneExerciseId);
        standaloneExercise.ExerciseName.Should().Be("Plank");
    }

    [Fact]
    public async Task FromPlan_PlanOwnedByAnotherTrainer_Returns404()
    {
        var otherOwnerId = Guid.NewGuid();
        var (trainer, _) = await RegisterTrainerAsync("unowned");

        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = Guid.NewGuid(),
            TrainerId = otherOwnerId,
            Name = "Other's Plan",
            Status = TrainingPlanStatus.Draft,
            Version = 1,
            DateCreated = DateTime.UtcNow,
            Weeks = [new TrainingWeek { WeekNumber = 1 }]
        };
        await SeedPlanAsync(plan);

        var response = await trainer.PostAsJsonAsync("/training/plan-templates/from-plan", new
        {
            PlanId = plan.ExternalId,
            Name = "Stolen Template"
        });

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        var responseBody = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        responseBody.Should().Contain("TRAINING_PLAN_TEMPLATE_NOT_FOUND");
    }

    [Fact]
    public async Task FromPlan_MissingPlan_Returns404SameCodeAsUnowned()
    {
        var (trainer, _) = await RegisterTrainerAsync("missing");

        var response = await trainer.PostAsJsonAsync("/training/plan-templates/from-plan", new
        {
            PlanId = Guid.NewGuid(),
            Name = "Template"
        });

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        var responseBody = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        responseBody.Should().Contain("TRAINING_PLAN_TEMPLATE_NOT_FOUND");
    }

    private sealed class TemplateSummaryDto
    {
        public Guid TemplateId { get; set; }
    }
}
