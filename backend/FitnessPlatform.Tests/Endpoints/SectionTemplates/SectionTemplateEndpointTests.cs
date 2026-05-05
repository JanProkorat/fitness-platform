using System.Security.Claims;
using FastEndpoints;
using FastEndpoints.Testing;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.SectionTemplates.CreateSectionTemplate;
using FitnessPlatform.Application.Features.SectionTemplates.DeleteSectionTemplate;
using FitnessPlatform.Application.Features.SectionTemplates.GetSectionTemplate;
using FitnessPlatform.Application.Features.SectionTemplates.ListSectionTemplates;
using FitnessPlatform.Application.Features.SectionTemplates.Shared;
using FitnessPlatform.Application.Features.SectionTemplates.UpdateSectionTemplate;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Endpoints;
using Microsoft.AspNetCore.Http;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.SectionTemplates;

/// <summary>
/// Unit tests for SectionTemplate CRUD endpoints:
/// Create, Get, List, Update, Delete — plus ownership isolation and optimistic-concurrency (409).
/// </summary>
public class SectionTemplateEndpointTests
{
    private readonly Guid _trainerId = Guid.NewGuid();

    // ── Helper factories ────────────────────────────────────────────────────

    private IMongoContext CreateMockMongo(List<SectionTemplate>? templates = null)
    {
        templates ??= [];
        var mongo = Substitute.For<IMongoContext>();
        var collection = CreateMockCollection(templates);
        mongo.SectionTemplates.Returns(collection);
        return mongo;
    }

    private static IMongoCollection<SectionTemplate> CreateMockCollection(
        List<SectionTemplate> templates,
        long modifiedCount = 1)
    {
        var collection = Substitute.For<IMongoCollection<SectionTemplate>>();

        collection.FindAsync(
                Arg.Any<FilterDefinition<SectionTemplate>>(),
                Arg.Any<FindOptions<SectionTemplate, SectionTemplate>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateCursor(templates));

        collection.CountDocumentsAsync(
                Arg.Any<FilterDefinition<SectionTemplate>>(),
                Arg.Any<CountOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(templates.Count);

        var replaceResult = Substitute.For<ReplaceOneResult>();
        replaceResult.ModifiedCount.Returns(modifiedCount);
        collection.ReplaceOneAsync(
                Arg.Any<FilterDefinition<SectionTemplate>>(),
                Arg.Any<SectionTemplate>(),
                Arg.Any<ReplaceOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(replaceResult);

        var deleteResult = Substitute.For<DeleteResult>();
        deleteResult.DeletedCount.Returns(1L);
        collection.DeleteOneAsync(
                Arg.Any<FilterDefinition<SectionTemplate>>(),
                Arg.Any<CancellationToken>())
            .Returns(deleteResult);

        return collection;
    }

    private static IAsyncCursor<SectionTemplate> CreateCursor(List<SectionTemplate> items)
    {
        var cursor = Substitute.For<IAsyncCursor<SectionTemplate>>();
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

    private SectionTemplate MakeTemplate(Guid? ownerId = null, int version = 1) => new()
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

    private Action<DefaultHttpContext> TrainerAuth() =>
        ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
            new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer)));

    private CreateSectionTemplateEndpoint CreateCreateEndpoint(IMongoContext mongo) =>
        Factory.Create<CreateSectionTemplateEndpoint>(TrainerAuth(), mongo);

    private GetSectionTemplateEndpoint CreateGetEndpoint(IMongoContext mongo) =>
        Factory.Create<GetSectionTemplateEndpoint>(TrainerAuth(), mongo);

    private ListSectionTemplatesEndpoint CreateListEndpoint(IMongoContext mongo) =>
        Factory.Create<ListSectionTemplatesEndpoint>(TrainerAuth(), mongo);

    private UpdateSectionTemplateEndpoint CreateUpdateEndpoint(IMongoContext mongo) =>
        Factory.Create<UpdateSectionTemplateEndpoint>(TrainerAuth(), mongo);

    private DeleteSectionTemplateEndpoint CreateDeleteEndpoint(IMongoContext mongo) =>
        Factory.Create<DeleteSectionTemplateEndpoint>(TrainerAuth(), mongo);

    // ── CREATE ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Create_WithValidRequest_Returns201AndPersistsTemplate()
    {
        var mongo = CreateMockMongo();
        var ep = CreateCreateEndpoint(mongo);

        var req = new CreateSectionTemplateRequest
        {
            Name = "Push Block",
            DefaultFormat = WorkoutFormat.Standard,
            DefaultExercises = []
        };

        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await mongo.SectionTemplates.Received(1).InsertOneAsync(
            Arg.Is<SectionTemplate>(t =>
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

        var req = new CreateSectionTemplateRequest
        {
            Name = "EMOM Section",
            DefaultFormat = WorkoutFormat.EMOM,
            DefaultFormatConfig = new WodConfig { IntervalSeconds = 60, TotalRounds = 10 },
            DefaultExercises = []
        };

        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await mongo.SectionTemplates.Received(1).InsertOneAsync(
            Arg.Is<SectionTemplate>(t =>
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

        var req = new GetSectionTemplateRequest { TemplateId = template.ExternalId };
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

        var req = new GetSectionTemplateRequest { TemplateId = Guid.NewGuid() };

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

        var req = new GetSectionTemplateRequest { TemplateId = template.ExternalId };

        var act = async () => await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<Exception>();
    }

    // ── LIST ──────────────────────────────────────────────────────────────────

    [Fact]
    public async Task List_ReturnsOnlyOwnedTemplates()
    {
        var t1 = MakeTemplate();
        t1.Name = "Block A";
        var t2 = MakeTemplate();
        t2.Name = "Block B";
        var mongo = CreateMockMongo([t1, t2]);
        var ep = CreateListEndpoint(mongo);

        var req = new ListSectionTemplatesRequest { Page = 1, PageSize = 20 };
        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.Should().HaveCount(2);
        ep.Response.Select(r => r.Name).Should().Contain(["Block A", "Block B"]);
    }

    // ── UPDATE ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Update_OwnedTemplate_Returns200AndBumpsVersion()
    {
        var template = MakeTemplate(version: 1);
        var mongo = CreateMockMongo([template]);
        var ep = CreateUpdateEndpoint(mongo);

        var req = new UpdateSectionTemplateRequest
        {
            TemplateId = template.ExternalId,
            Name = "Updated Name",
            Version = 1,
            DefaultExercises = []
        };
        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await mongo.SectionTemplates.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<SectionTemplate>>(),
            Arg.Is<SectionTemplate>(t => t.Name == "Updated Name" && t.Version == 2),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Update_WrongVersion_Returns409()
    {
        var template = MakeTemplate(version: 2);
        var mongo = CreateMockMongo([template]);
        var ep = CreateUpdateEndpoint(mongo);

        var req = new UpdateSectionTemplateRequest
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

        var req = new UpdateSectionTemplateRequest
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
        mongo.SectionTemplates.Returns(collection);

        var ep = CreateUpdateEndpoint(mongo);

        var req = new UpdateSectionTemplateRequest
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

        var req = new DeleteSectionTemplateRequest { TemplateId = template.ExternalId };
        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);

        await mongo.SectionTemplates.Received(1).DeleteOneAsync(
            Arg.Any<FilterDefinition<SectionTemplate>>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Delete_NotFound_Returns404()
    {
        var mongo = CreateMockMongo([]);
        var ep = CreateDeleteEndpoint(mongo);

        var req = new DeleteSectionTemplateRequest { TemplateId = Guid.NewGuid() };

        var act = async () => await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<Exception>();
    }

    [Fact]
    public async Task Delete_TemplateOwnedByAnotherTrainer_Returns403()
    {
        var template = MakeTemplate(ownerId: Guid.NewGuid());
        var mongo = CreateMockMongo([template]);
        var ep = CreateDeleteEndpoint(mongo);

        var req = new DeleteSectionTemplateRequest { TemplateId = template.ExternalId };

        var act = async () => await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<Exception>();
    }
}
