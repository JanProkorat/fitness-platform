using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Exercises.UpdateExercise;
using FitnessPlatform.Tests.Endpoints;
using FluentValidation;

namespace FitnessPlatform.Tests.Endpoints.Exercises;

/// <summary>
/// Tests for <see cref="UpdateExerciseEndpoint"/>.
/// </summary>
public class UpdateExerciseEndpointTests
{
    private readonly Guid _trainerId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_OwnerUpdatesCustomExercise_Returns200()
    {
        var exerciseId = Guid.NewGuid();
        var exercise = ExerciseTestHelpers.CreateExercise(
            externalId: exerciseId,
            isCustom: true,
            trainerId: _trainerId,
            source: "custom");
        var mongo = ExerciseTestHelpers.CreateMockMongo(exercise);

        var ep = Factory.Create<UpdateExerciseEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo);

        var request = new UpdateExerciseRequest
        {
            ExerciseId = exerciseId,
            Name = "Updated Exercise",
            MuscleGroups = [MuscleGroup.Back],
            Equipment = ExerciseEquipment.Barbell,
            Category = ExerciseCategory.Strength,
            Difficulty = ExerciseDifficulty.Advanced
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
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

        var ep = Factory.Create<UpdateExerciseEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo);

        var request = new UpdateExerciseRequest
        {
            ExerciseId = exerciseId,
            Name = "Hacked",
            MuscleGroups = [MuscleGroup.Chest],
            Equipment = ExerciseEquipment.None,
            Category = ExerciseCategory.Strength,
            Difficulty = ExerciseDifficulty.Beginner
        };

        var act = () => ep.HandleAsync(request, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<ValidationFailureException>();
    }
}
