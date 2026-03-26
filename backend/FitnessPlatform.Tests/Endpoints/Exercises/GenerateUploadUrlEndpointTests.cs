using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Exercises.GenerateUploadUrl;
using FitnessPlatform.Tests.Endpoints;
using FluentValidation;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Exercises;

/// <summary>
/// Tests for <see cref="GenerateUploadUrlEndpoint"/>.
/// </summary>
public class GenerateUploadUrlEndpointTests
{
    private readonly Guid _trainerId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_ValidRequest_ReturnsUploadUrl()
    {
        var exerciseId = Guid.NewGuid();
        var exercise = ExerciseTestHelpers.CreateExercise(
            externalId: exerciseId,
            isCustom: true,
            trainerId: _trainerId,
            source: "custom");
        var mongo = ExerciseTestHelpers.CreateMockMongo(exercise);

        var blobStorage = Substitute.For<IBlobStorageService>();
        blobStorage.GenerateUploadUrlAsync(
                Arg.Any<string>(),
                Arg.Any<string>(),
                Arg.Any<TimeSpan>(),
                Arg.Any<CancellationToken>())
            .Returns(new BlobUploadUrl("https://minio/upload?token=abc", "https://minio/fitness-platform/exercises/videos/test.mp4"));

        var ep = Factory.Create<GenerateUploadUrlEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, blobStorage);

        await ep.HandleAsync(new GenerateUploadUrlRequest
        {
            ExerciseId = exerciseId,
            ContentType = "video/mp4"
        }, TestContext.Current.CancellationToken);

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
        var blobStorage = Substitute.For<IBlobStorageService>();

        var ep = Factory.Create<GenerateUploadUrlEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, blobStorage);

        var act = () => ep.HandleAsync(new GenerateUploadUrlRequest
        {
            ExerciseId = exerciseId,
            ContentType = "video/mp4"
        }, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<ValidationFailureException>();
    }
}
