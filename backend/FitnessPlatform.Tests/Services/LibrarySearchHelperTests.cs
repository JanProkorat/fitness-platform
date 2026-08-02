using FastEndpoints;
using FastEndpoints.Testing;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FluentAssertions;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using MongoDB.Driver;
using Testcontainers.MongoDb;

namespace FitnessPlatform.Tests.Services;

/// <summary>
/// Probe endpoint used only to obtain a real <see cref="IEndpoint"/> (with a usable
/// <c>HttpContext</c>) so <see cref="LibrarySearchHelper.SearchAsync{TDoc}"/> — which sets a
/// response header and can throw a 400 via <c>ThrowErrorWithCode</c> — can be exercised the
/// same way a real sharing-library search endpoint would call it. No route on this endpoint
/// is ever invoked over HTTP; <c>HandleAsync</c> is never called by these tests.
/// </summary>
internal sealed class LibrarySearchProbeEndpoint : EndpointWithoutRequest
{
    public override void Configure()
    {
        Get("/__test/library-search-probe");
        AllowAnonymous();
    }

    public override Task HandleAsync(CancellationToken ct) => Task.CompletedTask;
}

/// <summary>
/// Testcontainers integration tests for <see cref="LibrarySearchHelper"/> (issue #858). Boots
/// a real MongoDB container because the generic
/// <c>Builders&lt;TDoc&gt;.Filter.Eq(d => d.OwnerId, ...)</c> / <c>Sort</c> expressions built
/// inside the helper against <see cref="ILibraryDocument"/> interface members are a known
/// Mongo-driver-translation risk — member access binds to the interface's <c>PropertyInfo</c>,
/// not the concrete document's — that can only be proven (or falsified) against a real
/// collection, never a mock. The same fixture also proves the DateCreated-desc/ExternalId-asc
/// paging order is deterministic when several documents share one DateCreated value.
/// </summary>
public class LibrarySearchHelperTests : IAsyncLifetime
{
    // Wide timeout to absorb contention when the compose harness is also running.
    private static readonly TimeSpan StartupTimeout = TimeSpan.FromSeconds(180);

    private readonly MongoDbContainer _mongo = new MongoDbBuilder("mongo:7").Build();

    private IMongoCollection<TestLibraryDocument> _collection = null!;

    /// <summary>
    /// Stand-in sharing-library document implementing <see cref="ILibraryDocument"/>, plus one
    /// library-specific field (<see cref="Calories"/>) to exercise the <c>extraFilter</c>
    /// parameter the way a real child (e.g. MealTemplate) would.
    /// </summary>
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

        [BsonElement("calories")]
        public int Calories { get; set; }

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
        var mongoDb = mongoClient.GetDatabase("fitness_librarysearch_test");
        _collection = mongoDb.GetCollection<TestLibraryDocument>("testLibraryEntries");
    }

    public async ValueTask DisposeAsync()
    {
        await _mongo.DisposeAsync();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private static TestLibraryDocument MakeEntry(
        Guid ownerId,
        string name,
        LibraryVisibility visibility = LibraryVisibility.Private,
        DateTime? dateCreated = null,
        int calories = 0) =>
        new()
        {
            ExternalId = Guid.NewGuid(),
            OwnerId = ownerId,
            Name = name,
            Visibility = visibility,
            DateCreated = dateCreated ?? DateTime.UtcNow,
            Calories = calories,
            Version = 1
        };

    // ── tests ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task SearchAsync_OwnAndPublicEntries_AreReturned_OthersPrivateExcluded()
    {
        var ct = TestContext.Current.CancellationToken;
        var callerId = Guid.NewGuid();
        var otherId = Guid.NewGuid();

        var own = MakeEntry(callerId, "Own Private");
        var othersPublic = MakeEntry(otherId, "Others Public", LibraryVisibility.Public);
        var othersPrivate = MakeEntry(otherId, "Others Private");

        await _collection.InsertManyAsync([own, othersPublic, othersPrivate], cancellationToken: ct);

        var ep = Factory.Create<LibrarySearchProbeEndpoint>();

        var (items, totalCount) = await ep.SearchAsync(
            _collection, callerId, d => d.Name, search: null,
            page: 1, pageSize: 20, extraFilter: null, ct: ct);

        totalCount.Should().Be(2);
        items.Select(i => i.Name).Should().BeEquivalentTo(["Own Private", "Others Public"]);
        ep.HttpContext.Response.Headers["X-Total-Count"].ToString().Should().Be("2");
    }

    [Fact]
    public async Task SearchAsync_SearchTermWithRegexMetacharacters_MatchesOnlyLiteralText()
    {
        var ct = TestContext.Current.CancellationToken;
        var callerId = Guid.NewGuid();

        var literalMatch = MakeEntry(callerId, "a.b*");
        var noMatch = MakeEntry(callerId, "aXbYYY");

        await _collection.InsertManyAsync([literalMatch, noMatch], cancellationToken: ct);

        var ep = Factory.Create<LibrarySearchProbeEndpoint>();

        var (items, totalCount) = await ep.SearchAsync(
            _collection, callerId, d => d.Name, search: "a.b*",
            page: 1, pageSize: 20, extraFilter: null, ct: ct);

        totalCount.Should().Be(1);
        items.Should().ContainSingle(i => i.Name == "a.b*");
    }

    [Fact]
    public async Task SearchAsync_ExtraFilter_IsAndedWithVisibilityFilter()
    {
        var ct = TestContext.Current.CancellationToken;
        var callerId = Guid.NewGuid();

        var lowCal = MakeEntry(callerId, "Low", calories: 100);
        var highCal = MakeEntry(callerId, "High", calories: 900);

        await _collection.InsertManyAsync([lowCal, highCal], cancellationToken: ct);

        var ep = Factory.Create<LibrarySearchProbeEndpoint>();

        var extraFilter = Builders<TestLibraryDocument>.Filter.Lte(d => d.Calories, 500);

        var (items, totalCount) = await ep.SearchAsync(
            _collection, callerId, d => d.Name, search: null,
            page: 1, pageSize: 20, extraFilter: extraFilter, ct: ct);

        totalCount.Should().Be(1);
        items.Should().ContainSingle(i => i.Name == "Low");
    }

    /// <summary>
    /// Proves the generic <c>Builders&lt;TDoc&gt;.Filter.Eq(d => d.OwnerId, ...)</c> filter
    /// built against the <see cref="ILibraryDocument"/> interface — not the concrete
    /// <see cref="TestLibraryDocument"/> type — translates and executes against a real Mongo
    /// collection, and that the DateCreated-desc/ExternalId-asc ordering is deterministic
    /// under paging even when every document shares one DateCreated value.
    /// </summary>
    [Fact]
    public async Task SearchAsync_OrderingIsDeterministic_AcrossPagesWithSharedDateCreated()
    {
        var ct = TestContext.Current.CancellationToken;
        var callerId = Guid.NewGuid();
        var sharedDate = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        var entries = Enumerable.Range(0, 5)
            .Select(i => MakeEntry(callerId, $"Entry {i}", dateCreated: sharedDate))
            .OrderBy(e => e.ExternalId)
            .ToList();

        await _collection.InsertManyAsync(entries, cancellationToken: ct);

        var ep = Factory.Create<LibrarySearchProbeEndpoint>();

        var seen = new List<Guid>();
        for (var page = 1; page <= 3; page++)
        {
            var (items, totalCount) = await ep.SearchAsync(
                _collection, callerId, d => d.Name, search: null,
                page: page, pageSize: 2, extraFilter: null, ct: ct);

            totalCount.Should().Be(5);
            seen.AddRange(items.Select(i => i.ExternalId));
        }

        seen.Should().HaveCount(5);
        seen.Should().OnlyHaveUniqueItems();
        seen.Should().BeEquivalentTo(
            entries.Select(e => e.ExternalId),
            options => options.WithStrictOrdering());
    }

    [Theory]
    [InlineData(0, 20)]
    [InlineData(-1, 20)]
    public async Task SearchAsync_PageBelowOne_ThrowsAndSets400(int page, int pageSize)
    {
        var ct = TestContext.Current.CancellationToken;
        var ep = Factory.Create<LibrarySearchProbeEndpoint>();

        var act = async () => await ep.SearchAsync(
            _collection, Guid.NewGuid(), d => d.Name, search: null,
            page: page, pageSize: pageSize, extraFilter: null, ct: ct);

        await act.Should().ThrowAsync<ValidationFailureException>();
        ep.HttpContext.Response.StatusCode.Should().Be(400);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(101)]
    public async Task SearchAsync_PageSizeOutOfRange_ThrowsAndSets400(int pageSize)
    {
        var ct = TestContext.Current.CancellationToken;
        var ep = Factory.Create<LibrarySearchProbeEndpoint>();

        var act = async () => await ep.SearchAsync(
            _collection, Guid.NewGuid(), d => d.Name, search: null,
            page: 1, pageSize: pageSize, extraFilter: null, ct: ct);

        await act.Should().ThrowAsync<ValidationFailureException>();
        ep.HttpContext.Response.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task SearchAsync_SearchTermOverMaxLength_ThrowsAndSets400()
    {
        var ct = TestContext.Current.CancellationToken;
        var ep = Factory.Create<LibrarySearchProbeEndpoint>();
        var overLong = new string('a', LibrarySearchHelper.MaxSearchTermLength + 1);

        var act = async () => await ep.SearchAsync(
            _collection, Guid.NewGuid(), d => d.Name, search: overLong,
            page: 1, pageSize: 20, extraFilter: null, ct: ct);

        await act.Should().ThrowAsync<ValidationFailureException>();
        ep.HttpContext.Response.StatusCode.Should().Be(400);
    }
}
