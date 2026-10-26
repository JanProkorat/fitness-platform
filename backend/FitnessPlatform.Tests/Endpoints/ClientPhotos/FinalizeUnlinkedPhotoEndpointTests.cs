using System.Net;
using System.Net.Http.Json;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.ClientPhotos;

/// <summary>
/// Integration tests for POST /client/photos.
/// </summary>
[Collection(TestCollection.Name)]
public class FinalizeUnlinkedPhotoEndpointTests(FitnessApiFactory factory)
{
    private sealed record PhotoBody(Guid Id, string BlobUrl, string DisplayUrl, string Category, Guid? PlanId);

    private static string NewBlobPath(Guid userId, string extension = "jpg") =>
        $"plan-photos/unlinked/{userId}/{Guid.NewGuid()}.{extension}";

    [Fact]
    public async Task HandleAsync_ValidRequest_Returns201AndPersistsPlanlessPhoto()
    {
        var ct = TestContext.Current.CancellationToken;
        var client = await TestActors.Client(factory).CreateAsync(ct);
        var blobPath = NewBlobPath(client.UserId);

        var response = await client.Http.PostAsJsonAsync(
            "/client/photos", new { blobUrl = blobPath, category = "Body", description = " front " }, ct);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<PhotoBody>(cancellationToken: ct);
        body!.PlanId.Should().BeNull();
        body.DisplayUrl.Should().NotBeNullOrEmpty();

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var stored = await db.PlanPhotos.AsNoTracking().SingleAsync(photo => photo.PublicId == body.Id, ct);
        stored.PlanId.Should().BeNull();
        stored.PlanType.Should().BeNull();
        stored.LinkId.Should().BeNull();
        stored.BlobUrl.Should().Be(blobPath);
        stored.Description.Should().Be("front");
        stored.UploadedByUserId.Should().Be(client.UserId);
        stored.ClientProfileId.Should().Be(client.ProfileId);
    }

    [Fact]
    public async Task HandleAsync_BlobUnderAnotherUsersPrefix_Returns400InvalidBlobUrl()
    {
        var ct = TestContext.Current.CancellationToken;
        var client = await TestActors.Client(factory).CreateAsync(ct);
        var otherClient = await TestActors.Client(factory).CreateAsync(ct);

        var response = await client.Http.PostAsJsonAsync(
            "/client/photos", new { blobUrl = NewBlobPath(otherClient.UserId), category = "Body" }, ct);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync(ct)).Should().Contain("INVALID_BLOB_URL");
    }

    [Fact]
    public async Task HandleAsync_PlanScopedBlobPath_Returns400InvalidBlobUrl()
    {
        var ct = TestContext.Current.CancellationToken;
        var client = await TestActors.Client(factory).CreateAsync(ct);

        var response = await client.Http.PostAsJsonAsync(
            "/client/photos",
            new { blobUrl = $"plan-photos/{Guid.NewGuid()}/{Guid.NewGuid()}.jpg", category = "Body" },
            ct);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync(ct)).Should().Contain("INVALID_BLOB_URL");
    }

    [Fact]
    public async Task HandleAsync_NestedPathUnderCallerPrefix_Returns400InvalidBlobUrl()
    {
        var ct = TestContext.Current.CancellationToken;
        var client = await TestActors.Client(factory).CreateAsync(ct);

        var response = await client.Http.PostAsJsonAsync(
            "/client/photos",
            new { blobUrl = $"plan-photos/unlinked/{client.UserId}/nested/{Guid.NewGuid()}.jpg", category = "Body" },
            ct);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Theory]
    [InlineData("Food")]
    [InlineData("Training")]
    public async Task HandleAsync_CategoryNeedingAPlan_Returns400(string category)
    {
        var ct = TestContext.Current.CancellationToken;
        var client = await TestActors.Client(factory).CreateAsync(ct);

        var response = await client.Http.PostAsJsonAsync(
            "/client/photos", new { blobUrl = NewBlobPath(client.UserId), category }, ct);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
