using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.ClientPlans.GetPlanPhotos;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;

namespace FitnessPlatform.Tests.Endpoints.ClientPlans;

/// <summary>
/// Tests for <see cref="GetPlanPhotosEndpoint"/>.
/// </summary>
public class GetPlanPhotosEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();

    /// <summary>
    /// Shared fake so tests can assert on <see cref="FakeBlobStorageService.SignedUrlRequests"/> —
    /// which stored BlobUrls were routed through signing before the response was sent (F9).
    /// </summary>
    private readonly FakeBlobStorageService _blobStorage = new();

    private MockDbBuilder CreateDbBuilder() =>
        new MockDbBuilder()
            .With(new ClientProfile { Id = 1, UserId = _clientId, PublicId = _clientId });

    private GetPlanPhotosEndpoint CreateEndpoint(IApplicationDbContext db) =>
        Factory.Create<GetPlanPhotosEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            db,
            _blobStorage);

    private PlanPhoto CreatePhoto(
        Guid planId,
        PlanPhotoCategory category = PlanPhotoCategory.Body,
        string blobUrl = "plan-photos/photo.jpg",
        long clientProfileId = 1) =>
        new()
        {
            PublicId = Guid.NewGuid(),
            ClientProfileId = clientProfileId,
            PlanId = planId,
            Category = category,
            BlobUrl = blobUrl,
            TakenAt = DateTime.UtcNow,
            UploadedByUserId = _clientId,
            DateCreated = DateTime.UtcNow
        };

    // ── Happy-path ────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_PhotosExist_Returns200WithItems()
    {
        var planId = Guid.NewGuid();
        var photo1 = CreatePhoto(planId, PlanPhotoCategory.Body, "blob1.jpg");
        var photo2 = CreatePhoto(planId, PlanPhotoCategory.Food, "blob2.jpg");

        var db = CreateDbBuilder()
            .With(photo1)
            .With(photo2)
            .Build();

        var ep = CreateEndpoint(db);

        await ep.HandleAsync(new GetPlanPhotosRequest
        {
            PlanId = planId,
            Page = 1,
            PageSize = 20
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.Should().HaveCount(2);
        ep.HttpContext.Response.Headers["X-Total-Count"].ToString().Should().Be("2");
    }

    [Fact]
    public async Task HandleAsync_NoPlanPhotos_Returns200WithEmptyList()
    {
        var db = CreateDbBuilder().Build();
        var ep = CreateEndpoint(db);

        await ep.HandleAsync(new GetPlanPhotosRequest
        {
            PlanId = Guid.NewGuid(),
            Page = 1,
            PageSize = 20
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.Should().BeEmpty();
        ep.HttpContext.Response.Headers["X-Total-Count"].ToString().Should().Be("0");
    }

    [Fact]
    public async Task HandleAsync_CategoryFilter_ReturnsOnlyMatchingPhotos()
    {
        var planId = Guid.NewGuid();
        var bodyPhoto = CreatePhoto(planId, PlanPhotoCategory.Body, "body.jpg");
        var foodPhoto = CreatePhoto(planId, PlanPhotoCategory.Food, "food.jpg");

        var db = CreateDbBuilder()
            .With(bodyPhoto)
            .With(foodPhoto)
            .Build();

        var ep = CreateEndpoint(db);

        await ep.HandleAsync(new GetPlanPhotosRequest
        {
            PlanId = planId,
            Category = PlanPhotoCategory.Body,
            Page = 1,
            PageSize = 20
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.Should().HaveCount(1);
        ep.Response[0].Category.Should().Be(PlanPhotoCategory.Body);
        ep.HttpContext.Response.Headers["X-Total-Count"].ToString().Should().Be("1");
    }

    [Fact]
    public async Task HandleAsync_OtherClientPhoto_NotReturnedInResults()
    {
        var planId = Guid.NewGuid();
        var otherClientPhoto = CreatePhoto(planId, PlanPhotoCategory.Body, "other.jpg",
            clientProfileId: 999); // different client profile Id

        var db = CreateDbBuilder()
            .With(otherClientPhoto)
            .Build();

        var ep = CreateEndpoint(db);

        await ep.HandleAsync(new GetPlanPhotosRequest
        {
            PlanId = planId,
            Page = 1,
            PageSize = 20
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.Should().BeEmpty();
    }

    // ── Signed read URLs (F9) ────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_PhotosExist_ReturnsSignedReadUrlNotStoredValue()
    {
        var planId = Guid.NewGuid();
        var photo = CreatePhoto(planId, PlanPhotoCategory.Body, "plan-photos/abc/photo.jpg");

        var db = CreateDbBuilder().With(photo).Build();
        var ep = CreateEndpoint(db);

        await ep.HandleAsync(new GetPlanPhotosRequest
        {
            PlanId = planId,
            Page = 1,
            PageSize = 20
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.Should().ContainSingle();

        // Positive control: the stored BlobUrl reaches the signing call verbatim.
        _blobStorage.SignedUrlRequests.Should().Contain("plan-photos/abc/photo.jpg");

        // Negative control: DisplayUrl carries the fake's recognisable signed-URL marker — a
        // bucket with no public-read grant on plan-photos/* would 403 on the raw value (F9) —
        // while BlobUrl stays the canonical, permanent identity value so a client can safely
        // echo it back on a later write instead of the expiring signature.
        ep.Response[0].DisplayUrl.Should().Be("plan-photos/abc/photo.jpg?signed=test");
        ep.Response[0].BlobUrl.Should().Be("plan-photos/abc/photo.jpg");
    }

    // ── Pagination ────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_PaginationApplied_ReturnsCorrectPage()
    {
        var planId = Guid.NewGuid();

        // Insert 5 photos
        var builder = CreateDbBuilder();
        for (var i = 0; i < 5; i++)
            builder.With(CreatePhoto(planId, blobUrl: $"photo{i}.jpg"));

        var db = builder.Build();
        var ep = CreateEndpoint(db);

        await ep.HandleAsync(new GetPlanPhotosRequest
        {
            PlanId = planId,
            Page = 1,
            PageSize = 3
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.Should().HaveCount(3);
        ep.HttpContext.Response.Headers["X-Total-Count"].ToString().Should().Be("5");
    }

    // ── Auth guard ────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_NoClientProfile_Returns404()
    {
        var db = new MockDbBuilder().Build(); // no client profile
        var ep = CreateEndpoint(db);

        await ep.HandleAsync(new GetPlanPhotosRequest
        {
            PlanId = Guid.NewGuid(),
            Page = 1,
            PageSize = 20
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }
}
