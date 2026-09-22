using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Messaging.GetClientMessageStats;

/// <summary>
/// Returns weekly coach vs. client message counts for a trainer/nutritionist's conversation with
/// one client, over the last <c>weeks</c> ISO weeks (Monday-start, oldest first, current partial
/// week included).
/// </summary>
/// <param name="db">Database context.</param>
/// <param name="linkAuthorizationService">Resolves the caller's active link to the client.</param>
/// <param name="timeProvider">Clock abstraction — lets tests pin "now" deterministically.</param>
public class GetClientMessageStatsEndpoint(
    IApplicationDbContext db, IClientLinkAuthorizationService linkAuthorizationService, TimeProvider timeProvider)
    : Endpoint<GetClientMessageStatsRequest, List<WeeklyMessageStatsDto>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/trainer/clients/{ClientId}/message-stats");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Get a client's weekly message stats";
            s.Description =
                "Returns coach vs. client message counts per ISO week (Monday-start, caller's " +
                "time zone) for the last `weeks` weeks, oldest first, zero-filled for weeks with " +
                "no messages. Requires an active trainer-client relationship.";
            s.Responses[StatusCodes.Status200OK] = "Exactly `weeks` rows, oldest first";
            s.Responses[StatusCodes.Status404NotFound] = "Client not found or no active relationship";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetClientMessageStatsRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);

        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.PublicId == req.ClientId, ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Deliberately NOT checking CanView* — a chat message is not plan data, matching
        // BroadcastMessageEndpoint's own rule that messaging ignores plan-domain capability flags.
        var capabilities = await linkAuthorizationService.GetCapabilitiesByClientPublicIdAsync(
            trainerId, req.ClientId, ct);

        if (capabilities is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var trainerTimeZoneId = await db.Users
            .AsNoTracking()
            .Where(u => u.Id == trainerId)
            .Select(u => u.TimeZone)
            .FirstAsync(ct);

        var timeZone = ResolveTimeZone(trainerTimeZoneId);
        var nowUtc = timeProvider.GetUtcNow().UtcDateTime;
        var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(nowUtc, DateTimeKind.Utc), timeZone);

        var currentWeekMonday = IsoWeekMonday(DateOnly.FromDateTime(nowLocal));
        var earliestMonday = currentWeekMonday.AddDays(-7 * (req.Weeks - 1));

        var weekBuckets = BuildEmptyBuckets(earliestMonday, req.Weeks);

        // Conversation may not exist yet — that is not a 404, it just means every bucket stays
        // zero. Archived/former conversations are still counted: archiving is a view state, not a
        // deletion, so no ArchivedBy*/IsFormer filter is applied here.
        var conversation = await db.Conversations
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.ProfessionalUserId == trainerId && c.ClientUserId == clientProfile.UserId, ct);

        if (conversation is not null)
        {
            var windowStartUtc = LocalMidnightToUtc(earliestMonday, timeZone);
            var windowEndUtc = LocalMidnightToUtc(currentWeekMonday.AddDays(7), timeZone);

            // Query the UTC window, then bucket in memory in the caller's time zone — a SQL
            // date_trunc would bucket in UTC and shift week boundaries for any non-UTC caller.
            var messages = await db.ChatMessages
                .AsNoTracking()
                .Where(m => m.ConversationId == conversation.Id &&
                            m.DateCreated >= windowStartUtc && m.DateCreated < windowEndUtc)
                .Select(m => new { m.SenderUserId, m.DateCreated })
                .ToListAsync(ct);

            foreach (var message in messages)
            {
                var localDate = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(
                    DateTime.SpecifyKind(message.DateCreated, DateTimeKind.Utc), timeZone));
                var weekStart = IsoWeekMonday(localDate);

                if (!weekBuckets.TryGetValue(weekStart, out var bucket))
                {
                    continue;
                }

                if (message.SenderUserId == trainerId)
                {
                    bucket.CoachMessages++;
                }
                else
                {
                    bucket.ClientMessages++;
                }
            }
        }

        var response = weekBuckets
            .OrderBy(kvp => kvp.Key)
            .Select(kvp => new WeeklyMessageStatsDto
            {
                WeekStart = kvp.Key,
                CoachMessages = kvp.Value.CoachMessages,
                ClientMessages = kvp.Value.ClientMessages
            })
            .ToList();

        await Send.OkAsync(response, ct);
    }

    /// <summary>
    /// Returns the Monday of the ISO week containing <paramref name="date"/>.
    /// </summary>
    private static DateOnly IsoWeekMonday(DateOnly date)
    {
        var dayIndex = date.DayOfWeek == DayOfWeek.Sunday ? 7 : (int)date.DayOfWeek;
        return date.AddDays(-(dayIndex - 1));
    }

    /// <summary>
    /// Converts local midnight on <paramref name="localDate"/> to UTC in <paramref name="timeZone"/>.
    /// </summary>
    private static DateTime LocalMidnightToUtc(DateOnly localDate, TimeZoneInfo timeZone) =>
        TimeZoneInfo.ConvertTimeToUtc(
            DateTime.SpecifyKind(localDate.ToDateTime(TimeOnly.MinValue), DateTimeKind.Unspecified),
            timeZone);

    private static Dictionary<DateOnly, MutableWeekCounts> BuildEmptyBuckets(DateOnly earliestMonday, int weeks)
    {
        var buckets = new Dictionary<DateOnly, MutableWeekCounts>();

        for (var weekIndex = 0; weekIndex < weeks; weekIndex++)
        {
            buckets[earliestMonday.AddDays(weekIndex * 7)] = new MutableWeekCounts();
        }

        return buckets;
    }

    /// <summary>
    /// Resolves an IANA time zone id, falling back to UTC for an unknown id — same fallback
    /// <see cref="Infrastructure.Services.WeeklyCheckInScheduler"/> uses for the same field.
    /// </summary>
    private TimeZoneInfo ResolveTimeZone(string ianaId)
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(ianaId);
        }
        catch (TimeZoneNotFoundException)
        {
            Logger.LogWarning(
                "GetClientMessageStatsEndpoint: unknown time zone '{IanaId}'; falling back to UTC.", ianaId);
            return TimeZoneInfo.Utc;
        }
        catch (InvalidTimeZoneException)
        {
            Logger.LogWarning(
                "GetClientMessageStatsEndpoint: invalid time zone data for '{IanaId}'; falling back to UTC.", ianaId);
            return TimeZoneInfo.Utc;
        }
    }

    private sealed class MutableWeekCounts
    {
        public int CoachMessages { get; set; }
        public int ClientMessages { get; set; }
    }
}
