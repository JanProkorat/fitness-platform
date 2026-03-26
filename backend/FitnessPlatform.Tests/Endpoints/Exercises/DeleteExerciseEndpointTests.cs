using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.Exercises.DeleteExercise;
using FitnessPlatform.Tests.Endpoints;
using FluentValidation;

namespace FitnessPlatform.Tests.Endpoints.Exercises;

/// <summary>
/// Tests for <see cref="DeleteExerciseEndpoint"/>.
/// </summary>
public class DeleteExerciseEndpointTests
{
    private readonly Guid _trainerId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_OwnerDeletesCustomExercise_Returns204()
    {
        var exerciseId = Guid.NewGuid();
        var exercise = ExerciseTestHelpers.CreateExercise(
            externalId: exerciseId,
            isCustom: true,
            trainerId: _trainerId,
            source: "custom");
        var mongo = ExerciseTestHelpers.CreateMockMongo(exercise);

        var ep = Factory.Create<DeleteExerciseEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo);

        await ep.HandleAsync(new DeleteExerciseRequest { ExerciseId = exerciseId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);
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

        var ep = Factory.Create<DeleteExerciseEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo);

        var act = () => ep.HandleAsync(new DeleteExerciseRequest { ExerciseId = exerciseId }, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<ValidationFailureException>();
    }
}
