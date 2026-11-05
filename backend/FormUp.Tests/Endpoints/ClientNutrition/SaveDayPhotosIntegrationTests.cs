using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using FormUp.Application.Domain.Documents;
using FormUp.Application.Domain.Enums;
using FormUp.Application.Infrastructure.Data;
using FormUp.Application.Infrastructure.Data.MongoDb;
using FormUp.Tests.Builders;
using FormUp.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;

namespace FormUp.Tests.Endpoints.ClientNutrition;

/// <summary>
/// Testcontainers integration tests (real MongoDB and PostgreSQL) proving that
/// <c>POST /client/nutrition/log/day/photos</c> only accepts photo URLs under the active plan's
/// <c>plan-photos/{planId}/</c> folder, and that photos already on the day log still re-save.
/// </summary>
[Collection(TestCollection.Name)]
public class SaveDayPhotosIntegrationTests(FitnessApiFactory factory)
{
    private const string StoredOutsideUrl = "https://minio.local/bucket/legacy-folder/legacy.jpg";

    private static DateTime TodayUtc => DateTime.UtcNow.Date;

    private static string PlanFolder(Guid planId) => $"{MealPhotoTestHost.BlobRoot}plan-photos/{planId}/";

    private async Task<(Actor Client, Guid PlanId)> SeedClientWithPlanAsync()
    {
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);

        // Pin the client's zone to UTC so the UTC-based "today" equals the endpoint's client-local today.
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await db.Users
                .Where(u => u.Id == client.UserId)
                .ExecuteUpdateAsync(s => s.SetProperty(u => u.TimeZone, "UTC"), TestContext.Current.CancellationToken);
        }

        // A real author: the photo dual-write adds a viewer row with a FK to the users table.
        var author = await TestActors.Nutritionist(factory).CreateAsync(TestContext.Current.CancellationToken);
        var plan = await ClientNutritionFixtures.InsertPlanAsync(
            factory,
            client.UserId,
            NutritionPlanStatus.Active,
            ClientNutritionFixtures.CurrentWeekMondayUtc(),
            author.UserId,
            null,
            ClientNutritionFixtures.Week(1, WeekStatus.Published));

        return (client, plan.ExternalId);
    }

    private async Task SeedDayLogAsync(Actor client, Guid planId, params string[] storedUrls)
    {
        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        await mongo.DayLogs.InsertOneAsync(
            new DayLog
            {
                ClientId = client.UserId,
                PlanId = planId,
                LogDate = TodayUtc,
                Photos = storedUrls
                    .Select(url => new DayPhoto { BlobUrl = url, UploadedAt = DateTime.UtcNow.AddDays(-1) })
                    .ToList(),
            },
            cancellationToken: TestContext.Current.CancellationToken);
    }

    private Task<HttpResponseMessage> SavePhotosAsync(Actor client, params string[] photoUrls) =>
        MealPhotoTestHost.CreateClientFor(factory, client).PostAsJsonAsync(
            "/client/nutrition/log/day/photos",
            new { Photos = photoUrls.Select(url => new { BlobUrl = url }).ToArray() },
            TestContext.Current.CancellationToken);

    private async Task<List<DayLog>> LoadLogsAsync(Guid clientUserId, Guid planId)
    {
        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        return await mongo.DayLogs
            .Find(l => l.ClientId == clientUserId && l.PlanId == planId)
            .ToListAsync(TestContext.Current.CancellationToken);
    }

    private async Task<int> CountPlanPhotosAsync(Guid planId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
        return await db.PlanPhotos.AsNoTracking().CountAsync(p => p.PlanId == planId, TestContext.Current.CancellationToken);
    }

    private static async Task AssertInvalidBlobUrlAsync(HttpResponseMessage response)
    {
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        body.RootElement.GetProperty("errorCode").GetString().Should().Be("INVALID_BLOB_URL");
    }

    [Fact]
    public async Task SavePhotos_UrlUnderPlanFolder_Returns204AndPersists()
    {
        var (client, planId) = await SeedClientWithPlanAsync();
        var url = $"{PlanFolder(planId)}{Guid.NewGuid():N}.jpg";

        var response = await SavePhotosAsync(client, url);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await LoadLogsAsync(client.UserId, planId)).Should().ContainSingle()
            .Which.Photos.Should().ContainSingle().Which.BlobUrl.Should().Be(url);
        (await CountPlanPhotosAsync(planId)).Should().Be(1);
    }

    [Fact]
    public async Task SavePhotos_ForeignUrl_Returns400AndSavesNothing()
    {
        var (client, planId) = await SeedClientWithPlanAsync();
        var foreignUrl = $"{PlanFolder(Guid.NewGuid())}{Guid.NewGuid():N}.jpg";

        var response = await SavePhotosAsync(client, $"{PlanFolder(planId)}{Guid.NewGuid():N}.jpg", foreignUrl);

        await AssertInvalidBlobUrlAsync(response);
        (await LoadLogsAsync(client.UserId, planId)).Should().BeEmpty();
        (await CountPlanPhotosAsync(planId)).Should().Be(0);
    }

    [Fact]
    public async Task SavePhotos_StoredPhotoOutsideFolder_Returns204AndKeepsUploadedAt()
    {
        var (client, planId) = await SeedClientWithPlanAsync();
        await SeedDayLogAsync(client, planId, StoredOutsideUrl);
        var uploadedAt = DateTime.UtcNow.AddDays(-1);

        var response = await SavePhotosAsync(client, StoredOutsideUrl);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        var photo = (await LoadLogsAsync(client.UserId, planId)).Should().ContainSingle()
            .Which.Photos.Should().ContainSingle().Subject;
        photo.BlobUrl.Should().Be(StoredOutsideUrl);
        photo.UploadedAt.Should().BeCloseTo(uploadedAt, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task SavePhotos_StoredPhotoPlusNewUrlOutsideFolder_Returns400AndLeavesLogUnchanged()
    {
        var (client, planId) = await SeedClientWithPlanAsync();
        await SeedDayLogAsync(client, planId, StoredOutsideUrl);
        var outsideUrl = $"{MealPhotoTestHost.BlobRoot}other-folder/{Guid.NewGuid():N}.jpg";

        var response = await SavePhotosAsync(client, StoredOutsideUrl, outsideUrl);

        await AssertInvalidBlobUrlAsync(response);
        (await LoadLogsAsync(client.UserId, planId)).Should().ContainSingle()
            .Which.Photos.Should().ContainSingle().Which.BlobUrl.Should().Be(StoredOutsideUrl);
        (await CountPlanPhotosAsync(planId)).Should().Be(0);
    }
}
