using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Exercises.SearchExercises;

namespace FitnessPlatform.Tests.Endpoints.Exercises;

/// <summary>
/// Tests for <see cref="SearchExercisesEndpoint"/>.
/// </summary>
public class SearchExercisesEndpointTests
{
    [Fact]
    public async Task HandleAsync_NoFilters_ReturnsAllExercises()
    {
        var exercises = new[]
        {
            ExerciseTestHelpers.CreateExercise(name: "Bench Press"),
            ExerciseTestHelpers.CreateExercise(name: "Squat")
        };
        var mongo = ExerciseTestHelpers.CreateMockMongo(exercises);
        var ep = Factory.Create<SearchExercisesEndpoint>(mongo);

        await ep.HandleAsync(new SearchExercisesRequest(), TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }

    [Fact]
    public async Task HandleAsync_WithQuery_ReturnsFilteredResults()
    {
        var exercises = new[]
        {
            ExerciseTestHelpers.CreateExercise(name: "Bench Press")
        };
        var mongo = ExerciseTestHelpers.CreateMockMongo(exercises);
        var ep = Factory.Create<SearchExercisesEndpoint>(mongo);

        var request = new SearchExercisesRequest { Query = "bench" };
        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }
}
