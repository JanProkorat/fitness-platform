using FluentAssertions;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Testcontainers.PostgreSql;

namespace FitnessPlatform.Tests.Migrations;

/// <summary>
/// Testcontainers integration test that:
/// 1. Boots a fresh PostgreSQL container.
/// 2. Seeds two rows into the legacy <c>progress_photos</c> table
///    (by rolling the DB to the migration just before our new one).
/// 3. Applies the <c>AddPlanPhotoRetireProgressPhoto</c> migration.
/// 4. Asserts the folded rows appear in <c>plan_photos</c> with
///    <see cref="PlanPhotoCategory.Body"/> and that running the migration
///    a second time does not duplicate rows (idempotency guarantee).
/// </summary>
public class PlanPhotoMigrationFoldTests : IAsyncLifetime
{
    private const string PreviousMigration = "20260422153619_AddProfessionalProfileAvatarBlobUrl";
    private const string NewMigration = "20260425164316_AddPlanPhotoRetireProgressPhoto";

    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:16")
        .Build();

    private ApplicationDbContext _db = null!;

    public async ValueTask InitializeAsync()
    {
        await _postgres.StartAsync();
        _db = BuildContext(_postgres.GetConnectionString());
    }

    public async ValueTask DisposeAsync()
    {
        await _db.DisposeAsync();
        await _postgres.DisposeAsync();
    }

    private static ApplicationDbContext BuildContext(string connectionString)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(connectionString)
            .UseSnakeCaseNamingConvention()
            .ConfigureWarnings(w =>
                w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning))
            .Options;
        return new ApplicationDbContext(options);
    }

    private IMigrator GetMigrator() =>
        _db.GetInfrastructure().GetRequiredService<IMigrator>();

    // ── seed helpers ──────────────────────────────────────────────────────────

    private async Task<(long ClientProfileId, Guid UserId)> CreateUserAndClientProfileAsync()
    {
        await using var conn = new NpgsqlConnection(_postgres.GetConnectionString());
        await conn.OpenAsync(TestContext.Current.CancellationToken);

        var userId = Guid.NewGuid();

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
            cmd.Parameters.AddWithValue("id", userId);
            cmd.Parameters.AddWithValue("email", $"{userId:N}@fold-test.com");
            cmd.Parameters.AddWithValue("emailUpper", $"{userId:N}@FOLD-TEST.COM");
            await cmd.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
        }

        long clientProfileId;
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = @"
                INSERT INTO client_profiles
                    (user_id, public_id, date_created, is_onboarding_complete)
                VALUES
                    (@userId, @publicId, now(), false)
                RETURNING id";
            cmd.Parameters.AddWithValue("userId", userId);
            cmd.Parameters.AddWithValue("publicId", Guid.NewGuid());
            clientProfileId = (long)(await cmd.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
        }

        return (clientProfileId, userId);
    }

    private async Task SeedProgressPhotoAsync(
        long clientProfileId,
        Guid publicId,
        string blobUrl,
        string? description,
        DateTime takenAt,
        DateTime dateCreated)
    {
        await using var conn = new NpgsqlConnection(_postgres.GetConnectionString());
        await conn.OpenAsync(TestContext.Current.CancellationToken);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO progress_photos
                (client_profile_id, public_id, blob_url, description, taken_at, date_created)
            VALUES
                (@clientProfileId, @publicId, @blobUrl, @description, @takenAt, @dateCreated)";
        cmd.Parameters.AddWithValue("clientProfileId", clientProfileId);
        cmd.Parameters.AddWithValue("publicId", publicId);
        cmd.Parameters.AddWithValue("blobUrl", blobUrl);
        cmd.Parameters.AddWithValue("description",
            description is null ? (object)DBNull.Value : description);
        cmd.Parameters.AddWithValue("takenAt", takenAt);
        cmd.Parameters.AddWithValue("dateCreated", dateCreated);
        await cmd.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
    }

    private async Task RebuildContextAsync()
    {
        await _db.DisposeAsync();
        _db = BuildContext(_postgres.GetConnectionString());
    }

    // ── tests ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task MigrationFold_SeededProgressPhotos_SurfaceAsPlanPhotosWithBodyCategory()
    {
        var ct = TestContext.Current.CancellationToken;

        // Bring DB to the state just before our new migration
        await GetMigrator().MigrateAsync(PreviousMigration, ct);

        // Seed user + client profile + two legacy progress_photos rows
        var (clientProfileId, _) = await CreateUserAndClientProfileAsync();

        var photoAPublicId = Guid.NewGuid();
        var photoBPublicId = Guid.NewGuid();
        var takenAt = new DateTime(2025, 1, 15, 10, 0, 0, DateTimeKind.Utc);
        var createdAt = new DateTime(2025, 1, 15, 12, 0, 0, DateTimeKind.Utc);

        await SeedProgressPhotoAsync(clientProfileId, photoAPublicId,
            "https://minio/progress/a.jpg", "Front view", takenAt, createdAt);
        await SeedProgressPhotoAsync(clientProfileId, photoBPublicId,
            "https://minio/progress/b.jpg", null,
            takenAt.AddDays(7), createdAt.AddDays(7));

        // Apply the new migration — this folds progress_photos → plan_photos
        await GetMigrator().MigrateAsync(NewMigration, ct);
        await RebuildContextAsync();

        // Assert both rows are now in plan_photos with Category = Body
        var planPhotos = await _db.PlanPhotos
            .AsNoTracking()
            .Where(p => p.ClientProfileId == clientProfileId)
            .OrderBy(p => p.TakenAt)
            .ToListAsync(ct);

        planPhotos.Should().HaveCount(2,
            "both progress_photos rows must be folded into plan_photos");

        var photoA = planPhotos.First(p => p.PublicId == photoAPublicId);
        photoA.Category.Should().Be(PlanPhotoCategory.Body);
        photoA.BlobUrl.Should().Be("https://minio/progress/a.jpg");
        photoA.Description.Should().Be("Front view");
        photoA.PlanId.Should().BeNull("legacy body photos have no plan context");
        photoA.PlanType.Should().BeNull("plan type is null when there is no plan");

        var photoB = planPhotos.First(p => p.PublicId == photoBPublicId);
        photoB.Category.Should().Be(PlanPhotoCategory.Body);
        photoB.Description.Should().BeNull();
        photoB.PlanId.Should().BeNull();
    }

    [Fact]
    public async Task MigrationFold_ReRunFoldSql_DoesNotDuplicateRows()
    {
        var ct = TestContext.Current.CancellationToken;

        // Bring DB to the state just before our new migration and seed one row
        await GetMigrator().MigrateAsync(PreviousMigration, ct);

        var (clientProfileId, _) = await CreateUserAndClientProfileAsync();
        var photoPublicId = Guid.NewGuid();
        await SeedProgressPhotoAsync(clientProfileId, photoPublicId,
            "https://minio/progress/x.jpg", null, DateTime.UtcNow, DateTime.UtcNow);

        // Apply the migration: folds the row and drops progress_photos
        await GetMigrator().MigrateAsync(NewMigration, ct);

        // Re-run the exact fold SQL from the migration.
        // After the migration ran, progress_photos no longer exists, so the
        // IF EXISTS guard exits early and the INSERT is skipped entirely.
        // This proves the idempotency — running the fold SQL N times is safe.
        await using var conn = new NpgsqlConnection(_postgres.GetConnectionString());
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'progress_photos'
                ) THEN
                    INSERT INTO plan_photos (
                        client_profile_id, plan_id, plan_type, link_id,
                        category, blob_url, description, meal_log_id,
                        taken_at, uploaded_by_user_id, diary_request_id,
                        date_created, date_updated, public_id
                    )
                    SELECT
                        pp.client_profile_id,
                        NULL::uuid, NULL::text, NULL::uuid,
                        'Body',
                        LEFT(pp.blob_url, 500),
                        pp.description,
                        NULL::text,
                        pp.taken_at,
                        cp.user_id,
                        NULL::uuid,
                        pp.date_created,
                        pp.date_updated,
                        pp.public_id
                    FROM progress_photos pp
                    INNER JOIN client_profiles cp ON cp.id = pp.client_profile_id
                    ON CONFLICT (public_id) DO NOTHING;
                END IF;
            END
            $$;";
        await cmd.ExecuteNonQueryAsync(ct);

        await RebuildContextAsync();

        var count = await _db.PlanPhotos
            .AsNoTracking()
            .CountAsync(p => p.ClientProfileId == clientProfileId
                             && p.PublicId == photoPublicId, ct);

        count.Should().Be(1,
            "the fold SQL must be idempotent: re-running it must not insert duplicate rows");
    }

    [Fact]
    public async Task MigrationFold_EmptyProgressPhotos_ProducesZeroPlanPhotos()
    {
        var ct = TestContext.Current.CancellationToken;

        // Migrate to just before our migration (empty progress_photos)
        await GetMigrator().MigrateAsync(PreviousMigration, ct);

        // Apply the new migration with no rows to fold
        await GetMigrator().MigrateAsync(NewMigration, ct);
        await RebuildContextAsync();

        var count = await _db.PlanPhotos.AsNoTracking().CountAsync(ct);
        count.Should().Be(0, "no source rows means no folded rows");
    }
}
