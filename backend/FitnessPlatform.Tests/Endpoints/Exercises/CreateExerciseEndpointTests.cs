using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Exercises.CreateExercise;
using FitnessPlatform.Tests.Endpoints;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Exercises;

/// <summary>
/// Tests for <see cref="CreateExerciseEndpoint"/>.
/// </summary>
public class CreateExerciseEndpointTests
{
    private readonly Guid _trainerId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_ValidRequest_CreatesExercise()
    {
        var mongo = ExerciseTestHelpers.CreateMockMongo();
        var ep = Factory.Create<CreateExerciseEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo);

        var request = new CreateExerciseRequest
        {
            Name = "Custom Press",
            MuscleGroups = [MuscleGroup.Chest, MuscleGroup.Triceps],
            Equipment = ExerciseEquipment.Barbell,
            Category = ExerciseCategory.Strength,
            Difficulty = ExerciseDifficulty.Intermediate
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await mongo.Exercises.Received(1).InsertOneAsync(
            Arg.Is<Exercise>(e =>
                e.Name == "Custom Press" &&
                e.Source == "custom" &&
                e.IsCustom &&
                e.TrainerId == _trainerId),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var mongo = ExerciseTestHelpers.CreateMockMongo();
        var ep = Factory.Create<CreateExerciseEndpoint>(mongo);

        await ep.HandleAsync(new CreateExerciseRequest
        {
            Name = "Test",
            MuscleGroups = [MuscleGroup.Chest]
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }
}
