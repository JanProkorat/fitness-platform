using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using FormUp.Application.Domain.Documents;
using FormUp.Application.Domain.Enums;
using FormUp.Application.Infrastructure.Data;
using FormUp.Application.Infrastructure.Data.MongoDb;
using FormUp.Tests.Builders;
using FormUp.Tests.Endpoints.TrainingPlans;
using FormUp.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;

namespace FormUp.Tests.Endpoints.ClientTraining;

/// <summary>
/// Testcontainers integration tests (real MongoDB and PostgreSQL) proving that
/// <c>POST /client/training/log/sessions/{SessionId}/photos</c> only accepts photo URLs under the
/// session's own <c>diary/sessions/{sessionId}/</c> folder, and that photos already on the log still re-save.
/// </summary>
[Collection(TestCollection.Name)]
public class SaveSessionPhotosIntegrationTests(FitnessApiFactory factory)
{
    private const string StoredOutsideUrl = "https://minio.local/bucket/legacy-folder/legacy.jpg";

    private static DateTime TodayUtc => DateTime.UtcNow.Date;

    private static string SessionFolder(Guid sessionId) =>
        $"{MealPhotoTestHost.BlobRoot}diary/sessions/{sessionId}/";

    private async Task<(Actor Client, Guid PlanId, Guid SessionId)> SeedClientWithSessionAsync()
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
        var author = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        var sessionId = Guid.NewGuid();
        var startDate = DateTime.UtcNow.Date.AddDays(-(((int)DateTime.UtcNow.DayOfWeek + 6) % 7));
        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = client.UserId,
            TrainerId = author.UserId,
            Name = "Session photo plan",
            Status = TrainingPlanStatus.Active,
            StartDate = startDate,
            Version = 1,
            DateCreated = startDate,
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    DatePublished = startDate,
                    Days = TrainingPlanTestHelpers.MaterializeDays((1, new TrainingSession
                    {
                        SessionId = sessionId,
                        Name = "Push Day",
                        Order = 1,
                        Workouts = []
                    }))
                }
            ]
        };

        using (var scope = factory.Services.CreateScope())
        {
            var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
            await mongo.TrainingPlans.InsertOneAsync(plan, cancellationToken: TestContext.Current.CancellationToken);
        }

        return (client, plan.ExternalId, sessionId);
    }

    private async Task SeedSessionLogAsync(Actor client, Guid planId, Guid sessionId, params string[] storedUrls)
    {
        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        await mongo.SessionLogs.InsertOneAsync(
            new SessionLog
            {
                ClientId = client.UserId,
                PlanId = planId,
                SessionId = sessionId,
                LogDate = TodayUtc,
                Photos = storedUrls
                    .Select(url => new SessionPhoto { BlobUrl = url, UploadedAt = DateTime.UtcNow.AddDays(-1) })
                    .ToList(),
                Version = 1,
            },
            cancellationToken: TestContext.Current.CancellationToken);
    }

    private Task<HttpResponseMessage> SavePhotosAsync(Actor client, Guid sessionId, params string[] photoUrls) =>
        MealPhotoTestHost.CreateClientFor(factory, client).PostAsJsonAsync(
            $"/client/training/log/sessions/{sessionId}/photos",
            new { Photos = photoUrls.Select(url => new { BlobUrl = url }).ToArray() },
            TestContext.Current.CancellationToken);

    private async Task<List<SessionLog>> LoadLogsAsync(Guid clientUserId, Guid sessionId)
    {
        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        return await mongo.SessionLogs
            .Find(l => l.ClientId == clientUserId && l.SessionId == sessionId)
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
    public async Task SavePhotos_UrlUnderSessionFolder_Returns204AndPersists()
    {
        var (client, planId, sessionId) = await SeedClientWithSessionAsync();
        var url = $"{SessionFolder(sessionId)}{Guid.NewGuid():N}.jpg";

        var response = await SavePhotosAsync(client, sessionId, url);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await LoadLogsAsync(client.UserId, sessionId)).Should().ContainSingle()
            .Which.Photos.Should().ContainSingle().Which.BlobUrl.Should().Be(url);
        (await CountPlanPhotosAsync(planId)).Should().Be(1);
    }

    [Fact]
    public async Task SavePhotos_ForeignUrl_Returns400AndSavesNothing()
    {
        var (client, planId, sessionId) = await SeedClientWithSessionAsync();
        var foreignUrl = $"{SessionFolder(Guid.NewGuid())}{Guid.NewGuid():N}.jpg";

        var response = await SavePhotosAsync(client, sessionId, $"{SessionFolder(sessionId)}{Guid.NewGuid():N}.jpg", foreignUrl);

        await AssertInvalidBlobUrlAsync(response);
        (await LoadLogsAsync(client.UserId, sessionId)).Should().BeEmpty();
        (await CountPlanPhotosAsync(planId)).Should().Be(0);
    }

    [Fact]
    public async Task SavePhotos_StoredPhotoOutsideFolder_Returns204AndKeepsUploadedAt()
    {
        var (client, planId, sessionId) = await SeedClientWithSessionAsync();
        await SeedSessionLogAsync(client, planId, sessionId, StoredOutsideUrl);
        var uploadedAt = DateTime.UtcNow.AddDays(-1);

        var response = await SavePhotosAsync(client, sessionId, StoredOutsideUrl);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        var photo = (await LoadLogsAsync(client.UserId, sessionId)).Should().ContainSingle()
            .Which.Photos.Should().ContainSingle().Subject;
        photo.BlobUrl.Should().Be(StoredOutsideUrl);
        photo.UploadedAt.Should().BeCloseTo(uploadedAt, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task SavePhotos_StoredPhotoPlusNewUrlOutsideFolder_Returns400AndLeavesLogUnchanged()
    {
        var (client, planId, sessionId) = await SeedClientWithSessionAsync();
        await SeedSessionLogAsync(client, planId, sessionId, StoredOutsideUrl);
        var outsideUrl = $"{MealPhotoTestHost.BlobRoot}other-folder/{Guid.NewGuid():N}.jpg";

        var response = await SavePhotosAsync(client, sessionId, StoredOutsideUrl, outsideUrl);

        await AssertInvalidBlobUrlAsync(response);
        (await LoadLogsAsync(client.UserId, sessionId)).Should().ContainSingle()
            .Which.Photos.Should().ContainSingle().Which.BlobUrl.Should().Be(StoredOutsideUrl);
        (await CountPlanPhotosAsync(planId)).Should().Be(0);
    }
}
