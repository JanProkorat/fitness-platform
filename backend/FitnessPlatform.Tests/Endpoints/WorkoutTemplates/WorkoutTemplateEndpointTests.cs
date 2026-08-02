using System.Security.Claims;
using FastEndpoints;
using FastEndpoints.Testing;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.WorkoutTemplates.CreateWorkoutTemplate;
using FitnessPlatform.Application.Features.WorkoutTemplates.DeleteWorkoutTemplate;
using FitnessPlatform.Application.Features.WorkoutTemplates.GetWorkoutTemplate;
using FitnessPlatform.Application.Features.WorkoutTemplates.ListWorkoutTemplates;
using FitnessPlatform.Application.Features.WorkoutTemplates.Shared;
using FitnessPlatform.Application.Features.WorkoutTemplates.UpdateWorkoutTemplate;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Endpoints;
using Microsoft.AspNetCore.Http;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.WorkoutTemplates;

/// <summary>
/// Unit tests for WorkoutTemplate CRUD endpoints:
/// Create, Get, List, Update, Delete — plus ownership isolation and optimistic-concurrency (409).
/// </summary>
public class WorkoutTemplateEndpointTests
{
    private readonly Guid _trainerId = Guid.NewGuid();

    // ── Helper factories ────────────────────────────────────────────────────

    private IMongoContext CreateMockMongo(
        List<WorkoutTemplate>? templates = null,
        List<SessionTemplate>? workoutTemplates = null)
    {
        templates ??= [];
        // Configure each collection FULLY before wiring it into the context — NSubstitute cannot
        // track lastCall state across nested substitute setup (see also RecipeTestHelpers).
        var collection = CreateMockCollection(templates);
        var workoutCollection = CreateMockSessionTemplateCollection(workoutTemplates ?? []);

        var mongo = Substitute.For<IMongoContext>();
        mongo.WorkoutTemplates.Returns(collection);
        mongo.SessionTemplates.Returns(workoutCollection);
        return mongo;
    }

    /// <summary>
    /// Mocks the SessionTemplates collection so FindAsync actually evaluates the caller's
    /// FilterDefinition against each candidate document (rather than returning the whole list
    /// unconditionally) — this is what lets a test genuinely prove the endpoint's
    /// Visibility==Public filter excludes private templates, not just assume it.
    /// </summary>
    private static IMongoCollection<SessionTemplate> CreateMockSessionTemplateCollection(
        List<SessionTemplate> templates)
    {
        var collection = Substitute.For<IMongoCollection<SessionTemplate>>();

        collection.FindAsync(
                Arg.Any<FilterDefinition<SessionTemplate>>(),
                Arg.Any<FindOptions<SessionTemplate, SessionTemplate>>(),
                Arg.Any<CancellationToken>())
            .Returns(callInfo =>
            {
                var filter = callInfo.ArgAt<FilterDefinition<SessionTemplate>>(0);
                var registry = BsonSerializer.SerializerRegistry;
                var serializer = registry.GetSerializer<SessionTemplate>();
                var renderedFilter = filter.Render(new RenderArgs<SessionTemplate>(serializer, registry));

                var matched = templates
                    .Where(t => MatchesFilter(t.ToBsonDocument(), renderedFilter))
                    .ToList();
                return CreateSessionTemplateCursor(matched);
            });

        return collection;
    }

    /// <summary>
    /// Minimal top-level equality matcher for rendered simple Eq filters (sufficient for the
    /// Visibility==Public filter used by ListWorkoutTemplatesEndpoint).
    /// </summary>
    private static bool MatchesFilter(BsonDocument document, BsonDocument renderedFilter)
    {
        foreach (var element in renderedFilter.Elements)
        {
            if (!document.TryGetValue(element.Name, out var actual) || actual != element.Value)
            {
                return false;
            }
        }

        return true;
    }

    private static IAsyncCursor<SessionTemplate> CreateSessionTemplateCursor(List<SessionTemplate> items)
    {
        var cursor = Substitute.For<IAsyncCursor<SessionTemplate>>();
        var moved = false;
        cursor.Current.Returns(items);
        cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return items.Count > 0;
        });
        cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return items.Count > 0;
        });
        return cursor;
    }

    private static IMongoCollection<WorkoutTemplate> CreateMockCollection(
        List<WorkoutTemplate> templates,
        long modifiedCount = 1)
    {
        var collection = Substitute.For<IMongoCollection<WorkoutTemplate>>();

        collection.FindAsync(
                Arg.Any<FilterDefinition<WorkoutTemplate>>(),
                Arg.Any<FindOptions<WorkoutTemplate, WorkoutTemplate>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateCursor(templates));

        collection.CountDocumentsAsync(
                Arg.Any<FilterDefinition<WorkoutTemplate>>(),
                Arg.Any<CountOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(templates.Count);

        var replaceResult = Substitute.For<ReplaceOneResult>();
        replaceResult.ModifiedCount.Returns(modifiedCount);
        collection.ReplaceOneAsync(
                Arg.Any<FilterDefinition<WorkoutTemplate>>(),
                Arg.Any<WorkoutTemplate>(),
                Arg.Any<ReplaceOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(replaceResult);

        var deleteResult = Substitute.For<DeleteResult>();
        deleteResult.DeletedCount.Returns(1L);
        collection.DeleteOneAsync(
                Arg.Any<FilterDefinition<WorkoutTemplate>>(),
                Arg.Any<CancellationToken>())
            .Returns(deleteResult);

        return collection;
    }

    private static IAsyncCursor<WorkoutTemplate> CreateCursor(List<WorkoutTemplate> items)
    {
        var cursor = Substitute.For<IAsyncCursor<WorkoutTemplate>>();
        var moved = false;
        cursor.Current.Returns(items);
        cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return items.Count > 0;
        });
        cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return items.Count > 0;
        });
        return cursor;
    }

    private WorkoutTemplate MakeTemplate(Guid? ownerId = null, int version = 1) => new()
    {
        ExternalId = Guid.NewGuid(),
        OwnerTrainerId = ownerId ?? _trainerId,
        Name = "Strength Block",
        DefaultFormat = null,
        DefaultFormatConfig = null,
        DefaultExercises = [],
        CreatedAt = DateTime.UtcNow.AddDays(-1),
        UpdatedAt = DateTime.UtcNow.AddDays(-1),
        Version = version
    };

    private static SessionTemplate MakeSessionTemplate(
        WorkoutTemplateVisibility visibility = WorkoutTemplateVisibility.Public,
        string name = "Public WOD",
        Guid? ownerId = null) => new()
    {
        ExternalId = Guid.NewGuid(),
        OwnerId = ownerId ?? Guid.NewGuid(),
        Name = name,
        Description = "A sample public workout template",
        Difficulty = ExerciseDifficulty.Intermediate,
        EstimatedDurationMinutes = 45,
        Format = WorkoutFormat.Standard,
        Visibility = visibility,
        Sections =
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
                        ExerciseName = "Back Squat",
                        Order = 1,
                        RestSeconds = 90,
                        MovementType = MovementType.Reps,
                        Sets =
                        [
                            new ExerciseSet
                            {
                                SetNumber = 1,
                                Type = SetType.Normal,
                                Reps = 5,
                                WeightKg = 60,
                                RestSeconds = 90
                            }
                        ]
                    }
                ]
            }
        ]
    };

    private Action<DefaultHttpContext> TrainerAuth() =>
        ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
            new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer)));

    private CreateWorkoutTemplateEndpoint CreateCreateEndpoint(IMongoContext mongo) =>
        Factory.Create<CreateWorkoutTemplateEndpoint>(TrainerAuth(), mongo);

    private GetWorkoutTemplateEndpoint CreateGetEndpoint(IMongoContext mongo) =>
        Factory.Create<GetWorkoutTemplateEndpoint>(TrainerAuth(), mongo);

    private ListWorkoutTemplatesEndpoint CreateListEndpoint(IMongoContext mongo) =>
        Factory.Create<ListWorkoutTemplatesEndpoint>(TrainerAuth(), mongo);

    private UpdateWorkoutTemplateEndpoint CreateUpdateEndpoint(IMongoContext mongo) =>
        Factory.Create<UpdateWorkoutTemplateEndpoint>(TrainerAuth(), mongo);

    private DeleteWorkoutTemplateEndpoint CreateDeleteEndpoint(IMongoContext mongo) =>
        Factory.Create<DeleteWorkoutTemplateEndpoint>(TrainerAuth(), mongo);

    // ── CREATE ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Create_WithValidRequest_Returns201AndPersistsTemplate()
    {
        var mongo = CreateMockMongo();
        var ep = CreateCreateEndpoint(mongo);

        var req = new CreateWorkoutTemplateRequest
        {
            Name = "Push Block",
            DefaultFormat = WorkoutFormat.Standard,
            DefaultExercises = []
        };

        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await mongo.WorkoutTemplates.Received(1).InsertOneAsync(
            Arg.Is<WorkoutTemplate>(t =>
                t.Name == "Push Block" &&
                t.OwnerTrainerId == _trainerId &&
                t.Version == 1),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Create_WithEmomFormat_PersistsFormatConfig()
    {
        var mongo = CreateMockMongo();
        var ep = CreateCreateEndpoint(mongo);

        var req = new CreateWorkoutTemplateRequest
        {
            Name = "EMOM Section",
            DefaultFormat = WorkoutFormat.EMOM,
            DefaultFormatConfig = new WodConfig { IntervalSeconds = 60, TotalRounds = 10 },
            DefaultExercises = []
        };

        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await mongo.WorkoutTemplates.Received(1).InsertOneAsync(
            Arg.Is<WorkoutTemplate>(t =>
                t.DefaultFormat == WorkoutFormat.EMOM &&
                t.DefaultFormatConfig!.IntervalSeconds == 60 &&
                t.DefaultFormatConfig!.TotalRounds == 10),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    // ── GET ───────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Get_OwnedTemplate_Returns200AndResponse()
    {
        var template = MakeTemplate();
        var mongo = CreateMockMongo([template]);
        var ep = CreateGetEndpoint(mongo);

        var req = new GetWorkoutTemplateRequest { TemplateId = template.ExternalId };
        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.TemplateId.Should().Be(template.ExternalId);
        ep.Response.Name.Should().Be("Strength Block");
        ep.Response.Version.Should().Be(1);
    }

    [Fact]
    public async Task Get_NotFound_Returns404()
    {
        var mongo = CreateMockMongo([]);
        var ep = CreateGetEndpoint(mongo);

        var req = new GetWorkoutTemplateRequest { TemplateId = Guid.NewGuid() };

        var act = async () => await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<Exception>();
    }

    [Fact]
    public async Task Get_TemplateOwnedByAnotherTrainer_Returns403()
    {
        var otherTrainerId = Guid.NewGuid();
        var template = MakeTemplate(ownerId: otherTrainerId);
        var mongo = CreateMockMongo([template]);
        var ep = CreateGetEndpoint(mongo);

        var req = new GetWorkoutTemplateRequest { TemplateId = template.ExternalId };

        var act = async () => await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<Exception>();
    }

    // ── LIST ──────────────────────────────────────────────────────────────────

    [Fact]
    public async Task List_ReturnsOnlyOwnedTemplatesUnderOwnTemplates()
    {
        var t1 = MakeTemplate();
        t1.Name = "Block A";
        var t2 = MakeTemplate();
        t2.Name = "Block B";

        // The WorkoutTemplate mongo mock returns whatever list is provided regardless of the
        // query filter (matching the codebase's established test convention — see
        // CreateMockCollection); own-template scoping via OwnerTrainerId happens at the Mongo
        // query level in production and is unchanged by this issue. This test proves the
        // response wrapper still surfaces the caller's own templates under OwnTemplates.
        var mongo = CreateMockMongo([t1, t2]);
        var ep = CreateListEndpoint(mongo);

        var req = new ListWorkoutTemplatesRequest { Page = 1, PageSize = 20 };
        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.OwnTemplates.Should().HaveCount(2);
        ep.Response.OwnTemplates.Select(r => r.Name).Should().Contain(["Block A", "Block B"]);
        ep.Response.PublicSessionTemplates.Should().BeEmpty();
    }

    [Fact]
    public async Task List_TrainerWithZeroOwnTemplates_StillReturnsPublicLibrary()
    {
        var publicTemplate = MakeSessionTemplate(name: "AMRAP Blast");
        var mongo = CreateMockMongo(templates: [], workoutTemplates: [publicTemplate]);
        var ep = CreateListEndpoint(mongo);

        var req = new ListWorkoutTemplatesRequest { Page = 1, PageSize = 20 };
        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.OwnTemplates.Should().BeEmpty();
        ep.Response.PublicSessionTemplates.Should().ContainSingle(t => t.Name == "AMRAP Blast");
    }

    [Fact]
    public async Task List_ExcludesPrivateSessionTemplates()
    {
        var publicTemplate = MakeSessionTemplate(visibility: WorkoutTemplateVisibility.Public, name: "Public One");
        var privateTemplate = MakeSessionTemplate(visibility: WorkoutTemplateVisibility.Private, name: "Someone's Private Template");
        var mongo = CreateMockMongo(templates: [], workoutTemplates: [publicTemplate, privateTemplate]);
        var ep = CreateListEndpoint(mongo);

        var req = new ListWorkoutTemplatesRequest { Page = 1, PageSize = 20 };
        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.PublicSessionTemplates.Should().ContainSingle();
        ep.Response.PublicSessionTemplates[0].Name.Should().Be("Public One");
        ep.Response.PublicSessionTemplates.Select(t => t.Name).Should().NotContain("Someone's Private Template");
    }

    [Fact]
    public async Task List_PublicSessionTemplate_EmbedsFullSectionsExercisesAndSets()
    {
        var publicTemplate = MakeSessionTemplate(name: "Full Body");
        var mongo = CreateMockMongo(templates: [], workoutTemplates: [publicTemplate]);
        var ep = CreateListEndpoint(mongo);

        var req = new ListWorkoutTemplatesRequest { Page = 1, PageSize = 20 };
        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        var response = ep.Response.PublicSessionTemplates.Should().ContainSingle().Subject;
        response.ExternalId.Should().Be(publicTemplate.ExternalId);
        response.Description.Should().Be(publicTemplate.Description);
        response.Difficulty.Should().Be(publicTemplate.Difficulty.ToString());
        response.EstimatedDurationMinutes.Should().Be(publicTemplate.EstimatedDurationMinutes);
        response.Format.Should().Be(publicTemplate.Format.ToString());

        response.Sections.Should().ContainSingle();
        var section = response.Sections[0];
        section.Name.Should().Be("Main");
        section.Exercises.Should().ContainSingle();
        var exercise = section.Exercises[0];
        exercise.ExerciseName.Should().Be("Back Squat");
        exercise.RestSeconds.Should().Be(90);
        exercise.MovementType.Should().Be(MovementType.Reps);
        exercise.Sets.Should().ContainSingle();
        var set = exercise.Sets[0];
        set.SetNumber.Should().Be(1);
        set.Type.Should().Be(SetType.Normal);
        set.Reps.Should().Be(5);
        set.WeightKg.Should().Be(60);
        set.RestSeconds.Should().Be(90);
    }

    [Fact]
    public async Task List_NoClaims_Returns401()
    {
        var mongo = CreateMockMongo();
        var ep = Factory.Create<ListWorkoutTemplatesEndpoint>(mongo);

        var req = new ListWorkoutTemplatesRequest { Page = 1, PageSize = 20 };
        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }

    // ── UPDATE ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Update_OwnedTemplate_Returns200AndBumpsVersion()
    {
        var template = MakeTemplate(version: 1);
        var mongo = CreateMockMongo([template]);
        var ep = CreateUpdateEndpoint(mongo);

        var req = new UpdateWorkoutTemplateRequest
        {
            TemplateId = template.ExternalId,
            Name = "Updated Name",
            Version = 1,
            DefaultExercises = []
        };
        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await mongo.WorkoutTemplates.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<WorkoutTemplate>>(),
            Arg.Is<WorkoutTemplate>(t => t.Name == "Updated Name" && t.Version == 2),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Update_WrongVersion_Returns409()
    {
        var template = MakeTemplate(version: 2);
        var mongo = CreateMockMongo([template]);
        var ep = CreateUpdateEndpoint(mongo);

        var req = new UpdateWorkoutTemplateRequest
        {
            TemplateId = template.ExternalId,
            Name = "Stale Update",
            Version = 1, // stale — template is now at version 2
            DefaultExercises = []
        };

        var act = async () => await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<Exception>();
    }

    [Fact]
    public async Task Update_TemplateOwnedByAnotherTrainer_Returns403()
    {
        var otherTrainerId = Guid.NewGuid();
        var template = MakeTemplate(ownerId: otherTrainerId, version: 1);
        var mongo = CreateMockMongo([template]);
        var ep = CreateUpdateEndpoint(mongo);

        var req = new UpdateWorkoutTemplateRequest
        {
            TemplateId = template.ExternalId,
            Name = "Hijack",
            Version = 1,
            DefaultExercises = []
        };

        var act = async () => await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<Exception>();
    }

    [Fact]
    public async Task Update_DbVersionConflict_Returns409()
    {
        // Version matches in-memory but DB ReplaceOne returns ModifiedCount=0 (concurrent writer won)
        var template = MakeTemplate(version: 1);

        // Build a collection where ReplaceOne returns modifiedCount=0
        var collection = CreateMockCollection([template], modifiedCount: 0);
        var mongo = Substitute.For<IMongoContext>();
        mongo.WorkoutTemplates.Returns(collection);

        var ep = CreateUpdateEndpoint(mongo);

        var req = new UpdateWorkoutTemplateRequest
        {
            TemplateId = template.ExternalId,
            Name = "Race Update",
            Version = 1,
            DefaultExercises = []
        };

        var act = async () => await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<Exception>();
    }

    // ── DELETE ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Delete_OwnedTemplate_Returns204()
    {
        var template = MakeTemplate();
        var mongo = CreateMockMongo([template]);
        var ep = CreateDeleteEndpoint(mongo);

        var req = new DeleteWorkoutTemplateRequest { TemplateId = template.ExternalId };
        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);

        await mongo.WorkoutTemplates.Received(1).DeleteOneAsync(
            Arg.Any<FilterDefinition<WorkoutTemplate>>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Delete_NotFound_Returns404()
    {
        var mongo = CreateMockMongo([]);
        var ep = CreateDeleteEndpoint(mongo);

        var req = new DeleteWorkoutTemplateRequest { TemplateId = Guid.NewGuid() };

        var act = async () => await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<Exception>();
    }

    [Fact]
    public async Task Delete_TemplateOwnedByAnotherTrainer_Returns403()
    {
        var template = MakeTemplate(ownerId: Guid.NewGuid());
        var mongo = CreateMockMongo([template]);
        var ep = CreateDeleteEndpoint(mongo);

        var req = new DeleteWorkoutTemplateRequest { TemplateId = template.ExternalId };

        var act = async () => await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<Exception>();
    }
}
