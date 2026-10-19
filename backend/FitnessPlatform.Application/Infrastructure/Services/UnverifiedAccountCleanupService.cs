using System.Globalization;
using System.Linq.Expressions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Deletes accounts whose email was never verified within the retention window, together with everything
/// they own (links, chats, photos, and for coaches their plans, templates and notes). Admins are never
/// touched. Each user is removed in its own scope so one failure leaves no dirty state.
///
/// <para>Runs once a week, never at startup. Keys: <c>Auth:UnverifiedAccountRetentionDays</c> (7),
/// <c>Auth:UnverifiedAccountCleanupDay</c> (Sunday), <c>Auth:UnverifiedAccountCleanupTime</c> (01:00) and
/// <c>Auth:UnverifiedAccountCleanupTimeZone</c> (Europe/Prague).</para>
/// </summary>
/// <param name="scopeFactory">Creates one scope per candidate user.</param>
/// <param name="timeProvider">Clock.</param>
/// <param name="configuration">Application configuration.</param>
/// <param name="logger">Logger; ids and counts only, never email addresses.</param>
public class UnverifiedAccountCleanupService(
    IServiceScopeFactory scopeFactory,
    TimeProvider timeProvider,
    IConfiguration configuration,
    ILogger<UnverifiedAccountCleanupService> logger) : BackgroundService
{
    internal const int DefaultRetentionDays = 7;

    internal const DayOfWeek DefaultCleanupDay = DayOfWeek.Sunday;

    internal const string DefaultCleanupTime = "01:00";

    internal const string DefaultCleanupTimeZone = "Europe/Prague";

    /// <inheritdoc />
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var (day, time, zone) = ReadSchedule();

        while (!stoppingToken.IsCancellationRequested)
        {
            var now = timeProvider.GetUtcNow();
            var nextRun = NextRunUtc(now, day, time, zone);

            try
            {
                await Task.Delay(nextRun - now, timeProvider, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                return;
            }

            try
            {
                await SweepAsync(timeProvider.GetUtcNow().UtcDateTime, stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "UnverifiedAccountCleanupService: unhandled error during sweep.");
            }
        }
    }

    /// <summary>
    /// Returns the first UTC instant strictly after <paramref name="nowUtc"/> at which the local clock in
    /// <paramref name="zone"/> shows <paramref name="time"/> on <paramref name="day"/>. A time skipped by a
    /// DST gap moves one hour forward; an ambiguous one takes the first occurrence.
    /// </summary>
    /// <param name="nowUtc">Current instant.</param>
    /// <param name="day">Local day of the week.</param>
    /// <param name="time">Local time of day.</param>
    /// <param name="zone">Time zone the schedule is expressed in.</param>
    /// <returns>Next run, in UTC.</returns>
    internal static DateTimeOffset NextRunUtc(DateTimeOffset nowUtc, DayOfWeek day, TimeOnly time, TimeZoneInfo zone)
    {
        var localNow = TimeZoneInfo.ConvertTime(nowUtc, zone);
        var daysAhead = ((int)day - (int)localNow.DayOfWeek + 7) % 7;
        var date = DateOnly.FromDateTime(localNow.DateTime).AddDays(daysAhead);

        var candidate = ToUtc(date, time, zone);

        return candidate > nowUtc ? candidate : ToUtc(date.AddDays(7), time, zone);
    }

    /// <summary>Runs one sweep treating <paramref name="now"/> as the current UTC time.</summary>
    /// <param name="now">Current UTC time.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Number of accounts deleted.</returns>
    internal async Task<int> SweepAsync(DateTime now, CancellationToken ct)
    {
        var cutoff = now - TimeSpan.FromDays(
            configuration.GetValue("Auth:UnverifiedAccountRetentionDays", DefaultRetentionDays));

        List<Guid> candidateIds;

        using (var scope = scopeFactory.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();

            candidateIds = await db.Users
                .AsNoTracking()
                .Where(u => !u.EmailConfirmed && u.DateCreated < cutoff)
                .Where(u => !db.UserRoles.Any(ur =>
                    ur.UserId == u.Id
                    && db.Roles.Any(r => r.Id == ur.RoleId && r.Name == AppRoles.Admin)))
                .Select(u => u.Id)
                .ToListAsync(ct);
        }

        var deleted = 0;
        var failed = 0;

        foreach (var userId in candidateIds)
        {
            try
            {
                if (await DeleteUserAsync(userId, ct))
                {
                    deleted++;
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                failed++;
                logger.LogError(ex, "UnverifiedAccountCleanupService: failed to delete user {UserId}.", userId);
            }
        }

        if (deleted > 0 || failed > 0)
        {
            logger.LogInformation(
                "UnverifiedAccountCleanupService: deleted {Deleted} unverified account(s), {Failed} failed.",
                deleted, failed);
        }

        return deleted;
    }

    private static DateTimeOffset ToUtc(DateOnly date, TimeOnly time, TimeZoneInfo zone)
    {
        var local = date.ToDateTime(time, DateTimeKind.Unspecified);

        if (zone.IsInvalidTime(local))
        {
            local = local.AddHours(1);
        }

        var offset = zone.IsAmbiguousTime(local)
            ? zone.GetAmbiguousTimeOffsets(local).Max()
            : zone.GetUtcOffset(local);

        return new DateTimeOffset(local, offset).ToUniversalTime();
    }

    private (DayOfWeek Day, TimeOnly Time, TimeZoneInfo Zone) ReadSchedule()
    {
        var dayText = configuration.GetValue("Auth:UnverifiedAccountCleanupDay", DefaultCleanupDay.ToString());
        var timeText = configuration.GetValue("Auth:UnverifiedAccountCleanupTime", DefaultCleanupTime);
        var zoneText = configuration.GetValue("Auth:UnverifiedAccountCleanupTimeZone", DefaultCleanupTimeZone);

        if (!Enum.TryParse<DayOfWeek>(dayText, ignoreCase: true, out var day) || !Enum.IsDefined(day))
        {
            logger.LogWarning(
                "UnverifiedAccountCleanupService: invalid Auth:UnverifiedAccountCleanupDay '{Value}', using {Default}.",
                dayText, DefaultCleanupDay);
            day = DefaultCleanupDay;
        }

        if (!TimeOnly.TryParse(timeText, CultureInfo.InvariantCulture, out var time))
        {
            logger.LogWarning(
                "UnverifiedAccountCleanupService: invalid Auth:UnverifiedAccountCleanupTime '{Value}', using {Default}.",
                timeText, DefaultCleanupTime);
            time = TimeOnly.Parse(DefaultCleanupTime, CultureInfo.InvariantCulture);
        }

        if (!TryFindZone(zoneText, out var zone))
        {
            logger.LogWarning(
                "UnverifiedAccountCleanupService: invalid Auth:UnverifiedAccountCleanupTimeZone '{Value}', using {Default}.",
                zoneText, DefaultCleanupTimeZone);
            zone = TimeZoneInfo.FindSystemTimeZoneById(DefaultCleanupTimeZone);
        }

        return (day, time, zone);
    }

    private static bool TryFindZone(string? id, out TimeZoneInfo zone)
    {
        zone = TimeZoneInfo.Utc;

        if (string.IsNullOrWhiteSpace(id))
        {
            return false;
        }

        try
        {
            zone = TimeZoneInfo.FindSystemTimeZoneById(id);

            return true;
        }
        catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            return false;
        }
    }

    private async Task<bool> DeleteUserAsync(Guid userId, CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var blobStorage = scope.ServiceProvider.GetRequiredService<IBlobStorageService>();

        var user = await userManager.FindByIdAsync(userId.ToString());

        // Verified in the meantime (or gone): nothing to do.
        if (user is null || user.EmailConfirmed)
        {
            return false;
        }

        var blobUrls = await CollectBlobUrlsAsync(db, mongo, user, ct);

        await DeleteMongoDocumentsAsync(mongo, userId, ct);

        await using (var transaction = await db.Database.BeginTransactionAsync(ct))
        {
            await DeleteRestrictedRowsAsync(db, userId, ct);

            var result = await userManager.DeleteAsync(user);

            if (!result.Succeeded)
            {
                throw new InvalidOperationException(
                    $"Identity refused to delete user {userId}: {string.Join("; ", result.Errors.Select(e => e.Code))}");
            }

            await transaction.CommitAsync(ct);
        }

        await DeleteBlobsAsync(blobStorage, blobUrls, userId, ct);

        return true;
    }

    private static async Task<List<string>> CollectBlobUrlsAsync(
        ApplicationDbContext db, IMongoContext mongo, ApplicationUser user, CancellationToken ct)
    {
        var userId = user.Id;
        var urls = new List<string>();

        if (!string.IsNullOrWhiteSpace(user.AvatarBlobUrl))
        {
            urls.Add(user.AvatarBlobUrl);
        }

        urls.AddRange(await db.ProfessionalProfiles
            .AsNoTracking()
            .Where(p => p.UserId == userId && p.AvatarBlobUrl != null)
            .Select(p => p.AvatarBlobUrl!)
            .ToListAsync(ct));

        urls.AddRange(await db.PlanPhotos
            .AsNoTracking()
            .Where(p => p.UploadedByUserId == userId || p.ClientProfile.UserId == userId)
            .Select(p => p.BlobUrl)
            .ToListAsync(ct));

        urls.AddRange(await db.ChatMessages
            .AsNoTracking()
            .Where(m => m.ImageBlobUrl != null
                        && (m.Conversation.ClientUserId == userId || m.Conversation.ProfessionalUserId == userId))
            .Select(m => m.ImageBlobUrl!)
            .ToListAsync(ct));

        var mealPhotos = await mongo.MealLogs
            .Find(Builders<MealLog>.Filter.Eq(x => x.ClientId, userId))
            .Project(x => x.Photos)
            .ToListAsync(ct);
        urls.AddRange(mealPhotos.SelectMany(photos => photos).Select(photo => photo.BlobUrl));

        var dayPhotos = await mongo.DayLogs
            .Find(Builders<DayLog>.Filter.Eq(x => x.ClientId, userId))
            .Project(x => x.Photos)
            .ToListAsync(ct);
        urls.AddRange(dayPhotos.SelectMany(photos => photos).Select(photo => photo.BlobUrl));

        var sessionPhotos = await mongo.SessionLogs
            .Find(Builders<SessionLog>.Filter.Eq(x => x.ClientId, userId))
            .Project(x => x.Photos)
            .ToListAsync(ct);
        urls.AddRange(sessionPhotos.SelectMany(photos => photos).Select(photo => photo.BlobUrl));

        return urls;
    }

    private static async Task DeleteMongoDocumentsAsync(IMongoContext mongo, Guid userId, CancellationToken ct)
    {
        // As client.
        await DeleteByAsync(mongo.NutritionPlans, x => x.ClientId, userId, ct);
        await DeleteByAsync(mongo.TrainingPlans, x => x.ClientId, userId, ct);
        await DeleteByAsync(mongo.MealLogs, x => x.ClientId, userId, ct);
        await DeleteByAsync(mongo.DayLogs, x => x.ClientId, userId, ct);
        await DeleteByAsync(mongo.SessionLogs, x => x.ClientId, userId, ct);
        await DeleteByAsync(mongo.SessionExecutions, x => x.ClientId, userId, ct);
        await DeleteByAsync(mongo.SessionLocks, x => x.ClientId, userId, ct);
        await DeleteByAsync(mongo.PersonalRecords, x => x.ClientId, userId, ct);
        await DeleteByAsync(mongo.TrainerNotes, x => x.ClientId, userId, ct);

        // As coach.
        await DeleteByAsync(mongo.NutritionPlans, x => x.NutritionistId, userId, ct);
        await DeleteByAsync(mongo.TrainingPlans, x => x.TrainerId, userId, ct);
        await DeleteByAsync(mongo.SessionLocks, x => x.TrainerId, userId, ct);
        await DeleteByAsync(mongo.TrainerNotes, x => x.TrainerId, userId, ct);
        await DeleteByAsync(mongo.Foods, x => x.NutritionistId, userId, ct);
        await DeleteByAsync(mongo.Recipes, x => x.NutritionistId, userId, ct);
        await DeleteByAsync(mongo.Exercises, x => x.TrainerId, userId, ct);
        await DeleteByAsync(mongo.WorkoutTemplates, x => x.OwnerTrainerId, userId, ct);
        await DeleteByAsync(mongo.SessionTemplates, x => x.OwnerId, userId, ct);
        await DeleteByAsync(mongo.MealTemplates, x => x.OwnerId, userId, ct);
        await DeleteByAsync(mongo.NutritionPlanTemplates, x => x.OwnerId, userId, ct);
        await DeleteByAsync(mongo.TrainingPlanTemplates, x => x.OwnerId, userId, ct);
        await DeleteByAsync(mongo.FoodTags, x => x.OwnerUserId, userId, ct);
        await DeleteByAsync(mongo.FoodTagAssignments, x => x.OwnerUserId, userId, ct);
        await DeleteByAsync(mongo.RecipeTagAssignments, x => x.OwnerUserId, userId, ct);
    }

    private static Task DeleteByAsync<TDocument, TField>(
        IMongoCollection<TDocument> collection,
        Expression<Func<TDocument, TField>> field,
        TField value,
        CancellationToken ct) =>
        collection.DeleteManyAsync(Builders<TDocument>.Filter.Eq(field, value), ct);

    /// <summary>
    /// Removes the rows whose Restrict foreign keys would block the user cascade: diary requests,
    /// plan photos, chat messages and conversations. Set-based, so nothing is loaded into the tracker.
    /// </summary>
    private static async Task DeleteRestrictedRowsAsync(ApplicationDbContext db, Guid userId, CancellationToken ct)
    {
        var linkIds = db.ClientProfessionalLinks
            .Where(l => l.ClientProfile.UserId == userId || l.ProfessionalProfile.UserId == userId)
            .Select(l => l.Id);

        await db.PhotoDiaryRequests
            .Where(r => r.ProfessionalId == userId || (r.LinkId != null && linkIds.Contains(r.LinkId.Value)))
            .ExecuteDeleteAsync(ct);

        await db.PlanPhotos
            .Where(p => p.UploadedByUserId == userId || p.ClientProfile.UserId == userId)
            .ExecuteDeleteAsync(ct);

        await db.ChatMessages
            .Where(m => m.SenderUserId == userId)
            .ExecuteDeleteAsync(ct);

        await db.Conversations
            .Where(c => c.ClientUserId == userId || c.ProfessionalUserId == userId)
            .ExecuteDeleteAsync(ct);
    }

    private async Task DeleteBlobsAsync(
        IBlobStorageService blobStorage, List<string> blobUrls, Guid userId, CancellationToken ct)
    {
        foreach (var blobUrl in blobUrls.Distinct())
        {
            var containerPath = ExtractContainerPath(blobUrl);

            if (containerPath is null)
            {
                continue;
            }

            try
            {
                await blobStorage.DeleteAsync(containerPath, ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex,
                    "UnverifiedAccountCleanupService: failed to delete a blob of removed user {UserId}.", userId);
            }
        }
    }

    /// <summary>
    /// Extracts the container path from a stored blob URL (full URL or already relative).
    /// Mirrors the derivation used when a single plan photo is deleted.
    /// </summary>
    private static string? ExtractContainerPath(string blobUrl)
    {
        if (string.IsNullOrWhiteSpace(blobUrl))
        {
            return null;
        }

        if (!blobUrl.Contains("://", StringComparison.Ordinal))
        {
            return blobUrl;
        }

        try
        {
            var path = new Uri(blobUrl).AbsolutePath.TrimStart('/');
            var firstSlash = path.IndexOf('/', StringComparison.Ordinal);

            return firstSlash >= 0 ? path[(firstSlash + 1)..] : null;
        }
        catch (UriFormatException)
        {
            return null;
        }
    }
}
