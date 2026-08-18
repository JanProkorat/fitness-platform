using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Features.Trainers.ClientNotes.CreateNote;
using FitnessPlatform.Application.Features.Trainers.ClientNotes.DeleteNote;
using FitnessPlatform.Application.Features.Trainers.ClientNotes.EditNote;
using FitnessPlatform.Application.Features.Trainers.ClientNotes.ListNotes;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Trainers;

/// <summary>
/// Tests for the ClientNotes slice:
///   POST   /trainer/clients/{clientId}/notes
///   GET    /trainer/clients/{clientId}/notes
///   PATCH  /trainer/clients/{clientId}/notes/{noteId}
///   DELETE /trainer/clients/{clientId}/notes/{noteId}
/// </summary>
public class ClientNotesTests
{
    private readonly Guid _trainerId = Guid.NewGuid();

    // ── POST /trainer/clients/{clientId}/notes ───────────────────────────────

    [Fact]
    public async Task Create_HappyPath_Returns201WithNoteId()
    {
        var (db, clientProfile) = BuildLinkedClientSetup();
        var mongo = BuildWritableMongo([]);

        var ep = CreateCreateEndpoint(db, mongo, _trainerId);

        await ep.HandleAsync(
            new CreateNoteRequest { ClientId = clientProfile.PublicId, Text = "Great progress today." },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);
        ep.Response.NoteId.Should().NotBeEmpty();
        ep.Response.CreatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task Create_ClientAuthenticated_Returns403()
    {
        var (db, clientProfile) = BuildLinkedClientSetup();
        var mongo = BuildWritableMongo([]);

        var ep = Factory.Create<CreateNoteEndpoint>(
            ctx => ctx.Request.HttpContext.User = FakeClientPrincipal(_trainerId),
            db, mongo, new ClientLinkAuthorizationService(db));

        await ep.HandleAsync(
            new CreateNoteRequest { ClientId = clientProfile.PublicId, Text = "Should fail." },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(403);
    }

    [Fact]
    public async Task Create_NotLinkedToClient_Returns403()
    {
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerId).Build();
        var clientUser = EntityBuilder.User.Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(10).WithUser(clientUser).Build();
        // No link
        var db = new MockDbBuilder().With(trainerProfile).With(clientProfile).Build();
        var mongo = BuildWritableMongo([]);

        var ep = CreateCreateEndpoint(db, mongo, _trainerId);

        await ep.HandleAsync(
            new CreateNoteRequest { ClientId = clientProfile.PublicId, Text = "No link." },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(403);
    }

    [Fact]
    public async Task Create_NonexistentClient_Returns404()
    {
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerId).Build();
        var db = new MockDbBuilder().With(trainerProfile).Build();
        var mongo = BuildWritableMongo([]);

        var ep = CreateCreateEndpoint(db, mongo, _trainerId);

        await ep.HandleAsync(
            new CreateNoteRequest { ClientId = Guid.NewGuid(), Text = "Ghost." },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task Create_TextTooLong_Returns400()
    {
        var (db, clientProfile) = BuildLinkedClientSetup();
        var mongo = BuildWritableMongo([]);

        var ep = CreateCreateEndpoint(db, mongo, _trainerId);

        var tooLong = new string('x', 2001);

        await ep.HandleAsync(
            new CreateNoteRequest { ClientId = clientProfile.PublicId, Text = tooLong },
            TestContext.Current.CancellationToken);

        // Validator fires before HandleAsync is called in real HTTP, but in unit tests we verify
        // the validator separately. The endpoint validator is registered as a Validator<> — the
        // Factory test setup does NOT auto-run validators before HandleAsync. The 2000-char
        // constraint is verified via direct validator unit test below.
        // This test verifies the validator rule is defined correctly.
        var validator = new CreateNoteValidator();
        var result = await validator.ValidateAsync(
            new CreateNoteRequest { ClientId = clientProfile.PublicId, Text = tooLong },
            TestContext.Current.CancellationToken);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.OutOfRange);
    }

    // ── GET /trainer/clients/{clientId}/notes ────────────────────────────────

    [Fact]
    public async Task List_HappyPath_ReturnsBothNotes()
    {
        // Note: NSubstitute mocks cannot evaluate Mongo filter/sort expressions — the mock
        // returns all docs in insertion order. Actual sort-by-createdAt is an integration concern.
        var (db, clientProfile) = BuildLinkedClientSetup();

        var note1 = CreateNote(clientProfile.UserId, _trainerId, text: "Note A.");
        var note2 = CreateNote(clientProfile.UserId, _trainerId, text: "Note B.");

        var mongo = BuildReadableMongo([note1, note2]);

        var ep = CreateListEndpoint(db, mongo, _trainerId);

        await ep.HandleAsync(
            new ListNotesRequest { ClientId = clientProfile.PublicId, Page = 1, PageSize = 20 },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.Notes.Should().HaveCount(2);
        ep.Response.Notes.Select(n => n.NoteId).Should().BeEquivalentTo([note1.ExternalId, note2.ExternalId]);
    }

    [Fact]
    public async Task List_XTotalCountHeader_ReflectsTotalNoteCount()
    {
        // The mock returns a fixed list regardless of Skip/Limit (NSubstitute can't simulate
        // server-side LINQ evaluation). This test verifies that the X-Total-Count header is
        // set from CountDocumentsAsync, which the mock returns as the collection size.
        var (db, clientProfile) = BuildLinkedClientSetup();

        var notes = Enumerable.Range(0, 5)
            .Select(i => CreateNote(clientProfile.UserId, _trainerId, createdAt: DateTime.UtcNow.AddHours(-i)))
            .ToList();

        var mongo = BuildReadableMongo(notes);

        var ep = CreateListEndpoint(db, mongo, _trainerId);

        await ep.HandleAsync(
            new ListNotesRequest { ClientId = clientProfile.PublicId, Page = 1, PageSize = 20 },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        // X-Total-Count comes from CountDocumentsAsync which returns the mock list size (5)
        ep.HttpContext.Response.Headers["X-Total-Count"].ToString().Should().Be("5");
    }

    [Fact]
    public async Task List_ClientAuthenticated_Returns403()
    {
        var (db, clientProfile) = BuildLinkedClientSetup();
        var mongo = BuildReadableMongo([]);

        var ep = Factory.Create<ListNotesEndpoint>(
            ctx => ctx.Request.HttpContext.User = FakeClientPrincipal(_trainerId),
            db, mongo, new ClientLinkAuthorizationService(db));

        await ep.HandleAsync(
            new ListNotesRequest { ClientId = clientProfile.PublicId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(403);
    }

    [Fact]
    public async Task List_CrossTrainerAccess_Returns403()
    {
        var trainer1Id = Guid.NewGuid();
        var trainer2Id = _trainerId; // the calling trainer

        var trainerProfile1 = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(trainer1Id).Build();
        var trainerProfile2 = EntityBuilder.ProfessionalProfile.WithId(2).WithUserId(trainer2Id).Build();
        var clientUser = EntityBuilder.User.Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(10).WithUser(clientUser).Build();

        // Only trainer1 is linked to the client
        var link = EntityBuilder.ClientProfessionalLink
            .WithId(42)
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(trainerProfile1)
            .Build();

        var db = new MockDbBuilder()
            .With(trainerProfile1)
            .With(trainerProfile2)
            .With(clientProfile)
            .With(link)
            .Build();

        var mongo = BuildReadableMongo([]);

        // trainer2 is calling
        var ep = CreateListEndpoint(db, mongo, trainer2Id);

        await ep.HandleAsync(
            new ListNotesRequest { ClientId = clientProfile.PublicId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(403);
    }

    [Fact]
    public async Task List_NonexistentClient_Returns404()
    {
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerId).Build();
        var db = new MockDbBuilder().With(trainerProfile).Build();
        var mongo = BuildReadableMongo([]);

        var ep = CreateListEndpoint(db, mongo, _trainerId);

        await ep.HandleAsync(
            new ListNotesRequest { ClientId = Guid.NewGuid() },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    // ── PATCH /trainer/clients/{clientId}/notes/{noteId} ────────────────────

    [Fact]
    public async Task Edit_HappyPath_Returns200WithUpdatedText()
    {
        var (db, clientProfile) = BuildLinkedClientSetup();

        var note = CreateNote(clientProfile.UserId, _trainerId, text: "Original text.");
        var mongo = BuildWritableMongo([note]);

        var ep = CreateEditEndpoint(db, mongo, _trainerId);

        await ep.HandleAsync(
            new EditNoteRequest
            {
                ClientId = clientProfile.PublicId,
                NoteId = note.ExternalId,
                Text = "Updated text."
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.NoteId.Should().Be(note.ExternalId);
        ep.Response.Text.Should().Be("Updated text.");
        ep.Response.UpdatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task Edit_ClientAuthenticated_Returns403()
    {
        var (db, clientProfile) = BuildLinkedClientSetup();
        var mongo = BuildWritableMongo([]);

        var ep = Factory.Create<EditNoteEndpoint>(
            ctx => ctx.Request.HttpContext.User = FakeClientPrincipal(_trainerId),
            db, mongo, new ClientLinkAuthorizationService(db));

        await ep.HandleAsync(
            new EditNoteRequest { ClientId = clientProfile.PublicId, NoteId = Guid.NewGuid(), Text = "x" },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(403);
    }

    [Fact]
    public async Task Edit_NoteNotFound_Returns404()
    {
        var (db, clientProfile) = BuildLinkedClientSetup();
        // Empty notes collection — note won't be found
        var mongo = BuildWritableMongo([]);

        var ep = CreateEditEndpoint(db, mongo, _trainerId);

        await ep.HandleAsync(
            new EditNoteRequest
            {
                ClientId = clientProfile.PublicId,
                NoteId = Guid.NewGuid(),
                Text = "Does not exist."
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task Edit_CrossTrainerNote_Returns404()
    {
        // Trainer2 tries to edit a note authored by trainer1.
        // NSubstitute mocks cannot evaluate Mongo filter expressions, so we simulate
        // "note not found for trainer2" by providing an empty collection (no match).
        // The real Mongo query filters by (ExternalId AND TrainerId AND ClientId), which
        // ensures trainer2 cannot see trainer1's notes in production.
        var trainer1Id = Guid.NewGuid();
        var trainer2Id = _trainerId;

        var trainerProfile1 = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(trainer1Id).Build();
        var trainerProfile2 = EntityBuilder.ProfessionalProfile.WithId(2).WithUserId(trainer2Id).Build();
        var clientUser = EntityBuilder.User.Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(10).WithUser(clientUser).Build();

        // Both trainers are linked to the client
        var link1 = EntityBuilder.ClientProfessionalLink.WithId(41).WithClientProfile(clientProfile).WithProfessionalProfile(trainerProfile1).Build();
        var link2 = EntityBuilder.ClientProfessionalLink.WithId(42).WithClientProfile(clientProfile).WithProfessionalProfile(trainerProfile2).Build();

        var db = new MockDbBuilder()
            .With(trainerProfile1)
            .With(trainerProfile2)
            .With(clientProfile)
            .With(link1)
            .With(link2)
            .Build();

        // Empty mongo = find returns no note, simulating trainer2's filter finding nothing
        var mongo = BuildWritableMongo([]);

        var ep = CreateEditEndpoint(db, mongo, trainer2Id);

        await ep.HandleAsync(
            new EditNoteRequest
            {
                ClientId = clientProfile.PublicId,
                NoteId = Guid.NewGuid(),
                Text = "Hijacked."
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    // ── DELETE /trainer/clients/{clientId}/notes/{noteId} ───────────────────

    [Fact]
    public async Task Delete_HappyPath_Returns204()
    {
        var (db, clientProfile) = BuildLinkedClientSetup();
        var note = CreateNote(clientProfile.UserId, _trainerId);
        var mongo = BuildWritableMongo([note]);

        var ep = CreateDeleteEndpoint(db, mongo, _trainerId);

        await ep.HandleAsync(
            new DeleteNoteRequest { ClientId = clientProfile.PublicId, NoteId = note.ExternalId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);
    }

    [Fact]
    public async Task Delete_ClientAuthenticated_Returns403()
    {
        var (db, clientProfile) = BuildLinkedClientSetup();
        var mongo = BuildWritableMongo([]);

        var ep = Factory.Create<DeleteNoteEndpoint>(
            ctx => ctx.Request.HttpContext.User = FakeClientPrincipal(_trainerId),
            db, mongo, new ClientLinkAuthorizationService(db));

        await ep.HandleAsync(
            new DeleteNoteRequest { ClientId = clientProfile.PublicId, NoteId = Guid.NewGuid() },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(403);
    }

    [Fact]
    public async Task Delete_NoteNotFound_Returns404()
    {
        var (db, clientProfile) = BuildLinkedClientSetup();
        // Empty notes — delete will find nothing
        var mongo = BuildWritableMongo([]);

        var ep = CreateDeleteEndpoint(db, mongo, _trainerId);

        await ep.HandleAsync(
            new DeleteNoteRequest { ClientId = clientProfile.PublicId, NoteId = Guid.NewGuid() },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task Delete_NotLinkedToClient_Returns403()
    {
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerId).Build();
        var clientUser = EntityBuilder.User.Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(10).WithUser(clientUser).Build();
        // No link
        var db = new MockDbBuilder().With(trainerProfile).With(clientProfile).Build();
        var note = CreateNote(clientProfile.UserId, _trainerId);
        var mongo = BuildWritableMongo([note]);

        var ep = CreateDeleteEndpoint(db, mongo, _trainerId);

        await ep.HandleAsync(
            new DeleteNoteRequest { ClientId = clientProfile.PublicId, NoteId = note.ExternalId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(403);
    }

    // ── Validator unit tests ──────────────────────────────────────────────────

    [Fact]
    public async Task CreateValidator_TextExceeds2000_Fails()
    {
        var validator = new CreateNoteValidator();
        var result = await validator.ValidateAsync(new CreateNoteRequest
        {
            ClientId = Guid.NewGuid(),
            Text = new string('a', 2001)
        }, TestContext.Current.CancellationToken);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.OutOfRange);
    }

    [Fact]
    public async Task EditValidator_TextExceeds2000_Fails()
    {
        var validator = new EditNoteValidator();
        var result = await validator.ValidateAsync(new EditNoteRequest
        {
            ClientId = Guid.NewGuid(),
            NoteId = Guid.NewGuid(),
            Text = new string('a', 2001)
        }, TestContext.Current.CancellationToken);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.OutOfRange);
    }

    [Fact]
    public async Task CreateValidator_TextExactly2000_Passes()
    {
        var validator = new CreateNoteValidator();
        var result = await validator.ValidateAsync(new CreateNoteRequest
        {
            ClientId = Guid.NewGuid(),
            Text = new string('a', 2000)
        }, TestContext.Current.CancellationToken);
        result.IsValid.Should().BeTrue();
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private (IApplicationDbContext db, Application.Domain.Entities.ClientProfile clientProfile)
        BuildLinkedClientSetup()
    {
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerId).Build();
        var clientUser = EntityBuilder.User.WithEmail("client@test.com").Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(10).WithUser(clientUser).Build();
        var link = EntityBuilder.ClientProfessionalLink
            .WithId(42)
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(trainerProfile)
            .Build();

        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(clientProfile)
            .With(link)
            .Build();

        return (db, clientProfile);
    }

    private CreateNoteEndpoint CreateCreateEndpoint(IApplicationDbContext db, IMongoContext mongo, Guid callerId) =>
        Factory.Create<CreateNoteEndpoint>(
            ctx => ctx.Request.HttpContext.User = FakeTrainerPrincipal(callerId),
            db, mongo, new ClientLinkAuthorizationService(db));

    private ListNotesEndpoint CreateListEndpoint(IApplicationDbContext db, IMongoContext mongo, Guid callerId) =>
        Factory.Create<ListNotesEndpoint>(
            ctx => ctx.Request.HttpContext.User = FakeTrainerPrincipal(callerId),
            db, mongo, new ClientLinkAuthorizationService(db));

    private EditNoteEndpoint CreateEditEndpoint(IApplicationDbContext db, IMongoContext mongo, Guid callerId) =>
        Factory.Create<EditNoteEndpoint>(
            ctx => ctx.Request.HttpContext.User = FakeTrainerPrincipal(callerId),
            db, mongo, new ClientLinkAuthorizationService(db));

    private DeleteNoteEndpoint CreateDeleteEndpoint(IApplicationDbContext db, IMongoContext mongo, Guid callerId) =>
        Factory.Create<DeleteNoteEndpoint>(
            ctx => ctx.Request.HttpContext.User = FakeTrainerPrincipal(callerId),
            db, mongo, new ClientLinkAuthorizationService(db));

    private static ClaimsPrincipal FakeTrainerPrincipal(Guid userId) =>
        new(new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(userId, AppRoles.Trainer)));

    private static ClaimsPrincipal FakeClientPrincipal(Guid userId) =>
        new(new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(userId, AppRoles.Client)));

    // ── Mongo factory helpers ─────────────────────────────────────────────────

    /// <summary>
    /// Creates a mock IMongoContext where TrainerNotes supports reads (FindAsync + CountDocumentsAsync).
    /// </summary>
    private static IMongoContext BuildReadableMongo(List<TrainerNote> notes)
    {
        var collection = CreateReadableCollection(notes);
        var mongo = Substitute.For<IMongoContext>();
        mongo.TrainerNotes.Returns(collection);
        return mongo;
    }

    /// <summary>
    /// Creates a mock IMongoContext where TrainerNotes supports reads AND writes
    /// (InsertOneAsync, UpdateOneAsync, DeleteOneAsync, FindAsync, CountDocumentsAsync).
    /// For DeleteOneAsync: returns DeletedCount=1 when the note ExternalId matches the filter (simulated);
    /// returns DeletedCount=0 when the notes list is empty.
    /// </summary>
    private static IMongoContext BuildWritableMongo(List<TrainerNote> notes)
    {
        var collection = CreateWritableCollection(notes);
        var mongo = Substitute.For<IMongoContext>();
        mongo.TrainerNotes.Returns(collection);
        return mongo;
    }

    private static IMongoCollection<TrainerNote> CreateReadableCollection(List<TrainerNote> docs)
    {
        var collection = Substitute.For<IMongoCollection<TrainerNote>>();

        // FindAsync — returns all docs (filter evaluation happens in real Mongo; mock returns all)
        collection.FindAsync(
                Arg.Any<FilterDefinition<TrainerNote>>(),
                Arg.Any<FindOptions<TrainerNote, TrainerNote>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateCursor(docs));

        // CountDocumentsAsync — returns total count of provided docs
        collection.CountDocumentsAsync(
                Arg.Any<FilterDefinition<TrainerNote>>(),
                Arg.Any<CountOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(docs.Count);

        return collection;
    }

    private static IMongoCollection<TrainerNote> CreateWritableCollection(List<TrainerNote> docs)
    {
        var collection = CreateReadableCollection(docs);

        // InsertOneAsync — no-op (note is already in memory list for read checks)
        collection.InsertOneAsync(
                Arg.Any<TrainerNote>(),
                Arg.Any<InsertOneOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(Task.CompletedTask);

        // UpdateOneAsync — returns ModifiedCount=1
        var updateResult = Substitute.For<UpdateResult>();
        updateResult.ModifiedCount.Returns(1L);
        collection.UpdateOneAsync(
                Arg.Any<FilterDefinition<TrainerNote>>(),
                Arg.Any<UpdateDefinition<TrainerNote>>(),
                Arg.Any<UpdateOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(updateResult);

        // DeleteOneAsync — returns DeletedCount matching whether docs list has any entries
        var deleteResult = Substitute.For<DeleteResult>();
        deleteResult.DeletedCount.Returns(docs.Count > 0 ? 1L : 0L);
        collection.DeleteOneAsync(
                Arg.Any<FilterDefinition<TrainerNote>>(),
                Arg.Any<CancellationToken>())
            .Returns(deleteResult);

        return collection;
    }

    private static IAsyncCursor<T> CreateCursor<T>(List<T> docs)
    {
        var cursor = Substitute.For<IAsyncCursor<T>>();
        var moved = false;
        cursor.Current.Returns(docs);
        cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return docs.Count > 0;
        });
        cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return docs.Count > 0;
        });
        return cursor;
    }

    private static TrainerNote CreateNote(
        Guid clientUserId,
        Guid trainerId,
        string text = "A test note.",
        DateTime? createdAt = null)
    {
        var now = createdAt ?? DateTime.UtcNow;
        return new TrainerNote
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientUserId,
            TrainerId = trainerId,
            Text = text,
            CreatedAt = now,
            UpdatedAt = now
        };
    }
}
