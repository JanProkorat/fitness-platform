using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.ClientTraining;

/// <summary>
/// Helpers for creating test data and mocks for training completion endpoint tests.
/// </summary>
public static class TrainingCompletionTestHelpers
{
    /// <summary>
    /// Creates an active <see cref="TrainingPlan"/> with one published week containing
    /// sessions for every day of the week. Each session has the given exercises.
    /// </summary>
    public static TrainingPlan CreateActivePlan(
        Guid clientId,
        Guid? sessionId = null,
        IReadOnlyList<Guid>? exerciseIds = null,
        DateTime? startDate = null)
    {
        var sid = sessionId ?? Guid.NewGuid();
        var exIds = exerciseIds ?? [Guid.NewGuid(), Guid.NewGuid()];
        var start = startDate ?? DateTime.UtcNow.Date.AddDays(-(int)DateTime.UtcNow.DayOfWeek + 1); // Monday of current week

        return new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientId,
            TrainerId = Guid.NewGuid(),
            Name = "Test Plan",
            Status = TrainingPlanStatus.Active,
            StartDate = start,
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    DatePublished = start,
                    Sessions = Enumerable.Range(1, 7).Select(d => new TrainingSession
                    {
                        SessionId = d == (int)DateTime.UtcNow.DayOfWeek || d == 1 ? sid : Guid.NewGuid(),
                        DayOfWeek = d,
                        Name = $"Day {d} Session",
                        Order = 1,
                        Exercises = exIds.Select((id, i) => new SessionExercise
                        {
                            ExerciseExternalId = id,
                            ExerciseName = $"Exercise {i + 1}",
                            Order = i + 1,
                            Sets = []
                        }).ToList()
                    }).ToList()
                }
            ],
            Version = 1,
            DateCreated = start
        };
    }

    /// <summary>
    /// Creates a <see cref="TrainingCompletion"/> document for the given session and date.
    /// </summary>
    public static TrainingCompletion CreateCompletion(
        Guid clientId,
        Guid sessionId,
        DateTime date,
        IReadOnlyList<Guid>? completedExerciseIds = null,
        int version = 1)
    {
        return new TrainingCompletion
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientId,
            Date = date.Date,
            SessionId = sessionId,
            CompletedExerciseIds = completedExerciseIds?.ToList() ?? [],
            DateCreated = DateTime.UtcNow,
            Version = version
        };
    }

    /// <summary>
    /// Creates a mock <see cref="IMongoContext"/> with configured collections for
    /// training plans and training completions.
    /// </summary>
    public static (IMongoContext Mongo, IMongoCollection<TrainingCompletion> CompletionCollection)
        CreateMockMongo(
            TrainingPlan? plan = null,
            TrainingCompletion? existingCompletion = null)
    {
        var mongo = Substitute.For<IMongoContext>();

        // Training plans
        var plans = plan is not null ? new List<TrainingPlan> { plan } : new List<TrainingPlan>();
        var planCollection = CreateMockPlanCollection(plans);
        mongo.TrainingPlans.Returns(planCollection);

        // Training completions
        var completions = existingCompletion is not null
            ? new List<TrainingCompletion> { existingCompletion }
            : new List<TrainingCompletion>();
        var completionCollection = CreateMockCompletionCollection(completions);
        mongo.TrainingCompletions.Returns(completionCollection);

        return (mongo, completionCollection);
    }

    /// <summary>
    /// Creates a mock <see cref="IMongoCollection{TrainingCompletion}"/> with basic operations.
    /// </summary>
    public static IMongoCollection<TrainingCompletion> CreateMockCompletionCollection(
        List<TrainingCompletion> completions,
        bool updateSucceeds = true)
    {
        var collection = Substitute.For<IMongoCollection<TrainingCompletion>>();

        collection.FindAsync(
                Arg.Any<FilterDefinition<TrainingCompletion>>(),
                Arg.Any<FindOptions<TrainingCompletion, TrainingCompletion>>(),
                Arg.Any<CancellationToken>())
            .Returns(ci => CreateCompletionCursor(completions));

        var updateResult = Substitute.For<UpdateResult>();
        updateResult.ModifiedCount.Returns(updateSucceeds ? 1L : 0L);
        collection.UpdateOneAsync(
                Arg.Any<FilterDefinition<TrainingCompletion>>(),
                Arg.Any<UpdateDefinition<TrainingCompletion>>(),
                Arg.Any<UpdateOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(updateResult);

        return collection;
    }

    private static IMongoCollection<TrainingPlan> CreateMockPlanCollection(List<TrainingPlan> plans)
    {
        var collection = Substitute.For<IMongoCollection<TrainingPlan>>();

        collection.FindAsync(
                Arg.Any<FilterDefinition<TrainingPlan>>(),
                Arg.Any<FindOptions<TrainingPlan, TrainingPlan>>(),
                Arg.Any<CancellationToken>())
            .Returns(ci => CreatePlanCursor(plans));

        return collection;
    }

    private static IAsyncCursor<TrainingPlan> CreatePlanCursor(List<TrainingPlan> plans)
    {
        var cursor = Substitute.For<IAsyncCursor<TrainingPlan>>();
        var moved = false;
        cursor.Current.Returns(plans);
        cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return plans.Count > 0;
        });
        cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return plans.Count > 0;
        });
        return cursor;
    }

    private static IAsyncCursor<TrainingCompletion> CreateCompletionCursor(List<TrainingCompletion> completions)
    {
        var cursor = Substitute.For<IAsyncCursor<TrainingCompletion>>();
        var moved = false;
        cursor.Current.Returns(completions);
        cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return completions.Count > 0;
        });
        cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return completions.Count > 0;
        });
        return cursor;
    }
}
