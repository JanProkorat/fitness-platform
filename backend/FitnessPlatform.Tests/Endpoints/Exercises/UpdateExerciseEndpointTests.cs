using System.Security.Claims;
using System.Text.Json;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Exercises.UpdateExercise;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Endpoints;
using FluentValidation;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Exercises;

/// <summary>
/// Tests for <see cref="UpdateExerciseEndpoint"/>.
/// </summary>
public class UpdateExerciseEndpointTests
{
    private readonly Guid _trainerId = Guid.NewGuid();

    private UpdateExerciseEndpoint CreateEndpoint(
        IMongoContext mongo,
        MemoryStream? responseBody = null)
    {
        return Factory.Create<UpdateExerciseEndpoint>(
            ctx =>
            {
                ctx.Request.HttpContext.User = new ClaimsPrincipal(
                    new ClaimsIdentity(
                        EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer)));
                if (responseBody is not null)
                    ctx.Request.HttpContext.Response.Body = responseBody;
            },
            mongo);
    }

    [Fact]
    public async Task HandleAsync_OwnerUpdatesCustomExercise_Returns200AndBumpsVersion()
    {
        var exerciseId = Guid.NewGuid();
        var exercise = ExerciseTestHelpers.CreateExercise(
            externalId: exerciseId,
            isCustom: true,
            trainerId: _trainerId,
            source: "custom",
            version: 3);
        var mongo = ExerciseTestHelpers.CreateMockMongo(exercise);

        var ep = CreateEndpoint(mongo);

        var request = new UpdateExerciseRequest
        {
            ExerciseId = exerciseId,
            Name = "Updated Exercise",
            MuscleGroups = [MuscleGroup.Back],
            Equipment = ExerciseEquipment.Barbell,
            Category = ExerciseCategory.Strength,
            Difficulty = ExerciseDifficulty.Advanced,
            Version = 3
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // Version-guarded update must be called — not the unguarded form
        await mongo.Exercises.Received(1).UpdateOneAsync(
            Arg.Any<FilterDefinition<Exercise>>(),
            Arg.Is<UpdateDefinition<Exercise>>(u => true),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_StaleVersion_EarlyCheck_Returns409()
    {
        // The exercise is at version 5 but the request carries version 3.
        // The early in-memory guard fires before the DB write.
        var exerciseId = Guid.NewGuid();
        var exercise = ExerciseTestHelpers.CreateExercise(
            externalId: exerciseId,
            isCustom: true,
            trainerId: _trainerId,
            source: "custom",
            version: 5);

        using var responseBody = new MemoryStream();
        var mongo = ExerciseTestHelpers.CreateMockMongo(exercise);
        var ep = CreateEndpoint(mongo, responseBody);

        var request = new UpdateExerciseRequest
        {
            ExerciseId = exerciseId,
            Name = "Stale Update",
            MuscleGroups = [MuscleGroup.Back],
            Equipment = ExerciseEquipment.Barbell,
            Category = ExerciseCategory.Strength,
            Difficulty = ExerciseDifficulty.Advanced,
            Version = 3
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(409);

        responseBody.Seek(0, SeekOrigin.Begin);
        using var doc = await JsonDocument.ParseAsync(responseBody);
        doc.RootElement.GetProperty("errorCode").GetString()
            .Should().Be(ErrorCodes.ExerciseVersionConflict);

        // UpdateOneAsync must NOT have been called
        await mongo.Exercises.DidNotReceive().UpdateOneAsync(
            Arg.Any<FilterDefinition<Exercise>>(),
            Arg.Any<UpdateDefinition<Exercise>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_ConcurrentWrite_DoubleGuard_Returns409()
    {
        // Exercise is at version 5, request carries version 5 (matches in memory),
        // but UpdateOneAsync returns ModifiedCount=0 (concurrent write beat us).
        var exerciseId = Guid.NewGuid();
        var exercise = ExerciseTestHelpers.CreateExercise(
            externalId: exerciseId,
            isCustom: true,
            trainerId: _trainerId,
            source: "custom",
            version: 5);

        using var responseBody = new MemoryStream();
        var mongo = ExerciseTestHelpers.CreateMockMongoWithUpdateResult(modifiedCount: 0, exercise);
        var ep = CreateEndpoint(mongo, responseBody);

        var request = new UpdateExerciseRequest
        {
            ExerciseId = exerciseId,
            Name = "Concurrent Update",
            MuscleGroups = [MuscleGroup.Back],
            Equipment = ExerciseEquipment.Barbell,
            Category = ExerciseCategory.Strength,
            Difficulty = ExerciseDifficulty.Advanced,
            Version = 5
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(409);

        responseBody.Seek(0, SeekOrigin.Begin);
        using var doc = await JsonDocument.ParseAsync(responseBody);
        doc.RootElement.GetProperty("errorCode").GetString()
            .Should().Be(ErrorCodes.ExerciseVersionConflict);
    }

    [Fact]
    public async Task HandleAsync_LegacyDoc_VersionZero_MatchingRequest_Returns200()
    {
        // A legacy document with no version field deserializes to Version=0.
        // A client who fetched it receives Version=0 and echoes back Version=0.
        // The CAS guard should pass (0 == 0) and the update succeeds, bumping to version 1.
        var exerciseId = Guid.NewGuid();
        var exercise = ExerciseTestHelpers.CreateExercise(
            externalId: exerciseId,
            isCustom: true,
            trainerId: _trainerId,
            source: "custom",
            version: 0);  // simulates a legacy doc with no version field (CLR default)

        var mongo = ExerciseTestHelpers.CreateMockMongo(exercise);
        var ep = CreateEndpoint(mongo);

        var request = new UpdateExerciseRequest
        {
            ExerciseId = exerciseId,
            Name = "Legacy Update",
            MuscleGroups = [MuscleGroup.Back],
            Equipment = ExerciseEquipment.Barbell,
            Category = ExerciseCategory.Strength,
            Difficulty = ExerciseDifficulty.Advanced,
            Version = 0
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // Verify the update was attempted (legacy doc with version 0 goes through)
        await mongo.Exercises.Received(1).UpdateOneAsync(
            Arg.Any<FilterDefinition<Exercise>>(),
            Arg.Any<UpdateDefinition<Exercise>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_SystemExercise_ThrowsValidationException()
    {
        var exerciseId = Guid.NewGuid();
        var exercise = ExerciseTestHelpers.CreateExercise(
            externalId: exerciseId,
            isCustom: false,
            source: "system");
        var mongo = ExerciseTestHelpers.CreateMockMongo(exercise);

        var ep = CreateEndpoint(mongo);

        var request = new UpdateExerciseRequest
        {
            ExerciseId = exerciseId,
            Name = "Hacked",
            MuscleGroups = [MuscleGroup.Chest],
            Equipment = ExerciseEquipment.None,
            Category = ExerciseCategory.Strength,
            Difficulty = ExerciseDifficulty.Beginner,
            Version = 1
        };

        var act = () => ep.HandleAsync(request, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<ValidationFailureException>();
    }
}
