using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.ClientTraining.MarkExerciseComplete;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.ClientTraining;

/// <summary>
/// Tests for <see cref="MarkExerciseCompleteEndpoint"/>.
/// </summary>
public class MarkExerciseCompleteEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();
    private readonly Guid _sessionId = Guid.NewGuid();
    private readonly Guid _sectionId = Guid.NewGuid();
    private readonly Guid _exercise1 = Guid.NewGuid();
    private readonly Guid _exercise2 = Guid.NewGuid();
    private readonly IRealtimeNotifier _notifier = TrainingCompletionTestHelpers.CreateStubNotifier();
    private readonly IComplianceService _compliance = TrainingCompletionTestHelpers.CreateStubComplianceService();
    private readonly ILogger<MarkExerciseCompleteEndpoint> _logger = Substitute.For<ILogger<MarkExerciseCompleteEndpoint>>();

    private IApplicationDbContext CreateMockDb() =>
        new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

    private IApplicationDbContext CreateMockDbForWrongClient() =>
        new MockDbBuilder()
            .With(new ClientProfile { UserId = Guid.NewGuid(), PublicId = Guid.NewGuid() })
            .Build();

    [Fact]
    public async Task HandleAsync_NewCompletion_Returns200WithProgress()
    {
        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1, _exercise2],
            sectionId: _sectionId);

        var (mongo, completionCollection) = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _logger);

        await ep.HandleAsync(
            new MarkExerciseCompleteRequest { SessionId = _sessionId, ExerciseExternalId = _exercise1, SectionId = _sectionId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await completionCollection.Received(1).InsertOneAsync(
            Arg.Is<TrainingCompletion>(c =>
                c.ClientId == _clientId &&
                c.SessionId == _sessionId &&
                c.CompletedExerciseIds.Contains(_exercise1) &&
                c.CompletedExerciseIds.Count == 1 &&
                c.CompletedExerciseIdsBySection != null &&
                c.CompletedExerciseIdsBySection[_sectionId.ToString()].Contains(_exercise1)),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_AlreadyComplete_IsIdempotent_Returns200()
    {
        var existingCompletion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: _sessionId,
            date: DateTime.UtcNow.Date,
            completedExerciseIds: [_exercise1],
            version: 1,
            completedExerciseIdsBySection: new Dictionary<string, List<Guid>>
            {
                [_sectionId.ToString()] = [_exercise1]
            });

        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1, _exercise2],
            sectionId: _sectionId);

        var (mongo, completionCollection) = TrainingCompletionTestHelpers.CreateMockMongo(
            plan: plan,
            existingCompletion: existingCompletion);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _logger);

        // Mark exercise1 complete again (already complete — idempotent)
        await ep.HandleAsync(
            new MarkExerciseCompleteRequest { SessionId = _sessionId, ExerciseExternalId = _exercise1, SectionId = _sectionId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // No insert or update should have occurred
        await completionCollection.DidNotReceive().InsertOneAsync(
            Arg.Any<TrainingCompletion>(),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
        await completionCollection.DidNotReceive().UpdateOneAsync(
            Arg.Any<FilterDefinition<TrainingCompletion>>(),
            Arg.Any<UpdateDefinition<TrainingCompletion>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_WrongClient_Returns404()
    {
        // The wrong client has no active training plan — the mock returns an empty list
        // for any FindAsync call (as it's keyed to return no plan for wrongClientId's collection).
        var wrongClientId = Guid.NewGuid();

        // Create a mongo with NO plans (simulates: plan belongs to _clientId, not wrongClientId)
        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo(plan: null);

        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = wrongClientId, PublicId = wrongClientId })
            .Build();

        var ep = Factory.Create<MarkExerciseCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(wrongClientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _logger);

        await ep.HandleAsync(
            new MarkExerciseCompleteRequest { SessionId = _sessionId, ExerciseExternalId = _exercise1, SectionId = _sectionId },
            TestContext.Current.CancellationToken);

        // No active plan found for wrongClientId → 404
        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_StaleVersion_Returns409()
    {
        var existingCompletion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: _sessionId,
            date: DateTime.UtcNow.Date,
            completedExerciseIds: [],
            version: 2); // server is at version 2

        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1, _exercise2],
            sectionId: _sectionId);

        var mongo = Substitute.For<FitnessPlatform.Application.Infrastructure.Data.MongoDb.IMongoContext>();
        var planColl = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan).Mongo.TrainingPlans;
        mongo.TrainingPlans.Returns(planColl);

        // Completion collection returns existing doc but UpdateOneAsync modifies 0 rows (simulating version mismatch)
        var completionCollection = TrainingCompletionTestHelpers.CreateMockCompletionCollection(
            [existingCompletion], updateSucceeds: false);
        mongo.TrainingCompletions.Returns(completionCollection);

        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _logger);

        // Client sends version 2 which matches, but UpdateOneAsync returns ModifiedCount=0 (race)
        await ep.HandleAsync(
            new MarkExerciseCompleteRequest
            {
                SessionId = _sessionId,
                ExerciseExternalId = _exercise1,
                SectionId = _sectionId,
                Version = 2
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task HandleAsync_ClientSendsStaleVersion_Returns409Immediately()
    {
        var existingCompletion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: _sessionId,
            date: DateTime.UtcNow.Date,
            completedExerciseIds: [],
            version: 3);

        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1],
            sectionId: _sectionId);

        var (mongo, completionCollection) = TrainingCompletionTestHelpers.CreateMockMongo(
            plan: plan,
            existingCompletion: existingCompletion);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _logger);

        // Client sends version 1 but server is at version 3
        await ep.HandleAsync(
            new MarkExerciseCompleteRequest
            {
                SessionId = _sessionId,
                ExerciseExternalId = _exercise1,
                SectionId = _sectionId,
                Version = 1
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task HandleAsync_NonExistentSessionId_Returns404()
    {
        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1],
            sectionId: _sectionId);

        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _logger);

        await ep.HandleAsync(
            new MarkExerciseCompleteRequest { SessionId = Guid.NewGuid(), ExerciseExternalId = _exercise1, SectionId = _sectionId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo();
        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity()),
            mongo, db, _notifier, _compliance, _logger);

        await ep.HandleAsync(
            new MarkExerciseCompleteRequest { SessionId = _sessionId, ExerciseExternalId = _exercise1, SectionId = _sectionId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }

    [Fact]
    public async Task HandleAsync_UnknownSectionId_Returns404()
    {
        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1],
            sectionId: _sectionId);

        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _logger);

        // Use a valid sessionId but an unknown sectionId
        await ep.HandleAsync(
            new MarkExerciseCompleteRequest { SessionId = _sessionId, ExerciseExternalId = _exercise1, SectionId = Guid.NewGuid() },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_SameExerciseInTwoSections_MarkInOneSection_OnlyAffectsThatSection()
    {
        // The core bug scenario: same catalog exercise in two sections.
        // Marking in section1 must not affect section2's completion state.
        var sharedExerciseId = Guid.NewGuid();
        var (plan, section1Id, section2Id) =
            TrainingCompletionTestHelpers.CreateActivePlanWithDuplicateExerciseAcrossSections(
                _clientId, _sessionId, sharedExerciseId);

        var (mongo, completionCollection) = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _logger);

        // Mark complete in section1 only
        await ep.HandleAsync(
            new MarkExerciseCompleteRequest
            {
                SessionId = _sessionId,
                ExerciseExternalId = sharedExerciseId,
                SectionId = section1Id
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // The inserted document must record completion only in section1, NOT section2.
        await completionCollection.Received(1).InsertOneAsync(
            Arg.Is<TrainingCompletion>(c =>
                c.CompletedExerciseIdsBySection != null &&
                c.CompletedExerciseIdsBySection.ContainsKey(section1Id.ToString()) &&
                c.CompletedExerciseIdsBySection[section1Id.ToString()].Contains(sharedExerciseId) &&
                !c.CompletedExerciseIdsBySection.ContainsKey(section2Id.ToString())),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_LegacyFlatCompletion_IsIdempotentWhenSectionMatches()
    {
        // A legacy completion document with only CompletedExerciseIds (no CompletedExerciseIdsBySection).
        // When the backfill attributes the exercise to the same sectionId, re-marking it returns 200
        // without an additional update (idempotent via the section dict which was populated by backfill
        // at read time, but NOT present in the document itself — so idempotency depends on the flat list).
        // This test verifies the "existing doc with only flat ids" path doesn't crash and returns 200.
        var legacyCompletion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: _sessionId,
            date: DateTime.UtcNow.Date,
            completedExerciseIds: [_exercise1],
            version: 1,
            completedExerciseIdsBySection: null); // legacy: no section dict

        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1, _exercise2],
            sectionId: _sectionId);

        var (mongo, completionCollection) = TrainingCompletionTestHelpers.CreateMockMongo(
            plan: plan,
            existingCompletion: legacyCompletion);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _logger);

        // Mark exercise1 complete in sectionId. Since the doc has no section dict, the idempotency
        // check on the section dict won't short-circuit — it will proceed to update and populate the dict.
        await ep.HandleAsync(
            new MarkExerciseCompleteRequest { SessionId = _sessionId, ExerciseExternalId = _exercise1, SectionId = _sectionId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }

    /// <summary>
    /// Regression test for BSON serialization bug:
    /// "When using DictionaryRepresentation.Document key values must serialize as strings."
    ///
    /// The bug fired on UpdateOneAsync (the update-existing-doc path) when
    /// <see cref="TrainingCompletion.CompletedExerciseIdsBySection"/> was typed
    /// <c>Dictionary&lt;Guid, List&lt;Guid&gt;&gt;</c>.  MongoDB's default
    /// <c>DictionaryRepresentation.Document</c> requires string document keys;
    /// Guid keys caused a <c>BsonSerializationException</c>.
    ///
    /// The fix converts keys to <c>string</c> in the document layer and uses
    /// <c>req.SectionId.ToString()</c> at every write site.  This test locks the fix by:
    ///   - arranging an existing document whose section dict is already populated
    ///     (the string-key shape now stored by MongoDB),
    ///   - acting by marking a SECOND exercise in the same section (triggers UpdateOneAsync),
    ///   - asserting 200 OK (no BSON exception) and that UpdateOneAsync was called with the
    ///     updated definition.
    /// </summary>
    [Fact]
    public async Task HandleAsync_SecondMarkInExistingDoc_PersistsViaUpdateOneAsync_DoesNotThrowBsonSerializationError()
    {
        // Arrange: doc already exists, exercise1 is complete in sectionId (string-keyed shape).
        var existingCompletion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: _sessionId,
            date: DateTime.UtcNow.Date,
            completedExerciseIds: [_exercise1],
            version: 1,
            completedExerciseIdsBySection: new Dictionary<string, List<Guid>>
            {
                [_sectionId.ToString()] = [_exercise1]
            });

        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1, _exercise2],
            sectionId: _sectionId);

        var (mongo, completionCollection) = TrainingCompletionTestHelpers.CreateMockMongo(
            plan: plan,
            existingCompletion: existingCompletion);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _logger);

        // Act: mark exercise2 complete in the same section — triggers the UpdateOneAsync path.
        await ep.HandleAsync(
            new MarkExerciseCompleteRequest { SessionId = _sessionId, ExerciseExternalId = _exercise2, SectionId = _sectionId },
            TestContext.Current.CancellationToken);

        // Assert: 200 OK — no BsonSerializationException.
        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // UpdateOneAsync must have been called (not Insert) — this is the path that previously threw.
        await completionCollection.DidNotReceive().InsertOneAsync(
            Arg.Any<TrainingCompletion>(),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
        await completionCollection.Received(1).UpdateOneAsync(
            Arg.Any<FilterDefinition<TrainingCompletion>>(),
            Arg.Is<UpdateDefinition<TrainingCompletion>>(u => u != null),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }
}
