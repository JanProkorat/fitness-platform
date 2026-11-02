using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// For the check-in rules, reminds the client of an unanswered check-in once and tells the coach
/// once that a week was missed. Both are stamped on the response, so neither goes out twice. It reads
/// the effective rule per client, so a per-client override of the reminder or the notify flag applies.
/// </summary>
/// <param name="db">Application database context.</param>
/// <param name="notifications">Creates the in-app and push notification.</param>
public sealed class AutomationCheckInSweeper(IApplicationDbContext db, INotificationService notifications)
{
    /// <summary>
    /// Sends the reminders and missed-week notices that are due.
    /// </summary>
    /// <param name="nowUtc">The current instant.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <param name="ownerProfessionalProfileId">Limits the sweep to one coach's rules; null sweeps every coach.</param>
    public async Task SweepAsync(DateTime nowUtc, CancellationToken ct, long? ownerProfessionalProfileId = null)
    {
        var rules = await db.AutomationRules
            .AsNoTracking()
            .Include(r => r.OwnerProfessionalProfile)
            .Include(r => r.ClientProfile)
            .Where(r => r.ActionType == AutomationActionType.SendForm
                        && r.QuestionnaireId != null
                        && r.Questionnaire!.Type == QuestionnaireType.CheckIn
                        && (ownerProfessionalProfileId == null || r.OwnerProfessionalProfileId == ownerProfessionalProfileId))
            .ToListAsync(ct);

        foreach (var rule in rules)
        {
            await SweepRuleAsync(rule, nowUtc, ct);
        }
    }

    private async Task SweepRuleAsync(AutomationRule rule, DateTime nowUtc, CancellationToken ct)
    {
        var coachUserId = rule.OwnerProfessionalProfile.UserId;
        var onlyClientUserId = rule.ClientProfile?.UserId;
        var horizonStart = nowUtc - AutomationAnswerSweeper.Horizon;

        var open = await db.QuestionnaireResponses
            .Where(r => r.Kind == QuestionnaireResponseKind.CheckIn
                        && (r.Status == QuestionnaireResponseStatus.Pending || r.Status == QuestionnaireResponseStatus.InProgress)
                        && r.QuestionnaireId == rule.QuestionnaireId
                        && r.ProfessionalId == coachUserId
                        && r.CheckInDueAtUtc >= horizonStart
                        && (onlyClientUserId == null || r.ClientId == onlyClientUserId)
                        && (r.CheckInReminderSentAtUtc == null || r.CheckInMissedNotifiedAtUtc == null))
            .ToListAsync(ct);

        if (open.Count == 0)
        {
            return;
        }

        var overrides = (await db.AutomationClientOverrides
                .AsNoTracking()
                .Include(o => o.ClientProfile)
                .Where(o => o.AutomationRuleId == rule.Id)
                .ToListAsync(ct))
            .ToDictionary(o => o.ClientProfile.UserId);

        var userIds = open.Select(r => r.ClientId).Append(coachUserId).Distinct().ToList();
        var names = await db.Users
            .AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, u.FirstName, u.LastName })
            .ToDictionaryAsync(u => u.Id, u => $"{u.FirstName} {u.LastName}".Trim(), ct);

        var localToday = DateOnly.FromDateTime(nowUtc);

        foreach (var response in open)
        {
            overrides.TryGetValue(response.ClientId, out var clientOverride);
            var effective = AutomationEffectiveRule.Resolve(rule, clientOverride, localToday);

            if (!effective.Enabled || effective.AnswerWindowHours is not { } windowHours)
            {
                continue;
            }

            var dueAt = response.CheckInDueAtUtc!.Value;

            if (nowUtc < dueAt)
            {
                await RemindAsync(response, effective, windowHours, dueAt, nowUtc, names, coachUserId, ct);
            }
            else if (effective.NotifyCoachOnMissedWeek == true && response.CheckInMissedNotifiedAtUtc is null)
            {
                await NotifyMissedAsync(response, nowUtc, names, coachUserId, ct);
            }
        }
    }

    private async Task RemindAsync(
        QuestionnaireResponse response,
        AutomationEffectiveRule effective,
        int windowHours,
        DateTime dueAt,
        DateTime nowUtc,
        IReadOnlyDictionary<Guid, string> names,
        Guid coachUserId,
        CancellationToken ct)
    {
        if (response.CheckInReminderSentAtUtc is not null || effective.ReminderAfterHours is not { } reminderHours)
        {
            return;
        }

        // The send moment is the due time less the window the response was sent with.
        var remindAt = dueAt.AddHours(-(windowHours - reminderHours));

        if (nowUtc < remindAt)
        {
            return;
        }

        response.CheckInReminderSentAtUtc = nowUtc;

        await notifications.CreateAsync(
            response.ClientId,
            NotificationType.ClientCheckInReminder,
            new Dictionary<string, string>
            {
                ["professionalName"] = names.GetValueOrDefault(coachUserId, string.Empty),
                ["responseId"] = response.PublicId.ToString(),
            },
            ct: ct);

        await db.SaveChangesAsync(ct);
    }

    private async Task NotifyMissedAsync(
        QuestionnaireResponse response,
        DateTime nowUtc,
        IReadOnlyDictionary<Guid, string> names,
        Guid coachUserId,
        CancellationToken ct)
    {
        response.CheckInMissedNotifiedAtUtc = nowUtc;

        await notifications.CreateAsync(
            coachUserId,
            NotificationType.CoachCheckInMissed,
            new Dictionary<string, string>
            {
                ["clientName"] = names.GetValueOrDefault(response.ClientId, string.Empty),
                ["responseId"] = response.PublicId.ToString(),
            },
            ct: ct);

        await db.SaveChangesAsync(ct);
    }
}
