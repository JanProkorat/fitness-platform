using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.SessionTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;

namespace FitnessPlatform.Tests.Endpoints.SessionTemplates;

/// <summary>
/// Integration test for <c>POST /training/session-templates</c>
/// (<see cref="Application.Features.SessionTemplates.CreateSessionTemplate.CreateSessionTemplateEndpoint"/>).
/// Uses <see cref="FitnessApiFactory"/> (Testcontainers-backed PostgreSQL + MongoDB) rather than
/// the lightweight <c>Factory.Create&lt;T&gt;()</c> host used by <see cref="SessionTemplateEndpointTests"/>
/// — the endpoint's success path calls <c>Send.CreatedAtAsync</c>, which requires a real
/// <c>LinkGenerator</c>, unavailable in that lightweight host (same precedent as
/// <c>CreateMealTemplateEndpointTests</c>).
/// </summary>
[Collection(TestCollection.Name)]
public class CreateSessionTemplateEndpointTests(FitnessApiFactory factory)
{
    // The API serializes enums as strings (JsonStringEnumConverter globally), so use matching
    // options when deserializing the test response.
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private static string UniqueEmail() => $"{Guid.NewGuid():N}@create-session-template-test.com";

    private async Task<(HttpClient Client, Guid TrainerId)> RegisterTrainerAsync()
    {
        var client = factory.CreateClient();
        var email = UniqueEmail();
        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Create", "SessionTemplateTest", "Trainer");
        var (accessToken, _) = await TestHelpers.LoginAsync(client, email, "TestPass1!");
        TestHelpers.SetBearerToken(client, accessToken);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.FirstAsync(
            u => u.Email == email, TestContext.Current.CancellationToken);

        return (client, user.Id);
    }

    [Fact]
    public async Task CreateSessionTemplate_ValidRequest_PersistsAsPrivateVersionOne()
    {
        var (client, trainerId) = await RegisterTrainerAsync();

        var response = await client.PostAsJsonAsync(
            "/training/session-templates",
            new
            {
                Name = "Push Day",
                Difficulty = "Beginner",
                Workouts = new[]
                {
                    new
                    {
                        WorkoutId = Guid.NewGuid(),
                        Order = 0,
                        Name = "Main",
                        Exercises = new[]
                        {
                            new
                            {
                                ExerciseExternalId = Guid.NewGuid(),
                                ExerciseName = "Bench Press",
                                Order = 1
                            }
                        }
                    }
                }
            },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var body = await response.Content.ReadFromJsonAsync<SessionTemplateDetailResponse>(
            JsonOptions, TestContext.Current.CancellationToken);
        body!.Name.Should().Be("Push Day");
        body.Workouts.Should().ContainSingle();
        body.AllExercises.Should().ContainSingle();

        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        var persisted = await mongo.SessionTemplates
            .Find(t => t.ExternalId == body.TemplateId)
            .FirstOrDefaultAsync(TestContext.Current.CancellationToken);

        persisted.Should().NotBeNull();
        persisted!.OwnerId.Should().Be(trainerId);
        // The `= Public` initializer is gone — a newly created template defaults to Private.
        persisted.Visibility.Should().Be(LibraryVisibility.Private);
        persisted.Version.Should().Be(1);
    }
}
