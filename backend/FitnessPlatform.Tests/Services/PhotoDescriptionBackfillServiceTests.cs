using FluentAssertions;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using MongoDB.Driver;
using Npgsql;
using Testcontainers.MongoDb;
using Testcontainers.PostgreSql;

namespace FitnessPlatform.Tests.Services;

/// <summary>
/// Testcontainers integration tests for <see cref="PhotoDescriptionBackfillService"/>.
///
/// Boots real PostgreSQL (all migrations applied) and MongoDB containers, seeds
/// minimal data, then verifies that the backfill copies Mongo notes into
/// <c>PlanPhoto.Description</c> correctly and that a second invocation is a no-op.
/// </summary>
public class PhotoDescriptionBackfillServiceTests : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:16").Build();
    private readonly MongoDbContainer   _mongo    = new MongoDbBuilder("mongo:7").Build();

    private ApplicationDbContext _db       = null!;
    private IMongoContext        _mongoCtx = null!;

    // ── IAsyncLifetime ───────────────────────────────────────────────────────

    public async ValueTask InitializeAsync()
    {
        await Task.WhenAll(_postgres.StartAsync(), _mongo.StartAsync());

        _db = BuildDbContext(_postgres.GetConnectionString());

        // Apply all EF migrations so the full schema (including plan_photos) is available.
        await _db.Database.MigrateAsync(TestContext.Current.CancellationToken);

        var mongoClient = new MongoClient(_mongo.GetConnectionString());
        var mongoDb     = mongoClient.GetDatabase("fitness_backfill_test");
        _mongoCtx = new MongoContext(mongoDb);
    }

    public async ValueTask DisposeAsync()
    {
        await _db.DisposeAsync();
        await Task.WhenAll(
            _postgres.DisposeAsync().AsTask(),
            _mongo.DisposeAsync().AsTask());
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private static ApplicationDbContext BuildDbContext(string connectionString)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(connectionString)
            .UseSnakeCaseNamingConvention()
            .ConfigureWarnings(w =>
                w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning))
            .Options;
        return new ApplicationDbContext(options);
    }

    /// <summary>
    /// Inserts a minimal ApplicationUser + ClientProfile into Postgres via raw SQL,
    /// bypassing ASP.NET Identity (not available in this stripped-down test context).
    /// Returns the auto-generated <c>client_profile.id</c> (long) and the user's <c>id</c> (Guid).
    /// </summary>
    private async Task<(long ClientProfileId, Guid UserId, Guid ClientPublicId)>
        CreateUserAndClientProfileAsync()
    {
        var ct     = TestContext.Current.CancellationToken;
        var userId = Guid.NewGuid();

        await using var conn = new NpgsqlConnection(_postgres.GetConnectionString());
        await conn.OpenAsync(ct);

        // Insert a minimal user row (all NOT NULL columns that don't have DB defaults).
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = @"
                INSERT INTO users (
                    id, user_name, normalized_user_name,
                    email, normalized_email, email_confirmed,
                    password_hash, security_stamp, concurrency_stamp,
                    phone_number_confirmed, two_factor_enabled,
                    lockout_enabled, access_failed_count,
                    first_name, last_name, is_active, date_created,
                    gdpr_consent, verification_emails_sent, time_zone
                ) VALUES (
                    @id, @email, @emailUpper,
                    @email, @emailUpper, true,
                    '', gen_random_uuid()::text, gen_random_uuid()::text,
                    false, false,
                    true, 0,
                    'Test', 'User', true, now(),
                    true, 0, 'Europe/Prague'
                )";
            cmd.Parameters.AddWithValue("id",         userId);
            cmd.Parameters.AddWithValue("email",      $"{userId:N}@backfill-test.com");
            cmd.Parameters.AddWithValue("emailUpper", $"{userId:N}@BACKFILL-TEST.COM");
            await cmd.ExecuteNonQueryAsync(ct);
        }

        var clientPublicId = Guid.NewGuid();
        long clientProfileId;
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = @"
                INSERT INTO client_profiles
                    (user_id, public_id, date_created, is_onboarding_complete)
                VALUES
                    (@userId, @publicId, now(), false)
                RETURNING id";
            cmd.Parameters.AddWithValue("userId",   userId);
            cmd.Parameters.AddWithValue("publicId", clientPublicId);
            clientProfileId = (long)(await cmd.ExecuteScalarAsync(ct))!;
        }

        return (clientProfileId, userId, clientPublicId);
    }

    /// <summary>
    /// Inserts a <c>plan_photos</c> row with <c>description = NULL</c> via raw SQL.
    /// Returns the auto-generated <c>id</c> (long PK).
    /// </summary>
    private async Task<long> InsertPlanPhotoAsync(
        long clientProfileId,
        Guid uploadedByUserId,
        string blobUrl,
        string? mealLogId,
        PlanPhotoCategory category,
        Guid? planId = null)
    {
        var ct = TestContext.Current.CancellationToken;

        await using var conn = new NpgsqlConnection(_postgres.GetConnectionString());
        await conn.OpenAsync(ct);

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO plan_photos (
                client_profile_id, plan_id, plan_type, link_id,
                category, blob_url, description, meal_log_id,
                taken_at, uploaded_by_user_id, diary_request_id,
                date_created, date_updated, public_id
            ) VALUES (
                @clientProfileId, @planId, @planType, @linkId,
                @category, @blobUrl, NULL, @mealLogId,
                now(), @uploadedBy, NULL,
                now(), now(), @publicId
            )
            RETURNING id";

        cmd.Parameters.AddWithValue("clientProfileId", clientProfileId);
        cmd.Parameters.AddWithValue("planId",    planId.HasValue ? (object)planId.Value : DBNull.Value);
        cmd.Parameters.AddWithValue("planType",  planId.HasValue ? (object)"Nutrition"  : DBNull.Value);
        cmd.Parameters.AddWithValue("linkId",    planId.HasValue ? (object)planId.Value : DBNull.Value);
        cmd.Parameters.AddWithValue("category",  category.ToString());
        cmd.Parameters.AddWithValue("blobUrl",   blobUrl);
        cmd.Parameters.AddWithValue("mealLogId", mealLogId is null ? (object)DBNull.Value : mealLogId);
        cmd.Parameters.AddWithValue("uploadedBy", uploadedByUserId);
        cmd.Parameters.AddWithValue("publicId",   Guid.NewGuid());

        return (long)(await cmd.ExecuteScalarAsync(ct))!;
    }

    private PhotoDescriptionBackfillService BuildSut()
    {
        // Rebuild context so the tracked-entity cache is clean for each invocation.
        _db.Dispose();
        _db = BuildDbContext(_postgres.GetConnectionString());

        return new PhotoDescriptionBackfillService(
            _db,
            _mongoCtx,
            NullLogger<PhotoDescriptionBackfillService>.Instance);
    }

    // ── tests ─────────────────────────────────────────────────────────────────

    /// <summary>
    /// A <c>PlanPhoto</c> with <c>Description = null</c> and a matching <c>MealLog</c>
    /// that has a <c>MealPhoto.Note</c> → after backfill the Description is populated.
    /// A second run is a no-op (idempotency).
    /// </summary>
    [Fact]
    public async Task BackfillAsync_MealPhoto_WithNote_SetsDescription_AndIsIdempotent()
    {
        var ct = TestContext.Current.CancellationToken;

        // Arrange — Postgres side
        var (clientProfileId, userId, _) = await CreateUserAndClientProfileAsync();

        var blobUrl   = $"https://minio/plan-photos/{Guid.NewGuid()}.jpg";
        var mealLogId = ObjectId.GenerateNewId();

        var planPhotoId = await InsertPlanPhotoAsync(
            clientProfileId,
            userId,
            blobUrl,
            mealLogId.ToString(),
            PlanPhotoCategory.Food);

        // Arrange — Mongo side: insert a MealLog with a matching MealPhoto that has a Note
        var mealLog = new MealLog
        {
            Id     = mealLogId,
            ClientId = Guid.NewGuid(), // value doesn't matter for this test
            PlanId   = Guid.NewGuid(),
            MealId   = Guid.NewGuid(),
            LogDate  = DateTime.UtcNow.Date,
            Photos =
            [
                new MealPhoto
                {
                    BlobUrl    = blobUrl,
                    UploadedAt = DateTime.UtcNow,
                    Note       = "Backfilled note"
                }
            ]
        };
        await _mongoCtx.MealLogs.InsertOneAsync(mealLog, cancellationToken: ct);

        // Act — first run
        var sut = BuildSut();
        var (mealCount1, _) = await sut.BackfillAsync(ct);
        mealCount1.Should().Be(1);

        // Assert — Description is now set
        var updatedPhoto = await _db.PlanPhotos
            .AsNoTracking()
            .FirstAsync(p => p.Id == planPhotoId, ct);

        updatedPhoto.Description.Should().Be("Backfilled note");
        updatedPhoto.DateUpdated.Should().NotBeNull();

        // Capture DateUpdated before second run
        var dateUpdatedAfterFirstRun = updatedPhoto.DateUpdated;

        // Act — second run (idempotency check)
        var sut2 = BuildSut();
        var (mealCount2, _) = await sut2.BackfillAsync(ct);
        mealCount2.Should().Be(0, "no rows with Description IS NULL remain");

        // Assert — Description and DateUpdated are unchanged
        var afterSecondRun = await _db.PlanPhotos
            .AsNoTracking()
            .FirstAsync(p => p.Id == planPhotoId, ct);

        afterSecondRun.Description.Should().Be("Backfilled note");
        afterSecondRun.DateUpdated.Should().Be(dateUpdatedAfterFirstRun,
            "a second backfill must not touch rows that already have a description");
    }

    /// <summary>
    /// A <c>PlanPhoto</c> row whose matching <c>MealPhoto.Note</c> is null or empty
    /// is skipped — <c>Description</c> stays null after the backfill.
    /// </summary>
    [Fact]
    public async Task BackfillAsync_MealPhoto_WithNullNote_SkipsRow()
    {
        var ct = TestContext.Current.CancellationToken;

        // Arrange — Postgres
        var (clientProfileId, userId, _) = await CreateUserAndClientProfileAsync();

        var blobUrl   = $"https://minio/plan-photos/{Guid.NewGuid()}.jpg";
        var mealLogId = ObjectId.GenerateNewId();

        await InsertPlanPhotoAsync(
            clientProfileId,
            userId,
            blobUrl,
            mealLogId.ToString(),
            PlanPhotoCategory.Food);

        // Arrange — Mongo: MealPhoto has no Note
        var mealLog = new MealLog
        {
            Id       = mealLogId,
            ClientId = Guid.NewGuid(),
            PlanId   = Guid.NewGuid(),
            MealId   = Guid.NewGuid(),
            LogDate  = DateTime.UtcNow.Date,
            Photos =
            [
                new MealPhoto { BlobUrl = blobUrl, UploadedAt = DateTime.UtcNow, Note = null }
            ]
        };
        await _mongoCtx.MealLogs.InsertOneAsync(mealLog, cancellationToken: ct);

        // Act
        var sut = BuildSut();
        var (mealCount, _) = await sut.BackfillAsync(ct);
        mealCount.Should().Be(0);

        // Assert — Description stays null
        var photo = await _db.PlanPhotos
            .AsNoTracking()
            .Where(p => p.MealLogId == mealLogId.ToString())
            .FirstAsync(ct);

        photo.Description.Should().BeNull("no note exists in Mongo for this photo");
    }

    /// <summary>
    /// A day-photo <c>PlanPhoto</c> row (Category = Body, MealLogId = null)
    /// whose matching <c>DayPhoto.Note</c> is set → after backfill the Description is populated.
    /// A second run is a no-op.
    /// </summary>
    [Fact]
    public async Task BackfillAsync_DayPhoto_WithNote_SetsDescription_AndIsIdempotent()
    {
        var ct = TestContext.Current.CancellationToken;

        // Arrange — Postgres
        var (clientProfileId, userId, clientPublicId) = await CreateUserAndClientProfileAsync();

        var planId  = Guid.NewGuid();
        var blobUrl = $"https://minio/plan-photos/{Guid.NewGuid()}.jpg";

        var planPhotoId = await InsertPlanPhotoAsync(
            clientProfileId,
            userId,
            blobUrl,
            mealLogId: null,           // day photo — no MealLogId
            PlanPhotoCategory.Body,
            planId: planId);

        // Arrange — Mongo: a DayLog for the same (clientId, planId) with a DayPhoto that has a Note
        var dayLog = new DayLog
        {
            ClientId  = clientPublicId, // matches ClientProfile.PublicId
            PlanId    = planId,
            LogDate   = DateTime.UtcNow.Date,
            Photos =
            [
                new DayPhoto
                {
                    BlobUrl    = blobUrl,
                    UploadedAt = DateTime.UtcNow,
                    Note       = "Day photo note",
                    Category   = DayPhotoCategory.Progress
                }
            ]
        };
        await _mongoCtx.DayLogs.InsertOneAsync(dayLog, cancellationToken: ct);

        // Act — first run
        var sut = BuildSut();
        var (_, dayCount1) = await sut.BackfillAsync(ct);
        dayCount1.Should().Be(1);

        // Assert
        var updatedPhoto = await _db.PlanPhotos
            .AsNoTracking()
            .FirstAsync(p => p.Id == planPhotoId, ct);

        updatedPhoto.Description.Should().Be("Day photo note");
        updatedPhoto.DateUpdated.Should().NotBeNull();

        var dateUpdatedAfterFirstRun = updatedPhoto.DateUpdated;

        // Act — second run (idempotency)
        var sut2 = BuildSut();
        var (_, dayCount2) = await sut2.BackfillAsync(ct);
        dayCount2.Should().Be(0, "no rows with Description IS NULL remain");

        var afterSecondRun = await _db.PlanPhotos
            .AsNoTracking()
            .FirstAsync(p => p.Id == planPhotoId, ct);

        afterSecondRun.Description.Should().Be("Day photo note");
        afterSecondRun.DateUpdated.Should().Be(dateUpdatedAfterFirstRun,
            "a second backfill must not touch rows that already have a description");
    }
}
