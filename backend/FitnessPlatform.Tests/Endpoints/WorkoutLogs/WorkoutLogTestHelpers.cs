using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.WorkoutLogs;

/// <summary>
/// Test helpers for workout log endpoint tests.
/// </summary>
public static class WorkoutLogTestHelpers
{
    /// <summary>
    /// Creates a test <see cref="WorkoutLog"/> document.
    /// </summary>
    public static WorkoutLog CreateLog(
        Guid? externalId = null,
        Guid? clientId = null,
        Guid? planId = null,
        Guid? sessionId = null,
        bool isCompleted = false,
        DateTime? startedAt = null)
    {
        return new WorkoutLog
        {
            ExternalId = externalId ?? Guid.NewGuid(),
            ClientId = clientId ?? Guid.NewGuid(),
            PlanId = planId,
            SessionId = sessionId,
            StartedAt = startedAt ?? DateTime.UtcNow,
            IsCompleted = isCompleted,
            Sections = [],
            DateCreated = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Creates a mocked <see cref="IMongoContext"/> with workout logs and optionally training plans.
    /// </summary>
    public static IMongoContext CreateMockMongo(
        WorkoutLog[]? logs = null,
        TrainingPlan[]? plans = null)
    {
        var mongo = Substitute.For<IMongoContext>();

        var logCollection = CreateMockLogCollection(logs?.ToList() ?? []);
        mongo.WorkoutLogs.Returns(logCollection);

        if (plans is not null)
        {
            var planCollection = CreateMockPlanCollection(plans.ToList());
            mongo.TrainingPlans.Returns(planCollection);
        }
        else
        {
            var emptyPlanCollection = CreateMockPlanCollection([]);
            mongo.TrainingPlans.Returns(emptyPlanCollection);
        }

        return mongo;
    }

    /// <summary>
    /// Creates a mock workout log collection.
    /// </summary>
    public static IMongoCollection<WorkoutLog> CreateMockLogCollection(List<WorkoutLog> logs)
    {
        var collection = Substitute.For<IMongoCollection<WorkoutLog>>();

        collection.FindAsync(
                Arg.Any<FilterDefinition<WorkoutLog>>(),
                Arg.Any<FindOptions<WorkoutLog, WorkoutLog>>(),
                Arg.Any<CancellationToken>())
            .Returns(ci => CreateCursor(logs));

        collection.CountDocumentsAsync(
                Arg.Any<FilterDefinition<WorkoutLog>>(),
                Arg.Any<CountOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(logs.Count);

        var replaceResult = Substitute.For<ReplaceOneResult>();
        replaceResult.ModifiedCount.Returns(1);
        collection.ReplaceOneAsync(
                Arg.Any<FilterDefinition<WorkoutLog>>(),
                Arg.Any<WorkoutLog>(),
                Arg.Any<ReplaceOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(replaceResult);

        return collection;
    }

    /// <summary>
    /// Creates a mock training plan collection.
    /// </summary>
    public static IMongoCollection<TrainingPlan> CreateMockPlanCollection(List<TrainingPlan> plans)
    {
        var collection = Substitute.For<IMongoCollection<TrainingPlan>>();

        collection.FindAsync(
                Arg.Any<FilterDefinition<TrainingPlan>>(),
                Arg.Any<FindOptions<TrainingPlan, TrainingPlan>>(),
                Arg.Any<CancellationToken>())
            .Returns(ci => CreatePlanCursor(plans));

        return collection;
    }

    /// <summary>
    /// Creates a mocked ProfessionalAuthHelper.
    /// </summary>
    public static ProfessionalAuthHelper CreateMockAuthHelper(bool hasLink = true)
    {
        var db = Substitute.For<IApplicationDbContext>();
        var authHelper = Substitute.For<ProfessionalAuthHelper>(db);
        authHelper.HasActiveLinkAsync(
                Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(hasLink);
        return authHelper;
    }

    private static IAsyncCursor<WorkoutLog> CreateCursor(List<WorkoutLog> logs)
    {
        var cursor = Substitute.For<IAsyncCursor<WorkoutLog>>();
        var moved = false;
        cursor.Current.Returns(logs);
        cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return logs.Count > 0;
        });
        cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return logs.Count > 0;
        });
        return cursor;
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
}
