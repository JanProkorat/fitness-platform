using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.WorkoutLogs;

/// <summary>
/// Test helpers for workout log endpoint tests.
///
/// #841: every <c>Features/WorkoutLogs/**</c> endpoint now reads/writes exclusively
/// <see cref="IMongoContext.SessionExecutions"/> (the retired <c>WorkoutLogs</c> collection is
/// read-only for one release, per the design ruling). <see cref="CreateLog"/> therefore builds a
/// <see cref="SessionExecution"/> (with a populated <see cref="SessionExecutionPerformance"/>,
/// mirroring the retired <c>WorkoutLog</c> fixture shape) and <see cref="CreateMockMongo"/> stubs
/// <see cref="IMongoContext.SessionExecutions"/>. The method name is kept as <c>CreateLog</c> for
/// minimal call-site churn across the WorkoutLogs test suite.
/// </summary>
public static class WorkoutLogTestHelpers
{
    /// <summary>
    /// Creates a test <see cref="SessionExecution"/> document with a populated
    /// <see cref="SessionExecutionPerformance"/> (mirrors the retired <c>WorkoutLog</c> shape).
    /// </summary>
    public static SessionExecution CreateLog(
        Guid? externalId = null,
        Guid? clientId = null,
        Guid? planId = null,
        Guid? sessionId = null,
        bool isCompleted = false,
        DateTime? startedAt = null)
    {
        var started = startedAt ?? DateTime.UtcNow;

        return new SessionExecution
        {
            ExternalId = externalId ?? Guid.NewGuid(),
            ClientId = clientId ?? Guid.NewGuid(),
            PlanId = planId,
            SessionId = sessionId,
            Date = SessionExecution.ToCompletionDateUtc(started),
            Status = isCompleted ? SessionExecutionStatus.Completed : SessionExecutionStatus.Partial,
            Performance = new SessionExecutionPerformance
            {
                StartedAt = started,
                CompletedAt = isCompleted ? started : null,
                Sections = []
            },
            DateCreated = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Creates a mocked <see cref="IMongoContext"/> with session executions and optionally training plans.
    /// </summary>
    public static IMongoContext CreateMockMongo(
        SessionExecution[]? logs = null,
        TrainingPlan[]? plans = null)
    {
        var mongo = Substitute.For<IMongoContext>();

        var logCollection = CreateMockExecutionCollection(logs?.ToList() ?? []);
        mongo.SessionExecutions.Returns(logCollection);

        var planCollection = CreateMockPlanCollection(plans?.ToList() ?? []);
        mongo.TrainingPlans.Returns(planCollection);

        return mongo;
    }

    /// <summary>
    /// Creates a mock session execution collection.
    /// </summary>
    public static IMongoCollection<SessionExecution> CreateMockExecutionCollection(List<SessionExecution> logs)
    {
        var collection = Substitute.For<IMongoCollection<SessionExecution>>();

        collection.FindAsync(
                Arg.Any<FilterDefinition<SessionExecution>>(),
                Arg.Any<FindOptions<SessionExecution, SessionExecution>>(),
                Arg.Any<CancellationToken>())
            .Returns(ci => CreateCursor(logs));

        collection.CountDocumentsAsync(
                Arg.Any<FilterDefinition<SessionExecution>>(),
                Arg.Any<CountOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(logs.Count);

        var replaceResult = Substitute.For<ReplaceOneResult>();
        replaceResult.ModifiedCount.Returns(1);
        collection.ReplaceOneAsync(
                Arg.Any<FilterDefinition<SessionExecution>>(),
                Arg.Any<SessionExecution>(),
                Arg.Any<ReplaceOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(replaceResult);

        collection.InsertOneAsync(
                Arg.Any<SessionExecution>(),
                Arg.Any<InsertOneOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(Task.CompletedTask);

        var updateResult = Substitute.For<UpdateResult>();
        updateResult.ModifiedCount.Returns(1);
        collection.UpdateOneAsync(
                Arg.Any<FilterDefinition<SessionExecution>>(),
                Arg.Any<UpdateDefinition<SessionExecution>>(),
                Arg.Any<UpdateOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(updateResult);

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

    private static IAsyncCursor<SessionExecution> CreateCursor(List<SessionExecution> logs)
    {
        var cursor = Substitute.For<IAsyncCursor<SessionExecution>>();
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
