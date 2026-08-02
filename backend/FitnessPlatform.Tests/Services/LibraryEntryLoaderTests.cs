using System.Text.Json;
using FastEndpoints;
using FastEndpoints.Testing;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Services;
using FluentAssertions;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using MongoDB.Driver;
using Testcontainers.MongoDb;

namespace FitnessPlatform.Tests.Services;

/// <summary>
/// Probe endpoint used only to obtain a real <see cref="IEndpoint"/> (with a usable
/// <c>HttpContext</c>) so <see cref="LibraryDenialExtensions"/>'s fetch-and-guard entry points
/// can be exercised the same way a real sharing-library endpoint would call them. No route on
/// this endpoint is ever invoked over HTTP; <c>HandleAsync</c> is never called by these tests.
/// </summary>
internal sealed class LibraryEntryLoaderProbeEndpoint : EndpointWithoutRequest
{
    public override void Configure()
    {
        Get("/__test/library-entry-loader-probe");
        AllowAnonymous();
    }

    public override Task HandleAsync(CancellationToken ct) => Task.CompletedTask;
}

/// <summary>
/// Testcontainers integration tests for
/// <see cref="LibraryDenialExtensions.LoadLibraryEntryForReadOrRespondAsync{TDoc}"/> and
/// <see cref="LibraryDenialExtensions.LoadLibraryEntryForWriteOrRespondAsync{TDoc}"/> (issue
/// #858 rework). Boots a real MongoDB container so the byte-identity proof below drives the
/// actual production entry point a consumer would call, rather than two hand-picked sub-calls
/// sharing hardcoded literals.
/// </summary>
public class LibraryEntryLoaderTests : IAsyncLifetime
{
    // Wide timeout to absorb contention when the compose harness is also running.
    private static readonly TimeSpan StartupTimeout = TimeSpan.FromSeconds(180);

    private static readonly LibraryDenial MealTemplateDenial = new(
        "MEAL_TEMPLATE_NOT_FOUND", "Meal template not found.",
        "MEAL_TEMPLATE_NOT_OWNED", "Meal template belongs to another owner.");

    private readonly MongoDbContainer _mongo = new MongoDbBuilder("mongo:7").Build();

    private IMongoCollection<TestLibraryDocument> _collection = null!;

    /// <summary>Stand-in sharing-library document implementing <see cref="ILibraryDocument"/>.</summary>
    private sealed class TestLibraryDocument : ILibraryDocument
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public ObjectId Id { get; set; }

        [BsonElement("externalId")]
        public Guid ExternalId { get; set; }

        [BsonElement("ownerId")]
        public Guid OwnerId { get; set; }

        [BsonElement("visibility")]
        [BsonRepresentation(BsonType.String)]
        public LibraryVisibility Visibility { get; set; }

        [BsonElement("name")]
        public string Name { get; set; } = string.Empty;

        [BsonElement("dateCreated")]
        public DateTime DateCreated { get; set; }

        [BsonElement("version")]
        public int Version { get; set; } = 1;
    }

    // ── IAsyncLifetime ───────────────────────────────────────────────────────

    public async ValueTask InitializeAsync()
    {
        using var cts = new CancellationTokenSource(StartupTimeout);
        await _mongo.StartAsync(cts.Token);

        var mongoClient = new MongoClient(_mongo.GetConnectionString());
        var mongoDb = mongoClient.GetDatabase("fitness_libraryentryloader_test");
        _collection = mongoDb.GetCollection<TestLibraryDocument>("testLibraryEntries");
    }

    public async ValueTask DisposeAsync()
    {
        await _mongo.DisposeAsync();
    }

    /// <summary>
    /// Reads the RFC 7807 <c>errorCode</c> extension out of a captured Problem Details response
    /// body — see <c>LibraryAccessGuardTests.ReadErrorCodeAsync</c> for why status/byte-identity
    /// alone is insufficient to pin the exact error code a response carries.
    /// </summary>
    private static async Task<string?> ReadErrorCodeAsync(MemoryStream responseBody)
    {
        responseBody.Seek(0, SeekOrigin.Begin);
        using var document = await JsonDocument.ParseAsync(responseBody);
        return document.RootElement.TryGetProperty("errorCode", out var errorCode)
            ? errorCode.GetString()
            : null;
    }

    // ── tests ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task LoadLibraryEntryForReadOrRespondAsync_OwnerReadingOwnEntry_ReturnsDocument()
    {
        var ct = TestContext.Current.CancellationToken;
        var ownerId = Guid.NewGuid();

        var entry = new TestLibraryDocument
        {
            ExternalId = Guid.NewGuid(),
            OwnerId = ownerId,
            Visibility = LibraryVisibility.Private,
            Name = "Owner's entry",
            DateCreated = DateTime.UtcNow
        };
        await _collection.InsertOneAsync(entry, cancellationToken: ct);

        var ep = Factory.Create<LibraryEntryLoaderProbeEndpoint>();

        var result = await ep.LoadLibraryEntryForReadOrRespondAsync(
            _collection, entry.ExternalId, ownerId, MealTemplateDenial, ct);

        result.Should().NotBeNull();
        result!.ExternalId.Should().Be(entry.ExternalId);
        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }

    /// <summary>
    /// The core AC #858 property, re-proven against the actual consumer-facing entry point
    /// rather than two hand-picked sub-calls. The tautological version of this test (formerly
    /// in <c>LibraryAccessGuardTests</c>) passed the identical string literals to
    /// <c>SendLibraryNotFoundAsync</c> and <c>TryDenyReadAsync</c> directly — byte-identity held
    /// by construction, since both legs were driven by the test itself, and it would still have
    /// passed if a real endpoint used the repo's usual empty-bodied <c>Send.NotFoundAsync(ct)</c>
    /// for its own missing-document branch. This test instead drives
    /// <see cref="LibraryDenialExtensions.LoadLibraryEntryForReadOrRespondAsync{TDoc}"/> — the
    /// single production entry point a real endpoint calls for both outcomes — once with an
    /// <c>ExternalId</c> matching nothing (genuinely missing) and once with an <c>ExternalId</c>
    /// matching another owner's Private entry (denied read). Because there is exactly one call
    /// site for both outcomes, there is no second, independently-written branch left for a
    /// divergent detail string to leak into.
    /// </summary>
    [Fact]
    public async Task LoadLibraryEntryForReadOrRespondAsync_MissingAndDeniedPrivateEntry_ProduceByteIdenticalResponses()
    {
        var ct = TestContext.Current.CancellationToken;
        var ownerId = Guid.NewGuid();
        var otherCallerId = Guid.NewGuid();

        var privateEntry = new TestLibraryDocument
        {
            ExternalId = Guid.NewGuid(),
            OwnerId = ownerId,
            Visibility = LibraryVisibility.Private,
            Name = "Owner's private entry",
            DateCreated = DateTime.UtcNow
        };
        await _collection.InsertOneAsync(privateEntry, cancellationToken: ct);

        using var missingBody = new MemoryStream();
        var missingEndpoint = Factory.Create<LibraryEntryLoaderProbeEndpoint>(
            ctx => ctx.Request.HttpContext.Response.Body = missingBody);
        var missingResult = await missingEndpoint.LoadLibraryEntryForReadOrRespondAsync(
            _collection, Guid.NewGuid(), otherCallerId, MealTemplateDenial, ct);

        using var deniedBody = new MemoryStream();
        var deniedEndpoint = Factory.Create<LibraryEntryLoaderProbeEndpoint>(
            ctx => ctx.Request.HttpContext.Response.Body = deniedBody);
        var deniedResult = await deniedEndpoint.LoadLibraryEntryForReadOrRespondAsync(
            _collection, privateEntry.ExternalId, otherCallerId, MealTemplateDenial, ct);

        missingResult.Should().BeNull();
        deniedResult.Should().BeNull();

        missingEndpoint.HttpContext.Response.StatusCode
            .Should().Be(deniedEndpoint.HttpContext.Response.StatusCode);
        missingEndpoint.HttpContext.Response.ContentType
            .Should().Be(deniedEndpoint.HttpContext.Response.ContentType);

        missingBody.Seek(0, SeekOrigin.Begin);
        deniedBody.Seek(0, SeekOrigin.Begin);
        missingBody.ToArray().Should().Equal(deniedBody.ToArray());

        // Byte-identity alone would still pass if both legs degraded to the same WRONG value
        // (e.g. an empty string, or the code dropped entirely) — pin the actual value too.
        missingBody.Seek(0, SeekOrigin.Begin);
        (await ReadErrorCodeAsync(missingBody)).Should().Be(MealTemplateDenial.NotFoundErrorCode);
    }

    [Fact]
    public async Task LoadLibraryEntryForWriteOrRespondAsync_OtherOwnerPublicEntry_Returns403AndNull()
    {
        var ct = TestContext.Current.CancellationToken;
        var ownerId = Guid.NewGuid();
        var otherCallerId = Guid.NewGuid();

        var entry = new TestLibraryDocument
        {
            ExternalId = Guid.NewGuid(),
            OwnerId = ownerId,
            Visibility = LibraryVisibility.Public,
            Name = "Owner's public entry",
            DateCreated = DateTime.UtcNow
        };
        await _collection.InsertOneAsync(entry, cancellationToken: ct);

        using var responseBody = new MemoryStream();
        var ep = Factory.Create<LibraryEntryLoaderProbeEndpoint>(
            ctx => ctx.Request.HttpContext.Response.Body = responseBody);

        var result = await ep.LoadLibraryEntryForWriteOrRespondAsync(
            _collection, entry.ExternalId, otherCallerId, MealTemplateDenial, ct);

        result.Should().BeNull();
        ep.HttpContext.Response.StatusCode.Should().Be(403);
        (await ReadErrorCodeAsync(responseBody)).Should().Be(MealTemplateDenial.NotOwnedErrorCode);
    }

    // ── LibraryDenialExtensions.LoadAndReplaceLibraryEntryWithVersionGuardAsync (MAJOR 2) ──────

    private const string VersionConflictErrorCode = "MEAL_TEMPLATE_VERSION_CONFLICT";
    private const string VersionConflictDetail = "Meal template was modified by another request.";

    [Fact]
    public async Task LoadAndReplaceLibraryEntryWithVersionGuardAsync_Owner_MutatesAndReplaces()
    {
        var ct = TestContext.Current.CancellationToken;
        var ownerId = Guid.NewGuid();

        var entry = new TestLibraryDocument
        {
            ExternalId = Guid.NewGuid(),
            OwnerId = ownerId,
            Visibility = LibraryVisibility.Private,
            Name = "Before",
            DateCreated = DateTime.UtcNow,
            Version = 1
        };
        await _collection.InsertOneAsync(entry, cancellationToken: ct);

        var ep = Factory.Create<LibraryEntryLoaderProbeEndpoint>();
        var guard = new PlanConcurrencyGuard();

        var result = await ep.LoadAndReplaceLibraryEntryWithVersionGuardAsync(
            _collection, entry.ExternalId, ownerId, MealTemplateDenial,
            expectedVersion: 1,
            VersionConflictErrorCode, VersionConflictDetail,
            guard,
            mutate: (doc, _) =>
            {
                doc.Name = "After";
                doc.Version += 1;
                return Task.FromResult(true);
            },
            ct);

        result.Should().NotBeNull();
        result!.Name.Should().Be("After");
        result.Version.Should().Be(2);
        ep.HttpContext.Response.StatusCode.Should().Be(200);

        var persisted = await (await _collection.FindAsync(
            Builders<TestLibraryDocument>.Filter.Eq(d => d.ExternalId, entry.ExternalId),
            cancellationToken: ct)).FirstOrDefaultAsync(ct);
        persisted.Name.Should().Be("After");
        persisted.Version.Should().Be(2);
    }

    [Fact]
    public async Task LoadAndReplaceLibraryEntryWithVersionGuardAsync_MissingEntry_Returns404()
    {
        var ct = TestContext.Current.CancellationToken;

        using var responseBody = new MemoryStream();
        var ep = Factory.Create<LibraryEntryLoaderProbeEndpoint>(
            ctx => ctx.Request.HttpContext.Response.Body = responseBody);
        var guard = new PlanConcurrencyGuard();

        var result = await ep.LoadAndReplaceLibraryEntryWithVersionGuardAsync(
            _collection, Guid.NewGuid(), Guid.NewGuid(), MealTemplateDenial,
            expectedVersion: 1,
            VersionConflictErrorCode, VersionConflictDetail,
            guard,
            mutate: (_, _) => Task.FromResult(true),
            ct);

        result.Should().BeNull();
        ep.HttpContext.Response.StatusCode.Should().Be(404);
        (await ReadErrorCodeAsync(responseBody)).Should().Be(MealTemplateDenial.NotFoundErrorCode);
    }

    [Fact]
    public async Task LoadAndReplaceLibraryEntryWithVersionGuardAsync_OtherOwnerPublicEntry_Returns403NotOwned()
    {
        var ct = TestContext.Current.CancellationToken;
        var ownerId = Guid.NewGuid();
        var otherCallerId = Guid.NewGuid();

        var entry = new TestLibraryDocument
        {
            ExternalId = Guid.NewGuid(),
            OwnerId = ownerId,
            Visibility = LibraryVisibility.Public,
            Name = "Owner's public entry",
            DateCreated = DateTime.UtcNow,
            Version = 1
        };
        await _collection.InsertOneAsync(entry, cancellationToken: ct);

        using var responseBody = new MemoryStream();
        var ep = Factory.Create<LibraryEntryLoaderProbeEndpoint>(
            ctx => ctx.Request.HttpContext.Response.Body = responseBody);
        var guard = new PlanConcurrencyGuard();

        var result = await ep.LoadAndReplaceLibraryEntryWithVersionGuardAsync(
            _collection, entry.ExternalId, otherCallerId, MealTemplateDenial,
            expectedVersion: 1,
            VersionConflictErrorCode, VersionConflictDetail,
            guard,
            mutate: (_, _) => Task.FromResult(true),
            ct);

        result.Should().BeNull();
        ep.HttpContext.Response.StatusCode.Should().Be(403);
        (await ReadErrorCodeAsync(responseBody)).Should().Be(MealTemplateDenial.NotOwnedErrorCode);
    }

    [Fact]
    public async Task LoadAndReplaceLibraryEntryWithVersionGuardAsync_Owner_StaleVersion_Returns409()
    {
        var ct = TestContext.Current.CancellationToken;
        var ownerId = Guid.NewGuid();

        var entry = new TestLibraryDocument
        {
            ExternalId = Guid.NewGuid(),
            OwnerId = ownerId,
            Visibility = LibraryVisibility.Private,
            Name = "Current",
            DateCreated = DateTime.UtcNow,
            Version = 1
        };
        await _collection.InsertOneAsync(entry, cancellationToken: ct);

        using var responseBody = new MemoryStream();
        var ep = Factory.Create<LibraryEntryLoaderProbeEndpoint>(
            ctx => ctx.Request.HttpContext.Response.Body = responseBody);
        var guard = new PlanConcurrencyGuard();

        var result = await ep.LoadAndReplaceLibraryEntryWithVersionGuardAsync(
            _collection, entry.ExternalId, ownerId, MealTemplateDenial,
            expectedVersion: 999, // stale — the document is actually at Version 1
            VersionConflictErrorCode, VersionConflictDetail,
            guard,
            mutate: (_, _) => Task.FromResult(true),
            ct);

        result.Should().BeNull();
        ep.HttpContext.Response.StatusCode.Should().Be(409);
        (await ReadErrorCodeAsync(responseBody)).Should().Be(VersionConflictErrorCode);
    }

    /// <summary>
    /// The exact ordering hazard MAJOR 2 exists to close: a non-owner probing another owner's
    /// Private entry, supplying a wrong <c>expectedVersion</c>, must still get the 404 the
    /// denial guard produces — never the 409 a version-check-first composition would produce.
    /// A 409 here would disclose the entry's existence (and that a version mismatch specifically
    /// is the reason for the conflict) to a caller who has no read right to the entry at all.
    /// </summary>
    [Fact]
    public async Task LoadAndReplaceLibraryEntryWithVersionGuardAsync_OtherOwnerPrivateEntry_WrongVersion_Returns404NotVersionConflict()
    {
        var ct = TestContext.Current.CancellationToken;
        var ownerId = Guid.NewGuid();
        var otherCallerId = Guid.NewGuid();

        var entry = new TestLibraryDocument
        {
            ExternalId = Guid.NewGuid(),
            OwnerId = ownerId,
            Visibility = LibraryVisibility.Private,
            Name = "Owner's private entry",
            DateCreated = DateTime.UtcNow,
            Version = 1
        };
        await _collection.InsertOneAsync(entry, cancellationToken: ct);

        using var responseBody = new MemoryStream();
        var ep = Factory.Create<LibraryEntryLoaderProbeEndpoint>(
            ctx => ctx.Request.HttpContext.Response.Body = responseBody);
        var guard = new PlanConcurrencyGuard();

        var result = await ep.LoadAndReplaceLibraryEntryWithVersionGuardAsync(
            _collection, entry.ExternalId, otherCallerId, MealTemplateDenial,
            expectedVersion: 999, // deliberately wrong — would trip VersionConflict if version-checked first
            VersionConflictErrorCode, VersionConflictDetail,
            guard,
            mutate: (_, _) => Task.FromResult(true),
            ct);

        result.Should().BeNull();
        ep.HttpContext.Response.StatusCode.Should().Be(404);
        (await ReadErrorCodeAsync(responseBody)).Should().Be(MealTemplateDenial.NotFoundErrorCode);
    }
}
