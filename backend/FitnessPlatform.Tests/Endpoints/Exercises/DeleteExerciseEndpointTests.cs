using System.Security.Claims;
using System.Text.Json;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Features.Exercises.DeleteExercise;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Endpoints;
using FluentValidation;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Exercises;

/// <summary>
/// Tests for <see cref="DeleteExerciseEndpoint"/>.
/// </summary>
public class DeleteExerciseEndpointTests
{
    private readonly Guid _trainerId = Guid.NewGuid();

    private DeleteExerciseEndpoint CreateEndpoint(
        IMongoContext mongo,
        MemoryStream? responseBody = null)
    {
        return Factory.Create<DeleteExerciseEndpoint>(
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
    public async Task HandleAsync_OwnerDeletesCustomExercise_Returns204()
    {
        var exerciseId = Guid.NewGuid();
        var exercise = ExerciseTestHelpers.CreateExercise(
            externalId: exerciseId,
            isCustom: true,
            trainerId: _trainerId,
            source: "custom",
            version: 2);
        var mongo = ExerciseTestHelpers.CreateMockMongo(exercise);

        var ep = CreateEndpoint(mongo);

        await ep.HandleAsync(new DeleteExerciseRequest { ExerciseId = exerciseId, Version = 2 }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);

        // Version-guarded update must be called
        await mongo.Exercises.Received(1).UpdateOneAsync(
            Arg.Any<FilterDefinition<Exercise>>(),
            Arg.Any<UpdateDefinition<Exercise>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_StaleVersion_EarlyCheck_Returns409()
    {
        // Exercise is at version 5, but request carries version 2.
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

        await ep.HandleAsync(new DeleteExerciseRequest { ExerciseId = exerciseId, Version = 2 }, TestContext.Current.CancellationToken);

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
        // Version matches in-memory but UpdateOneAsync returns ModifiedCount=0.
        var exerciseId = Guid.NewGuid();
        var exercise = ExerciseTestHelpers.CreateExercise(
            externalId: exerciseId,
            isCustom: true,
            trainerId: _trainerId,
            source: "custom",
            version: 4);

        using var responseBody = new MemoryStream();
        var mongo = ExerciseTestHelpers.CreateMockMongoWithUpdateResult(modifiedCount: 0, exercise);
        var ep = CreateEndpoint(mongo, responseBody);

        await ep.HandleAsync(new DeleteExerciseRequest { ExerciseId = exerciseId, Version = 4 }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(409);

        responseBody.Seek(0, SeekOrigin.Begin);
        using var doc = await JsonDocument.ParseAsync(responseBody);
        doc.RootElement.GetProperty("errorCode").GetString()
            .Should().Be(ErrorCodes.ExerciseVersionConflict);
    }

    [Fact]
    public async Task HandleAsync_LegacyDoc_VersionOne_MatchingRequest_Returns204()
    {
        // A legacy document with no version field deserializes to Version=1
        // (MongoDB.Driver 3.x preserves the C# property initializer value = 1 when the
        // BSON field is absent). A client fetching it receives Version=1 and echoes back 1.
        // The soft-delete uses the legacy-aware filter so it succeeds on the first write.
        //
        // NOTE: The mock returns ModifiedCount=1 regardless of filter; the real behavior
        // is verified by LegacyDocumentIntegrationTests.LegacyDoc_FixedCasFilter_CasSoftDeleteWithVersion1_Succeeds.
        var exerciseId = Guid.NewGuid();
        var exercise = ExerciseTestHelpers.CreateExercise(
            externalId: exerciseId,
            isCustom: true,
            trainerId: _trainerId,
            source: "custom",
            version: 1);  // reflects actual deserialized value for a legacy field-absent doc

        var mongo = ExerciseTestHelpers.CreateMockMongo(exercise);
        var ep = CreateEndpoint(mongo);

        await ep.HandleAsync(new DeleteExerciseRequest { ExerciseId = exerciseId, Version = 1 }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);

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

        var act = () => ep.HandleAsync(new DeleteExerciseRequest { ExerciseId = exerciseId, Version = 1 }, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<ValidationFailureException>();
    }
}
