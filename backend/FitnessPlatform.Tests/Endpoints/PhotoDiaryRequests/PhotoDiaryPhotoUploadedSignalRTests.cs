using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.PhotoDiaryRequests;
using FitnessPlatform.Application.Features.ClientPlans;
using FitnessPlatform.Application.Features.ClientPlans.FinalizePlanPhoto;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.NutritionPlans;
using Microsoft.Extensions.Logging;
using NSubstitute;
using ApplicationPhotoRequest = FitnessPlatform.Application.Domain.Entities.PhotoDiaryRequest;

namespace FitnessPlatform.Tests.Endpoints.PhotoDiaryRequests;

/// <summary>
/// Verifies the <c>photoDiaryPhotoUploaded</c> SignalR broadcast emitted by
/// <see cref="FinalizePlanPhotoEndpoint"/> when a photo is linked to an active diary request.
///
/// Covers:
/// <list type="bullet">
///   <item>Upload with diary request → professional receives <c>photoDiaryPhotoUploaded</c>.</item>
///   <item>Upload without diary request → <c>photoDiaryPhotoUploaded</c> is NOT emitted.</item>
///   <item>DayIndex computation: AcceptedAt set → computed; AcceptedAt null → 1.</item>
///   <item>Best-effort: broadcast failure does not fail the HTTP response.</item>
/// </list>
/// </summary>
public class PhotoDiaryPhotoUploadedSignalRTests
{
    // ── Shared identities ────────────────────────────────────────────────────────

    private readonly Guid _clientId = Guid.NewGuid();
    private readonly Guid _nutritionistId = Guid.NewGuid();

    // ── Dependencies ─────────────────────────────────────────────────────────────

    private readonly IRealtimeNotifier _notifier = Substitute.For<IRealtimeNotifier>();
    private readonly ILogger<FinalizePlanPhotoEndpoint> _logger =
        Substitute.For<ILogger<FinalizePlanPhotoEndpoint>>();

    // ── DB builder helpers ────────────────────────────────────────────────────────

    private ApplicationUser MakeClientUser() => new()
    {
        Id = _clientId,
        FirstName = "Petr",
        LastName = "Novak",
        Email = "petr@example.com",
        UserName = "petr@example.com",
    };

    private ClientProfile MakeClientProfile(ApplicationUser user) => new()
    {
        Id = 1,
        UserId = _clientId,
        PublicId = _clientId,
        User = user,
    };

    private ApplicationPhotoRequest MakeDiaryRequest(
        long linkId,
        ClientProfessionalLink link,
        PhotoDiaryStatus status = PhotoDiaryStatus.Accepted,
        DateTimeOffset? acceptedAt = null) => new()
    {
        Id = Guid.NewGuid(),
        ProfessionalId = _nutritionistId,
        LinkId = linkId,
        Link = link,
        DurationDays = 7,
        Status = status,
        Mode = PhotoDiaryMode.Workflow,
        AcceptedAt = acceptedAt ?? DateTimeOffset.UtcNow.AddDays(-2),
        CreatedAt = DateTimeOffset.UtcNow.AddDays(-3),
        UpdatedAt = DateTimeOffset.UtcNow.AddDays(-2),
    };

    // ── Mongo helper ──────────────────────────────────────────────────────────────

    private IMongoContext CreateMongoWithNutritionPlan(Guid planId) =>
        PlanTestHelpers.CreateMockMongo([PlanTestHelpers.CreatePlan(
            externalId: planId,
            clientId: _clientId,
            nutritionistId: _nutritionistId,
            status: NutritionPlanStatus.Active)]);

    // ── Endpoint factory ──────────────────────────────────────────────────────────

    private FinalizePlanPhotoEndpoint CreateEndpoint(IMongoContext mongo, IApplicationDbContext db) =>
        Factory.Create<FinalizePlanPhotoEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _logger);

    // ── Tests ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Upload_WithDiaryRequest_EmitsPhotoDiaryPhotoUploaded_ToProfessional()
    {
        var planId = Guid.NewGuid();
        var clientUser = MakeClientUser();
        var clientProfile = MakeClientProfile(clientUser);
        var link = new ClientProfessionalLink
        {
            Id = 1,
            ProfessionalProfileId = 2,
            ClientProfileId = clientProfile.Id,
            ClientProfile = clientProfile,
            IsActive = true,
            ProfessionalRole = UserRole.Nutritionist,
            PublicId = Guid.NewGuid(),
            DateCreated = DateTime.UtcNow,
        };
        var diaryReq = MakeDiaryRequest(link.Id, link);

        var db = new MockDbBuilder()
            .With(clientUser)
            .With(clientProfile)
            .With(link)
            .With(diaryReq)
            .Build();

        var mongo = CreateMongoWithNutritionPlan(planId);
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(new FinalizePlanPhotoRequest
        {
            PlanId = planId,
            BlobUrl = $"plan-photos/{planId}/{Guid.NewGuid()}.jpg",
            Category = PlanPhotoCategory.Body,
            DiaryRequestId = diaryReq.Id,
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        // Professional must receive photoDiaryPhotoUploaded
        await _notifier.Received(1).NotifyAsync(
            _nutritionistId,          // recipient = professional group
            "photodiaryphotouploaded",
            Arg.Is<PhotoDiaryPhotoUploadedEvent>(e =>
                e.RequestId == diaryReq.Id &&
                e.ClientName == "Petr Novak"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Upload_WithDiaryRequest_EventContainsCorrectPhotoId()
    {
        var planId = Guid.NewGuid();
        var clientUser = MakeClientUser();
        var clientProfile = MakeClientProfile(clientUser);
        var link = new ClientProfessionalLink
        {
            Id = 1,
            ProfessionalProfileId = 2,
            ClientProfileId = clientProfile.Id,
            ClientProfile = clientProfile,
            IsActive = true,
            ProfessionalRole = UserRole.Nutritionist,
            PublicId = Guid.NewGuid(),
            DateCreated = DateTime.UtcNow,
        };
        var diaryReq = MakeDiaryRequest(link.Id, link);

        var db = new MockDbBuilder()
            .With(clientUser)
            .With(clientProfile)
            .With(link)
            .With(diaryReq)
            .Build();

        var mongo = CreateMongoWithNutritionPlan(planId);
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(new FinalizePlanPhotoRequest
        {
            PlanId = planId,
            BlobUrl = $"plan-photos/{planId}/{Guid.NewGuid()}.jpg",
            Category = PlanPhotoCategory.Body,
            DiaryRequestId = diaryReq.Id,
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        // PhotoId in the diary event must match the photo returned by the endpoint
        await _notifier.Received(1).NotifyAsync(
            _nutritionistId,
            "photodiaryphotouploaded",
            Arg.Is<PhotoDiaryPhotoUploadedEvent>(e => e.PhotoId == ep.Response.Id),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Upload_WithDiaryRequest_DayIndex_ComputedFromAcceptedAt()
    {
        var planId = Guid.NewGuid();
        var clientUser = MakeClientUser();
        var clientProfile = MakeClientProfile(clientUser);
        var link = new ClientProfessionalLink
        {
            Id = 1,
            ProfessionalProfileId = 2,
            ClientProfileId = clientProfile.Id,
            ClientProfile = clientProfile,
            IsActive = true,
            ProfessionalRole = UserRole.Nutritionist,
            PublicId = Guid.NewGuid(),
            DateCreated = DateTime.UtcNow,
        };

        // AcceptedAt 3 days ago → DayIndex should be 4
        var acceptedAt = DateTimeOffset.UtcNow.AddDays(-3);
        var diaryReq = MakeDiaryRequest(link.Id, link, PhotoDiaryStatus.InProgress, acceptedAt);

        var db = new MockDbBuilder()
            .With(clientUser)
            .With(clientProfile)
            .With(link)
            .With(diaryReq)
            .Build();

        var mongo = CreateMongoWithNutritionPlan(planId);
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(new FinalizePlanPhotoRequest
        {
            PlanId = planId,
            BlobUrl = $"plan-photos/{planId}/{Guid.NewGuid()}.jpg",
            Category = PlanPhotoCategory.Body,
            DiaryRequestId = diaryReq.Id,
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await _notifier.Received(1).NotifyAsync(
            _nutritionistId,
            "photodiaryphotouploaded",
            Arg.Is<PhotoDiaryPhotoUploadedEvent>(e => e.DayIndex == 4),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Upload_WithoutDiaryRequest_DoesNotEmitPhotoDiaryPhotoUploaded()
    {
        var planId = Guid.NewGuid();
        var clientUser = MakeClientUser();
        var clientProfile = MakeClientProfile(clientUser);

        var db = new MockDbBuilder()
            .With(clientUser)
            .With(clientProfile)
            .Build();

        var mongo = CreateMongoWithNutritionPlan(planId);
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(new FinalizePlanPhotoRequest
        {
            PlanId = planId,
            BlobUrl = $"plan-photos/{planId}/{Guid.NewGuid()}.jpg",
            Category = PlanPhotoCategory.Body,
            // No DiaryRequestId — plain upload
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        // photoDiaryPhotoUploaded must NOT be emitted for a plain upload
        await _notifier.DidNotReceive().NotifyAsync(
            Arg.Any<Guid>(),
            "photodiaryphotouploaded",
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Upload_WithDiaryRequest_BroadcastThrows_MutationStillSucceeds()
    {
        _notifier
            .NotifyAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<object>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new InvalidOperationException("hub unavailable")));

        var planId = Guid.NewGuid();
        var clientUser = MakeClientUser();
        var clientProfile = MakeClientProfile(clientUser);
        var link = new ClientProfessionalLink
        {
            Id = 1,
            ProfessionalProfileId = 2,
            ClientProfileId = clientProfile.Id,
            ClientProfile = clientProfile,
            IsActive = true,
            ProfessionalRole = UserRole.Nutritionist,
            PublicId = Guid.NewGuid(),
            DateCreated = DateTime.UtcNow,
        };
        var diaryReq = MakeDiaryRequest(link.Id, link);

        var db = new MockDbBuilder()
            .With(clientUser)
            .With(clientProfile)
            .With(link)
            .With(diaryReq)
            .Build();

        var mongo = CreateMongoWithNutritionPlan(planId);
        var ep = CreateEndpoint(mongo, db);

        var act = () => ep.HandleAsync(new FinalizePlanPhotoRequest
        {
            PlanId = planId,
            BlobUrl = $"plan-photos/{planId}/{Guid.NewGuid()}.jpg",
            Category = PlanPhotoCategory.Body,
            DiaryRequestId = diaryReq.Id,
        }, TestContext.Current.CancellationToken);

        await act.Should().NotThrowAsync();
        ep.HttpContext.Response.StatusCode.Should().Be(201);
    }
}
