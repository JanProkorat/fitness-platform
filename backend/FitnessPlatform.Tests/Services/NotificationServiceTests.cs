using FluentAssertions;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Testcontainers.PostgreSql;

namespace FitnessPlatform.Tests.Services;

/// <summary>
/// Testcontainers integration tests for <see cref="NotificationService"/> — verifies the
/// #788 fix: notifications are localized to the RECIPIENT's stored
/// <see cref="ApplicationUser.Language"/> at write time (title/body persisted already
/// translated), independent of whichever user/process triggered the notification, and
/// fall back to English when the recipient has no stored language.
/// </summary>
public class NotificationServiceTests : IAsyncLifetime
{
    // Wide timeout to tolerate Docker contention on the dev machine (see #336).
    private static readonly TimeSpan StartupTimeout = TimeSpan.FromSeconds(180);

    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:16").Build();

    private ApplicationDbContext _db = null!;
    private FakePushNotificationService _push = null!;

    // ── IAsyncLifetime ────────────────────────────────────────────────────────

    public async ValueTask InitializeAsync()
    {
        using var cts = new CancellationTokenSource(StartupTimeout);
        await _postgres.StartAsync(cts.Token);

        _db = BuildDbContext(_postgres.GetConnectionString());
        await _db.Database.MigrateAsync(TestContext.Current.CancellationToken);
    }

    public async ValueTask DisposeAsync()
    {
        await _db.DisposeAsync();
        await _postgres.DisposeAsync();
    }

    // ── helpers ───────────────────────────────────────────────────────────────

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
    /// Inserts a minimal user row via raw SQL with the given stored language
    /// (null supported, to exercise the fallback path).
    /// </summary>
    private async Task<Guid> SeedUserAsync(string? language)
    {
        var ct = TestContext.Current.CancellationToken;
        var userId = Guid.NewGuid();

        await using var conn = new NpgsqlConnection(_postgres.GetConnectionString());
        await conn.OpenAsync(ct);

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO users (
                id, user_name, normalized_user_name,
                email, normalized_email, email_confirmed,
                password_hash, security_stamp, concurrency_stamp,
                phone_number_confirmed, two_factor_enabled,
                lockout_enabled, access_failed_count,
                first_name, last_name, is_active, date_created,
                gdpr_consent, verification_emails_sent, time_zone, language
            ) VALUES (
                @id, @email, @emailUpper,
                @email, @emailUpper, true,
                '', gen_random_uuid()::text, gen_random_uuid()::text,
                false, false,
                true, 0,
                'Test', 'User', true, now(),
                true, 0, 'Europe/Prague', @language
            )";
        cmd.Parameters.AddWithValue("id", userId);
        cmd.Parameters.AddWithValue("email", $"{userId:N}@notification-service-test.com");
        cmd.Parameters.AddWithValue("emailUpper", $"{userId:N}@NOTIFICATION-SERVICE-TEST.COM");
        cmd.Parameters.AddWithValue("language", language is null ? (object)DBNull.Value : language);
        await cmd.ExecuteNonQueryAsync(ct);

        return userId;
    }

    private NotificationService BuildSut()
    {
        // Rebuild DbContext for a clean tracked-entity cache each call.
        _db.Dispose();
        _db = BuildDbContext(_postgres.GetConnectionString());
        _push = new FakePushNotificationService();

        return new NotificationService(_db, _push);
    }

    // ── tests ─────────────────────────────────────────────────────────────────

    /// <summary>
    /// A recipient with a stored "cs" language gets a Czech title/body persisted, and the
    /// SAME Czech text is forwarded to the push service (#788 — the OS push banner must
    /// already be in the right language at send time).
    /// </summary>
    [Fact]
    public async Task CreateAsync_RecipientLanguageCs_PersistsAndPushesCzechText()
    {
        var ct = TestContext.Current.CancellationToken;
        var recipientId = await SeedUserAsync("cs");

        var sut = BuildSut();
        await sut.CreateAsync(
            recipientId,
            NotificationType.ClientRequestAccepted,
            new Dictionary<string, string> { ["clientName"] = "Petra Nováková" },
            ct: ct);

        var stored = await _db.Notifications
            .AsNoTracking()
            .SingleAsync(n => n.RecipientUserId == recipientId, ct);

        stored.Title.Should().Be("Pozvánka přijata");
        stored.Body.Should().Be("Petra Nováková přijal(a) vaši pozvánku.");

        _push.Calls.Should().ContainSingle(c =>
            c.UserId == recipientId &&
            c.Title == "Pozvánka přijata" &&
            c.Body == "Petra Nováková přijal(a) vaši pozvánku.");
    }

    /// <summary>
    /// A recipient with a stored "de" language gets German text — proves the fix is not
    /// English-vs-Czech only but genuinely per-recipient-language.
    /// </summary>
    [Fact]
    public async Task CreateAsync_RecipientLanguageDe_PersistsGermanText()
    {
        var ct = TestContext.Current.CancellationToken;
        var recipientId = await SeedUserAsync("de");

        var sut = BuildSut();
        await sut.CreateAsync(
            recipientId,
            NotificationType.ClientRequestAccepted,
            new Dictionary<string, string> { ["clientName"] = "Petra" },
            ct: ct);

        var stored = await _db.Notifications
            .AsNoTracking()
            .SingleAsync(n => n.RecipientUserId == recipientId, ct);

        stored.Title.Should().Be("Einladung angenommen");
        stored.Body.Should().Be("Petra hat Ihre Einladung angenommen.");
    }

    /// <summary>
    /// A recipient with NO stored language (null — e.g. never made an authenticated
    /// request since the #788 migration landed) falls back to English, per the
    /// orchestrator-approved default.
    /// </summary>
    [Fact]
    public async Task CreateAsync_RecipientLanguageNull_FallsBackToEnglish()
    {
        var ct = TestContext.Current.CancellationToken;
        var recipientId = await SeedUserAsync(language: null);

        var sut = BuildSut();
        await sut.CreateAsync(
            recipientId,
            NotificationType.ClientRequestAccepted,
            new Dictionary<string, string> { ["clientName"] = "Petra" },
            ct: ct);

        var stored = await _db.Notifications
            .AsNoTracking()
            .SingleAsync(n => n.RecipientUserId == recipientId, ct);

        stored.Title.Should().Be("Invitation accepted");
        stored.Body.Should().Be("Petra accepted your invitation.");
    }

    /// <summary>
    /// A NotificationType with multiple wordings (PlanPublished) resolves the correct
    /// variant's copy, not the default — proves the variant discriminator works and that
    /// distinct scenarios sharing one NotificationType don't collide.
    /// </summary>
    [Fact]
    public async Task CreateAsync_WithVariant_ResolvesVariantSpecificCopy()
    {
        var ct = TestContext.Current.CancellationToken;
        var recipientId = await SeedUserAsync("en");

        var sut = BuildSut();
        await sut.CreateAsync(
            recipientId,
            NotificationType.PlanPublished,
            new Dictionary<string, string> { ["weekNumber"] = "3" },
            variant: NotificationTemplates.PlanPublishedNutritionPublished,
            ct: ct);

        var stored = await _db.Notifications
            .AsNoTracking()
            .SingleAsync(n => n.RecipientUserId == recipientId, ct);

        stored.Title.Should().Be("Nutrition plan updated");
        stored.Body.Should().Be("Week 3 of your nutrition plan has been published.");
    }

    /// <summary>
    /// The interpolation parameters are persisted verbatim as JSON in
    /// <see cref="Notification.Data"/> so extra keys (e.g. a deep-link id not used by the
    /// current templates) still ride along.
    /// </summary>
    [Fact]
    public async Task CreateAsync_PersistsParametersAsJsonData()
    {
        var ct = TestContext.Current.CancellationToken;
        var recipientId = await SeedUserAsync("en");
        var inviteId = Guid.NewGuid();

        var sut = BuildSut();
        await sut.CreateAsync(
            recipientId,
            NotificationType.InvitationReceived,
            new Dictionary<string, string>
            {
                ["trainerName"] = "Coach Jana",
                ["inviteId"] = inviteId.ToString(),
            },
            ct: ct);

        var stored = await _db.Notifications
            .AsNoTracking()
            .SingleAsync(n => n.RecipientUserId == recipientId, ct);

        stored.Data.Should().NotBeNull();
        stored.Data.Should().Contain("Coach Jana");
        stored.Data.Should().Contain(inviteId.ToString());
    }
}
