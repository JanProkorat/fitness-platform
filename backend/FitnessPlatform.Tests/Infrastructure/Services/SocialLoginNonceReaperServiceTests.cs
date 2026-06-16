using FluentAssertions;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Infrastructure.Services;

/// <summary>
/// Integration tests for <see cref="SocialLoginNonceReaperService"/> using a virtual clock.
/// Uses Testcontainers PostgreSQL (Docker required).
/// </summary>
[Collection(TestCollection.Name)]
public class SocialLoginNonceReaperServiceTests(FitnessApiFactory factory)
{
    // ── Helpers ───────────────────────────────────────────────────────────────

    private static DateTime Utc(int daysOffset = 0, int hoursOffset = 0) =>
        DateTime.UtcNow.AddDays(daysOffset).AddHours(hoursOffset);

    /// <summary>
    /// Inserts a <see cref="SocialLoginNonce"/> row directly and returns its id.
    /// </summary>
    private async Task<int> InsertNonceAsync(
        DateTime expiresAt,
        DateTime? consumedAt = null)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var nonce = new SocialLoginNonce
        {
            Nonce = Guid.NewGuid().ToString("N"), // 32-char hex unique value (within MaxLength(64))
            ExpiresAt = expiresAt,
            ConsumedAt = consumedAt,
            CreatedAt = DateTime.UtcNow
        };
        db.SocialLoginNonces.Add(nonce);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        return nonce.Id;
    }

    private async Task<SocialLoginNonce?> LoadNonceAsync(int id)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await db.SocialLoginNonces
            .AsNoTracking()
            .FirstOrDefaultAsync(n => n.Id == id, TestContext.Current.CancellationToken);
    }

    private SocialLoginNonceReaperService GetReaper() =>
        factory.Services.GetRequiredService<SocialLoginNonceReaperService>();

    // ── Tests ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Sweep_DeletesExpiredUnconsumedNonce()
    {
        // Arrange: expired nonce (ExpiresAt is 2 hours in the past, never consumed).
        var id = await InsertNonceAsync(expiresAt: Utc(hoursOffset: -2));
        var reaper = GetReaper();

        // Act: sweep at "now".
        var now = DateTime.UtcNow;
        await reaper.SweepAsync(now, TestContext.Current.CancellationToken);

        // Assert: row is gone.
        var row = await LoadNonceAsync(id);
        row.Should().BeNull("expired unconsumed nonces must be reaped");
    }

    [Fact]
    public async Task Sweep_DeletesConsumedNoncePastGraceWindow()
    {
        // Arrange: consumed nonce whose ConsumedAt is 3 hours ago
        // (default grace = 1 h → cutoff = now - 1 h → 3 h ago is past the cutoff).
        var consumedAt = Utc(hoursOffset: -3);
        // ExpiresAt in the future so it wouldn't be reaped by the expiry arm alone.
        var id = await InsertNonceAsync(
            expiresAt: Utc(hoursOffset: +1),
            consumedAt: consumedAt);

        var reaper = GetReaper();
        var now = DateTime.UtcNow;
        await reaper.SweepAsync(now, TestContext.Current.CancellationToken);

        var row = await LoadNonceAsync(id);
        row.Should().BeNull(
            "consumed nonces past the grace window must be reaped even if not yet technically expired");
    }

    [Fact]
    public async Task Sweep_KeepsValidUnconsumedNonce()
    {
        // Arrange: nonce that expires 10 minutes in the future, never consumed.
        var id = await InsertNonceAsync(expiresAt: Utc(hoursOffset: 0).AddMinutes(10));
        var reaper = GetReaper();

        var now = DateTime.UtcNow;
        await reaper.SweepAsync(now, TestContext.Current.CancellationToken);

        var row = await LoadNonceAsync(id);
        row.Should().NotBeNull("still-valid unconsumed nonces must not be deleted");
    }

    [Fact]
    public async Task Sweep_KeepsConsumedNonceWithinGraceWindow()
    {
        // Arrange: nonce consumed 10 minutes ago — well within the default 1-hour grace.
        // ExpiresAt also in the future to rule out the expiry arm.
        var consumedAt = DateTime.UtcNow.AddMinutes(-10);
        var id = await InsertNonceAsync(
            expiresAt: Utc(hoursOffset: +1),
            consumedAt: consumedAt);

        var reaper = GetReaper();
        var now = DateTime.UtcNow;
        await reaper.SweepAsync(now, TestContext.Current.CancellationToken);

        var row = await LoadNonceAsync(id);
        row.Should().NotBeNull(
            "consumed nonces within the grace window must be retained for audit purposes");
    }

    [Fact]
    public async Task Sweep_IsIdempotent_RunningTwiceDoesNotAffectKeptRows()
    {
        // Arrange: one expired nonce (to be reaped), one valid nonce (to be kept).
        var expiredId = await InsertNonceAsync(expiresAt: Utc(hoursOffset: -1));
        var validId = await InsertNonceAsync(expiresAt: Utc(hoursOffset: +1));

        var reaper = GetReaper();
        var now = DateTime.UtcNow;

        // Act: sweep twice.
        await reaper.SweepAsync(now, TestContext.Current.CancellationToken);
        await reaper.SweepAsync(now, TestContext.Current.CancellationToken);

        // Assert: expired row gone, valid row still present.
        var expiredRow = await LoadNonceAsync(expiredId);
        expiredRow.Should().BeNull("expired row must be reaped on first sweep");

        var validRow = await LoadNonceAsync(validId);
        validRow.Should().NotBeNull(
            "second sweep must leave valid rows intact (idempotent)");
    }
}
