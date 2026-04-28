using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.PhotoDiaryRequests;
using FitnessPlatform.Application.Features.PhotoDiaryRequests.CreateRequest;
using FitnessPlatform.Application.Features.PhotoDiaryRequests.DismissRequest;
using FitnessPlatform.Application.Features.PhotoDiaryRequests.SubmitRequest;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.NutritionPlans;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;
using NSubstitute;
using ApplicationPhotoRequest = FitnessPlatform.Application.Domain.Entities.PhotoDiaryRequest;

namespace FitnessPlatform.Tests.Endpoints.PhotoDiaryRequests;

/// <summary>
/// Verifies SignalR broadcast behaviour for the four diary lifecycle events:
/// <list type="bullet">
///   <item><c>photoDiaryRequested</c>   — emitted to the <b>client</b> after CreateRequest.</item>
///   <item><c>photoDiaryDismissed</c>   — emitted to the <b>professional</b> after DismissRequest.</item>
///   <item><c>photoDiaryPhotoUploaded</c> — emitted to the <b>professional</b> after FinalizePlanPhoto
///     when a DiaryRequestId is set (covered in PhotoDiaryPhotoUploadedSignalRTests).</item>
///   <item><c>photoDiarySubmitted</c>   — emitted to the <b>professional</b> after SubmitRequest.</item>
/// </list>
/// Uses mock-based unit tests (Factory.Create + NSubstitute) so tests run without Docker.
/// </summary>
public class DiaryLifecycleSignalRTests
{
    // ── Shared identities ────────────────────────────────────────────────────────

    private readonly Guid _professionalId = Guid.NewGuid();
    private readonly Guid _clientId = Guid.NewGuid();

    // ── Notifier ─────────────────────────────────────────────────────────────────

    private readonly IRealtimeNotifier _notifier = Substitute.For<IRealtimeNotifier>();

    // ── Loggers ──────────────────────────────────────────────────────────────────

    private readonly ILogger<CreateRequestEndpoint> _createLogger =
        Substitute.For<ILogger<CreateRequestEndpoint>>();
    private readonly ILogger<DismissRequestEndpoint> _dismissLogger =
        Substitute.For<ILogger<DismissRequestEndpoint>>();
    private readonly ILogger<SubmitRequestEndpoint> _submitLogger =
        Substitute.For<ILogger<SubmitRequestEndpoint>>();

    // ── Mongo stub for CreateRequest (plan ownership check uses Mongo) ───────────

    private static IMongoContext CreateEmptyMongo()
    {
        var mongo = Substitute.For<IMongoContext>();

        var nutritionCollection = PlanTestHelpers.CreateMockMongo().NutritionPlans;
        mongo.NutritionPlans.Returns(nutritionCollection);

        var trainingCollection = Substitute.For<IMongoCollection<Application.Domain.Documents.TrainingPlan>>();
        trainingCollection.FindAsync(
                Arg.Any<FilterDefinition<Application.Domain.Documents.TrainingPlan>>(),
                Arg.Any<FindOptions<Application.Domain.Documents.TrainingPlan, Application.Domain.Documents.TrainingPlan>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                var cursor = Substitute.For<IAsyncCursor<Application.Domain.Documents.TrainingPlan>>();
                cursor.Current.Returns([]);
                cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(false);
                return cursor;
            });
        mongo.TrainingPlans.Returns(trainingCollection);

        return mongo;
    }

    // ── Shared entity builders ───────────────────────────────────────────────────

    private ApplicationUser MakeProfessionalUser() => new()
    {
        Id = _professionalId,
        FirstName = "Jana",
        LastName = "Novakova",
        Email = "jana@example.com",
        UserName = "jana@example.com",
    };

    private ApplicationUser MakeClientUser() => new()
    {
        Id = _clientId,
        FirstName = "Petr",
        LastName = "Novak",
        Email = "petr@example.com",
        UserName = "petr@example.com",
    };

    private ProfessionalProfile MakeProfessionalProfile(ApplicationUser user) => new()
    {
        Id = 1,
        UserId = _professionalId,
        User = user,
    };

    private ClientProfile MakeClientProfile(ApplicationUser user) => new()
    {
        Id = 2,
        UserId = _clientId,
        PublicId = _clientId,
        User = user,
    };

    private ClientProfessionalLink MakeLink(ProfessionalProfile prof, ClientProfile client) => new()
    {
        Id = 1,
        ProfessionalProfileId = prof.Id,
        ClientProfileId = client.Id,
        ClientProfile = client,
        IsActive = true,
        ProfessionalRole = UserRole.Nutritionist,
        PublicId = Guid.NewGuid(),
        DateCreated = DateTime.UtcNow,
    };

    /// <summary>Builds a pending diary request attached to a link.</summary>
    private ApplicationPhotoRequest MakeDiaryRequest(
        ClientProfessionalLink link,
        PhotoDiaryStatus status = PhotoDiaryStatus.Pending,
        DateTimeOffset? acceptedAt = null) => new()
    {
        Id = Guid.NewGuid(),
        ProfessionalId = _professionalId,
        LinkId = link.Id,
        Link = link,
        DurationDays = 7,
        Status = status,
        Mode = status is PhotoDiaryStatus.Accepted or PhotoDiaryStatus.InProgress or PhotoDiaryStatus.Completed
            ? PhotoDiaryMode.Bulk : null,
        AcceptedAt = acceptedAt ?? (status is PhotoDiaryStatus.Accepted or PhotoDiaryStatus.InProgress or PhotoDiaryStatus.Completed
            ? DateTimeOffset.UtcNow : null),
        CompletedAt = status == PhotoDiaryStatus.Completed ? DateTimeOffset.UtcNow : null,
        DismissReason = status == PhotoDiaryStatus.Dismissed ? "pre-dismissed" : null,
        CreatedAt = DateTimeOffset.UtcNow,
        UpdatedAt = DateTimeOffset.UtcNow,
    };

    // ── CreateRequest ────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateRequest_LinkBased_EmitsPhotoDiaryRequested_ToClient()
    {
        var profUser = MakeProfessionalUser();
        var clientUser = MakeClientUser();
        var profProfile = MakeProfessionalProfile(profUser);
        var clientProfile = MakeClientProfile(clientUser);
        var link = MakeLink(profProfile, clientProfile);

        var db = new MockDbBuilder()
            .With(profUser)
            .With(profProfile)
            .With(clientUser)
            .With(clientProfile)
            .With(link)
            .Build();

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        var mongo = CreateEmptyMongo();

        var ep = Factory.Create<CreateRequestEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_professionalId, AppRoles.Nutritionist))),
            db, mongo, _notifier, userManager, _createLogger);

        await ep.HandleAsync(new CreateRequestRequest
        {
            LinkId = link.Id,
            DurationDays = 7,
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        // The client must receive exactly one photoDiaryRequested event
        await _notifier.Received(1).NotifyAsync(
            _clientId,             // recipient = client group
            "photoDiaryRequested",
            Arg.Is<PhotoDiaryRequestedEvent>(e =>
                e.DurationDays == 7 &&
                e.ProfessionalName == "Jana Novakova" &&
                e.ProfessionalRole == AppRoles.Nutritionist),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CreateRequest_LinkBased_EventContainsCorrectRequestId()
    {
        var profUser = MakeProfessionalUser();
        var clientUser = MakeClientUser();
        var profProfile = MakeProfessionalProfile(profUser);
        var clientProfile = MakeClientProfile(clientUser);
        var link = MakeLink(profProfile, clientProfile);

        var db = new MockDbBuilder()
            .With(profUser)
            .With(profProfile)
            .With(clientUser)
            .With(clientProfile)
            .With(link)
            .Build();

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        var mongo = CreateEmptyMongo();

        var ep = Factory.Create<CreateRequestEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_professionalId, AppRoles.Nutritionist))),
            db, mongo, _notifier, userManager, _createLogger);

        await ep.HandleAsync(new CreateRequestRequest
        {
            LinkId = link.Id,
            DurationDays = 14,
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        // RequestId in the event must match the id returned in the response
        await _notifier.Received(1).NotifyAsync(
            _clientId,
            "photoDiaryRequested",
            Arg.Is<PhotoDiaryRequestedEvent>(e => e.RequestId == ep.Response.Id),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CreateRequest_InviteBased_ExistingUser_EmitsPhotoDiaryRequested_ToClient()
    {
        const string inviteEmail = "petr@example.com";

        var profUser = MakeProfessionalUser();
        var profProfile = MakeProfessionalProfile(profUser);
        var invite = new PendingInvite
        {
            Id = 10,
            ProfessionalProfileId = profProfile.Id,
            Email = inviteEmail,
            FirstName = "Petr",
            LastName = "Novak",
            SentAt = DateTime.UtcNow,
            IsAccepted = false,
            PublicId = Guid.NewGuid(),
            DateCreated = DateTime.UtcNow,
        };

        var db = new MockDbBuilder()
            .With(profUser)
            .With(profProfile)
            .With(invite)
            .Build();

        // UserManager returns an existing user for the invite e-mail
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        var existingClientUser = MakeClientUser(); // Id = _clientId
        userManager.FindByEmailAsync(inviteEmail).Returns(existingClientUser);

        var mongo = CreateEmptyMongo();

        var ep = Factory.Create<CreateRequestEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_professionalId, AppRoles.Nutritionist))),
            db, mongo, _notifier, userManager, _createLogger);

        await ep.HandleAsync(new CreateRequestRequest
        {
            PendingInviteId = invite.Id,
            DurationDays = 7,
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        // The registered client must receive the event
        await _notifier.Received(1).NotifyAsync(
            _clientId,             // recipient = existing user's client group
            "photoDiaryRequested",
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CreateRequest_InviteBased_NoExistingUser_NoNotification()
    {
        const string inviteEmail = "unregistered@example.com";

        var profUser = MakeProfessionalUser();
        var profProfile = MakeProfessionalProfile(profUser);
        var invite = new PendingInvite
        {
            Id = 11,
            ProfessionalProfileId = profProfile.Id,
            Email = inviteEmail,
            FirstName = "Unknown",
            LastName = "User",
            SentAt = DateTime.UtcNow,
            IsAccepted = false,
            PublicId = Guid.NewGuid(),
            DateCreated = DateTime.UtcNow,
        };

        var db = new MockDbBuilder()
            .With(profUser)
            .With(profProfile)
            .With(invite)
            .Build();

        // UserManager returns null — no registered user for this e-mail
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByEmailAsync(inviteEmail).Returns((ApplicationUser?)null);

        var mongo = CreateEmptyMongo();

        var ep = Factory.Create<CreateRequestEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_professionalId, AppRoles.Nutritionist))),
            db, mongo, _notifier, userManager, _createLogger);

        await ep.HandleAsync(new CreateRequestRequest
        {
            PendingInviteId = invite.Id,
            DurationDays = 7,
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        // No notification should be sent — user hasn't registered yet
        await _notifier.DidNotReceive().NotifyAsync(
            Arg.Any<Guid>(),
            "photoDiaryRequested",
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CreateRequest_BroadcastThrows_MutationStillSucceeds()
    {
        _notifier
            .NotifyAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<object>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new InvalidOperationException("hub unavailable")));

        var profUser = MakeProfessionalUser();
        var clientUser = MakeClientUser();
        var profProfile = MakeProfessionalProfile(profUser);
        var clientProfile = MakeClientProfile(clientUser);
        var link = MakeLink(profProfile, clientProfile);

        var db = new MockDbBuilder()
            .With(profUser)
            .With(profProfile)
            .With(clientUser)
            .With(clientProfile)
            .With(link)
            .Build();

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        var mongo = CreateEmptyMongo();

        var ep = Factory.Create<CreateRequestEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_professionalId, AppRoles.Nutritionist))),
            db, mongo, _notifier, userManager, _createLogger);

        var act = () => ep.HandleAsync(new CreateRequestRequest
        {
            LinkId = link.Id,
            DurationDays = 7,
        }, TestContext.Current.CancellationToken);

        await act.Should().NotThrowAsync();
        ep.HttpContext.Response.StatusCode.Should().Be(201);
    }

    // ── DismissRequest ────────────────────────────────────────────────────────────

    [Fact]
    public async Task Dismiss_EmitsPhotoDiaryDismissed_ToProfessional()
    {
        var clientUser = MakeClientUser();
        var clientProfile = MakeClientProfile(clientUser);
        var profProfile = MakeProfessionalProfile(MakeProfessionalUser());
        var link = MakeLink(profProfile, clientProfile);
        var diaryReq = MakeDiaryRequest(link, PhotoDiaryStatus.Pending);

        var db = new MockDbBuilder()
            .With(clientUser)
            .With(clientProfile)
            .With(link)
            .With(diaryReq)
            .Build();

        var ep = Factory.Create<DismissRequestEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            db, _notifier, _dismissLogger);

        await ep.HandleAsync(new DismissRequestRequest
        {
            Id = diaryReq.Id,
            Reason = null,
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // The professional must receive exactly one photoDiaryDismissed event
        await _notifier.Received(1).NotifyAsync(
            _professionalId,        // recipient = professional group
            "photoDiaryDismissed",
            Arg.Is<PhotoDiaryDismissedEvent>(e =>
                e.RequestId == diaryReq.Id &&
                e.ClientName == "Petr Novak" &&
                e.DismissReason == null),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Dismiss_WithReason_EventContainsReason()
    {
        var clientUser = MakeClientUser();
        var clientProfile = MakeClientProfile(clientUser);
        var profProfile = MakeProfessionalProfile(MakeProfessionalUser());
        var link = MakeLink(profProfile, clientProfile);
        var diaryReq = MakeDiaryRequest(link, PhotoDiaryStatus.Pending);

        var db = new MockDbBuilder()
            .With(clientUser)
            .With(clientProfile)
            .With(link)
            .With(diaryReq)
            .Build();

        const string reason = "I prefer not to share photos.";

        var ep = Factory.Create<DismissRequestEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            db, _notifier, _dismissLogger);

        await ep.HandleAsync(new DismissRequestRequest
        {
            Id = diaryReq.Id,
            Reason = reason,
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await _notifier.Received(1).NotifyAsync(
            _professionalId,
            "photoDiaryDismissed",
            Arg.Is<PhotoDiaryDismissedEvent>(e =>
                e.RequestId == diaryReq.Id &&
                e.DismissReason == reason),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Dismiss_NotifiesProfessional_NotClient()
    {
        var clientUser = MakeClientUser();
        var clientProfile = MakeClientProfile(clientUser);
        var profProfile = MakeProfessionalProfile(MakeProfessionalUser());
        var link = MakeLink(profProfile, clientProfile);
        var diaryReq = MakeDiaryRequest(link, PhotoDiaryStatus.Pending);

        var db = new MockDbBuilder()
            .With(clientUser)
            .With(clientProfile)
            .With(link)
            .With(diaryReq)
            .Build();

        var ep = Factory.Create<DismissRequestEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            db, _notifier, _dismissLogger);

        await ep.HandleAsync(new DismissRequestRequest
        {
            Id = diaryReq.Id,
        }, TestContext.Current.CancellationToken);

        // Client must NOT receive the event
        await _notifier.DidNotReceive().NotifyAsync(
            _clientId,
            Arg.Any<string>(),
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Dismiss_BroadcastThrows_MutationStillSucceeds()
    {
        _notifier
            .NotifyAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<object>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new InvalidOperationException("hub unavailable")));

        var clientUser = MakeClientUser();
        var clientProfile = MakeClientProfile(clientUser);
        var profProfile = MakeProfessionalProfile(MakeProfessionalUser());
        var link = MakeLink(profProfile, clientProfile);
        var diaryReq = MakeDiaryRequest(link, PhotoDiaryStatus.Pending);

        var db = new MockDbBuilder()
            .With(clientUser)
            .With(clientProfile)
            .With(link)
            .With(diaryReq)
            .Build();

        var ep = Factory.Create<DismissRequestEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            db, _notifier, _dismissLogger);

        var act = () => ep.HandleAsync(new DismissRequestRequest
        {
            Id = diaryReq.Id,
        }, TestContext.Current.CancellationToken);

        await act.Should().NotThrowAsync();
        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }

    // ── SubmitRequest ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Submit_EmitsPhotoDiarySubmitted_ToProfessional()
    {
        var clientUser = MakeClientUser();
        var clientProfile = MakeClientProfile(clientUser);
        var profProfile = MakeProfessionalProfile(MakeProfessionalUser());
        var link = MakeLink(profProfile, clientProfile);
        var diaryReq = MakeDiaryRequest(link, PhotoDiaryStatus.InProgress);

        var db = new MockDbBuilder()
            .With(clientUser)
            .With(clientProfile)
            .With(link)
            .With(diaryReq)
            .Build();

        var ep = Factory.Create<SubmitRequestEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            db, _notifier, _submitLogger);

        await ep.HandleAsync(new SubmitRequestRequest
        {
            Id = diaryReq.Id,
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // The professional must receive exactly one photoDiarySubmitted event
        await _notifier.Received(1).NotifyAsync(
            _professionalId,       // recipient = professional group
            "photoDiarySubmitted",
            Arg.Is<PhotoDiarySubmittedEvent>(e =>
                e.RequestId == diaryReq.Id &&
                e.ClientName == "Petr Novak"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Submit_EventContainsPhotoCount()
    {
        var clientUser = MakeClientUser();
        var clientProfile = MakeClientProfile(clientUser);
        var profProfile = MakeProfessionalProfile(MakeProfessionalUser());
        var link = MakeLink(profProfile, clientProfile);
        var diaryReq = MakeDiaryRequest(link, PhotoDiaryStatus.Accepted);

        // Pre-seed 3 plan photos linked to this diary request
        var photos = Enumerable.Range(0, 3).Select(_ => new PlanPhoto
        {
            PublicId = Guid.NewGuid(),
            ClientProfileId = clientProfile.Id,
            PlanId = Guid.NewGuid(),
            PlanType = PlanPhotoType.Nutrition,
            Category = PlanPhotoCategory.Body,
            BlobUrl = $"plan-photos/{Guid.NewGuid()}.jpg",
            TakenAt = DateTime.UtcNow,
            UploadedByUserId = _clientId,
            DiaryRequestId = diaryReq.Id,
            DateCreated = DateTime.UtcNow,
            DateUpdated = DateTime.UtcNow,
        }).ToList();

        var db = new MockDbBuilder()
            .With(clientUser)
            .With(clientProfile)
            .With(link)
            .With(diaryReq)
            .With(photos[0])
            .With(photos[1])
            .With(photos[2])
            .Build();

        var ep = Factory.Create<SubmitRequestEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            db, _notifier, _submitLogger);

        await ep.HandleAsync(new SubmitRequestRequest
        {
            Id = diaryReq.Id,
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await _notifier.Received(1).NotifyAsync(
            _professionalId,
            "photoDiarySubmitted",
            Arg.Is<PhotoDiarySubmittedEvent>(e =>
                e.RequestId == diaryReq.Id &&
                e.PhotoCount == 3),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Submit_NotifiesProfessional_NotClient()
    {
        var clientUser = MakeClientUser();
        var clientProfile = MakeClientProfile(clientUser);
        var profProfile = MakeProfessionalProfile(MakeProfessionalUser());
        var link = MakeLink(profProfile, clientProfile);
        var diaryReq = MakeDiaryRequest(link, PhotoDiaryStatus.Accepted);

        var db = new MockDbBuilder()
            .With(clientUser)
            .With(clientProfile)
            .With(link)
            .With(diaryReq)
            .Build();

        var ep = Factory.Create<SubmitRequestEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            db, _notifier, _submitLogger);

        await ep.HandleAsync(new SubmitRequestRequest
        {
            Id = diaryReq.Id,
        }, TestContext.Current.CancellationToken);

        // Client must NOT receive the event
        await _notifier.DidNotReceive().NotifyAsync(
            _clientId,
            Arg.Any<string>(),
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Submit_BroadcastThrows_MutationStillSucceeds()
    {
        _notifier
            .NotifyAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<object>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new InvalidOperationException("hub unavailable")));

        var clientUser = MakeClientUser();
        var clientProfile = MakeClientProfile(clientUser);
        var profProfile = MakeProfessionalProfile(MakeProfessionalUser());
        var link = MakeLink(profProfile, clientProfile);
        var diaryReq = MakeDiaryRequest(link, PhotoDiaryStatus.InProgress);

        var db = new MockDbBuilder()
            .With(clientUser)
            .With(clientProfile)
            .With(link)
            .With(diaryReq)
            .Build();

        var ep = Factory.Create<SubmitRequestEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            db, _notifier, _submitLogger);

        var act = () => ep.HandleAsync(new SubmitRequestRequest
        {
            Id = diaryReq.Id,
        }, TestContext.Current.CancellationToken);

        await act.Should().NotThrowAsync();
        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }
}
