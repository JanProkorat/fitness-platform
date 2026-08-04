using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FitnessPlatform.Application.Domain.Documents;
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
/// Integration tests for <c>POST /training/session-templates/{TemplateId}/copy</c>
/// (<see cref="Application.Features.SessionTemplates.CopySessionTemplate.CopySessionTemplateEndpoint"/>)
/// — only the success paths, which call <c>Send.CreatedAtAsync</c> and therefore need the real
/// <c>LinkGenerator</c> that <see cref="FitnessApiFactory"/> provides (unavailable in the
/// lightweight <c>Factory.Create&lt;T&gt;()</c> host used by <see cref="SessionTemplateEndpointTests"/>
/// for the 404 guard-branch case). Same precedent as <c>CopyMealTemplateEndpointTests</c>.
/// </summary>
[Collection(TestCollection.Name)]
public class CopySessionTemplateEndpointTests(FitnessApiFactory factory)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private static string UniqueEmail(string tag) => $"{Guid.NewGuid():N}@{tag}-copy-session-template-test.com";

    private async Task<(HttpClient Client, Guid TrainerId)> RegisterTrainerAsync(string tag)
    {
        var client = factory.CreateClient();
        var email = UniqueEmail(tag);
        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Copy", "SessionTemplateTest", "Trainer");
        var (accessToken, _) = await TestHelpers.LoginAsync(client, email, "TestPass1!");
        TestHelpers.SetBearerToken(client, accessToken);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.FirstAsync(
            u => u.Email == email, TestContext.Current.CancellationToken);

        return (client, user.Id);
    }

    private async Task<SessionTemplate> InsertTemplateAsync(Guid ownerId, LibraryVisibility visibility, string name)
    {
        var template = new SessionTemplate
        {
            ExternalId = Guid.NewGuid(),
            OwnerId = ownerId,
            Name = name,
            Difficulty = ExerciseDifficulty.Intermediate,
            Workouts =
            [
                new TrainingWorkout
                {
                    WorkoutId = Guid.NewGuid(),
                    Order = 0,
                    Name = "Main",
                    Exercises =
                    [
                        new SessionExercise
                        {
                            ExerciseExternalId = Guid.NewGuid(),
                            ExerciseName = "Test Exercise",
                            Order = 1
                        }
                    ]
                }
            ],
            Visibility = visibility,
            DateCreated = DateTime.UtcNow,
            Version = 1
        };

        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        await mongo.SessionTemplates.InsertOneAsync(template, cancellationToken: TestContext.Current.CancellationToken);
        return template;
    }

    private async Task<SessionTemplate?> FindByExternalIdAsync(Guid externalId)
    {
        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        return await mongo.SessionTemplates
            .Find(Builders<SessionTemplate>.Filter.Eq(t => t.ExternalId, externalId))
            .FirstOrDefaultAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task CopySessionTemplate_OtherOwnersPublic_Succeeds_NotForbidden()
    {
        // The property the AC pins: copy is read-guarded, not write-guarded — another owner's
        // Public template must remain copyable. Wiring the write guard here would wrongly 403.
        var (_, ownerId) = await RegisterTrainerAsync("owner");
        var (callerClient, callerId) = await RegisterTrainerAsync("caller");
        var source = await InsertTemplateAsync(ownerId, LibraryVisibility.Public, "Shared Session");

        var response = await callerClient.PostAsJsonAsync(
            $"/training/session-templates/{source.ExternalId}/copy",
            new { },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var body = await response.Content.ReadFromJsonAsync<SessionTemplateDetailResponse>(
            JsonOptions, TestContext.Current.CancellationToken);
        body!.TemplateId.Should().NotBe(source.ExternalId);

        var copy = await FindByExternalIdAsync(body.TemplateId);
        copy.Should().NotBeNull();
        copy!.OwnerId.Should().Be(callerId);
        copy.Visibility.Should().Be(LibraryVisibility.Private);

        var untouchedSource = await FindByExternalIdAsync(source.ExternalId);
        untouchedSource!.OwnerId.Should().Be(ownerId);
    }

    [Fact]
    public async Task CopySessionTemplate_OwnPrivate_Succeeds()
    {
        var (client, ownerId) = await RegisterTrainerAsync("owner");
        var source = await InsertTemplateAsync(ownerId, LibraryVisibility.Private, "My Session");

        var response = await client.PostAsJsonAsync(
            $"/training/session-templates/{source.ExternalId}/copy",
            new { },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }
}
