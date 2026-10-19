using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.Automations.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Automations.GetClientAutomations;

/// <summary>
/// Lists the automation rules that apply to one client: the caller's global rules whose audience
/// includes them (with their override or pause), client-only rules, and the read-only weekly check-in.
/// </summary>
/// <param name="db">Application database context.</param>
/// <param name="linkAuthorizationService">Resolves link capabilities.</param>
/// <param name="timeProvider">Clock.</param>
public class GetClientAutomationsEndpoint(
    IApplicationDbContext db,
    IClientLinkAuthorizationService linkAuthorizationService,
    TimeProvider timeProvider)
    : Endpoint<GetClientAutomationsRequest, GetClientAutomationsResponse>
{
    private static readonly TimeSpan SummaryWindow = TimeSpan.FromDays(30);

    /// <inheritdoc />
    public override void Configure()
    {
        Get("/trainer/clients/{ClientId}/automations");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "List a client's effective automation rules";
            s.Description =
                "Returns each rule with its source, next send, last result and 30-day counts. The weekly check-in is a read-only Linked row.";
            s.Responses[StatusCodes.Status200OK] = "The client's effective rules";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or invalid credentials";
            s.Responses[StatusCodes.Status403Forbidden] = "The live link grants no access";
            s.Responses[StatusCodes.Status404NotFound] = "Client not found, or the caller has no live link to them";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetClientAutomationsRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var context = await this.LoadClientContextOrRespondAsync(
            db, linkAuthorizationService, Guid.Parse(userId), req.ClientId, ct);

        if (context is null)
        {
            return;
        }

        var nowUtc = timeProvider.GetUtcNow().UtcDateTime;
        var zone = ClientLocalDateResolver.ResolveTimeZone(context.Client.User.TimeZone);
        var localToday = ClientLocalDateResolver.ResolveLocalDate(nowUtc, zone);
        var startLocalDate = ClientLocalDateResolver.ResolveLocalDate(context.StartedAt, zone);
        var windowStart = nowUtc - SummaryWindow;

        var rules = await db.AutomationRules
            .AsNoTracking()
            .CoveringClient(context.Profile.Id, context.Client.Id, context.TagIds)
            .Include(r => r.Questionnaire)
            .OrderBy(r => r.DateCreated)
            .ThenBy(r => r.Id)
            .ToListAsync(ct);

        var overrides = await db.AutomationClientOverrides
            .AsNoTracking()
            .Where(o => o.ClientProfileId == context.Client.Id)
            .ToDictionaryAsync(o => o.AutomationRuleId, ct);

        var recentRuns = await db.AutomationRuns
            .AsNoTracking()
            .Where(r => r.ClientProfileId == context.Client.Id && r.DateCreated >= windowStart)
            .Select(r => new RunRow(r.AutomationRuleId, r.Status, r.SkipReason, r.SentAt, r.AnsweredAt))
            .ToListAsync(ct);

        var lastRuns = await db.AutomationRuns
            .AsNoTracking()
            .Where(r => r.ClientProfileId == context.Client.Id)
            .GroupBy(r => r.AutomationRuleId)
            .Select(g => g.OrderByDescending(r => r.DateCreated)
                .Select(r => new RunRow(r.AutomationRuleId, r.Status, r.SkipReason, r.SentAt, r.AnsweredAt))
                .First())
            .ToDictionaryAsync(r => r.RuleId, ct);

        var items = new List<ClientAutomationItem>();
        items.AddRange(await BuildLinkedCheckInItemsAsync(Guid.Parse(userId), context.Client.UserId, ct));

        foreach (var rule in rules)
        {
            overrides.TryGetValue(rule.Id, out var clientOverride);

            var item = BuildRuleItem(rule, clientOverride, localToday);
            var ruleRuns = recentRuns.Where(r => r.RuleId == rule.Id).ToList();

            item.Sent30Days = ruleRuns.Count(r => r.Status == AutomationRunStatus.Sent);
            item.Answered30Days = ruleRuns.Count(r => r.AnsweredAt != null);
            item.Skipped30Days = ruleRuns.Count(r => r.Status == AutomationRunStatus.Skipped);
            item.LastResult = lastRuns.TryGetValue(rule.Id, out var last)
                ? new ClientAutomationLastResult
                {
                    Status = last.Status,
                    SkipReason = last.SkipReason,
                    SentAt = last.SentAt,
                    AnsweredAt = last.AnsweredAt,
                }
                : null;
            item.NextSendAt = ComputeNextSend(item, zone, startLocalDate, nowUtc);

            items.Add(item);
        }

        await Send.OkAsync(new GetClientAutomationsResponse
        {
            Items = items,
            Last30Days = new ClientAutomationSummary
            {
                Sent = recentRuns.Count(r => r.Status == AutomationRunStatus.Sent),
                Answered = recentRuns.Count(r => r.AnsweredAt != null),
                Waiting = recentRuns.Count(r => r.Status == AutomationRunStatus.Sent && r.AnsweredAt == null),
                Skipped = recentRuns.Count(r => r.Status == AutomationRunStatus.Skipped),
            },
        }, ct);
    }

    private static ClientAutomationItem BuildRuleItem(
        AutomationRule rule, AutomationClientOverride? clientOverride, DateOnly localToday)
    {
        var isPaused = clientOverride is not null &&
                       AutomationScheduleCalculator.IsPauseEffective(clientOverride.IsPaused, clientOverride.PausedUntil, localToday);
        var custom = clientOverride is { IsCustomized: true } ? clientOverride : null;

        var source = rule.ClientProfileId is not null ? AutomationRuleSource.OnlyThisClient
            : isPaused ? AutomationRuleSource.Paused
            : custom is not null ? AutomationRuleSource.Custom
            : AutomationRuleSource.Default;

        var item = new ClientAutomationItem
        {
            RuleId = rule.PublicId,
            Source = source,
            Name = rule.Name,
            ActionType = rule.ActionType,
            QuestionnaireId = rule.Questionnaire?.PublicId,
            IsPaused = isPaused,
            PausedUntil = isPaused ? clientOverride!.PausedUntil : null,
            PauseNote = isPaused ? clientOverride!.PauseNote : null,
        };

        if (custom is not null)
        {
            item.Message = custom.Message;
            item.TriggerKind = custom.TriggerKind;
            item.ScheduleInterval = custom.ScheduleInterval;
            item.ScheduleUnit = custom.ScheduleUnit;
            item.LocalTime = custom.LocalTime?.ToTimeSpan();
            item.EventType = custom.EventType;
            item.EventOffsetDays = custom.EventOffsetDays;
            item.EventOffsetDirection = custom.EventOffsetDirection;
            item.OncePerPlan = custom.OncePerPlan;
            item.SkipWhilePreviousUnanswered = custom.SkipWhilePreviousUnanswered;
            item.StopAfterSends = custom.StopAfterSends;
            item.Enabled = custom.Enabled;
        }
        else
        {
            item.Message = rule.Message;
            item.TriggerKind = rule.TriggerKind;
            item.ScheduleInterval = rule.ScheduleInterval;
            item.ScheduleUnit = rule.ScheduleUnit;
            item.LocalTime = rule.LocalTime?.ToTimeSpan();
            item.EventType = rule.EventType;
            item.EventOffsetDays = rule.EventOffsetDays;
            item.EventOffsetDirection = rule.EventOffsetDirection;
            item.OncePerPlan = rule.OncePerPlan;
            item.SkipWhilePreviousUnanswered = rule.SkipWhilePreviousUnanswered;
            item.StopAfterSends = rule.StopAfterSends;
            item.Enabled = rule.Enabled;
        }

        return item;
    }

    private static DateTime? ComputeNextSend(
        ClientAutomationItem item, TimeZoneInfo zone, DateOnly startLocalDate, DateTime nowUtc)
    {
        if (!item.Enabled ||
            item.IsPaused ||
            item.TriggerKind != AutomationTriggerKind.Schedule ||
            item.ScheduleInterval is null ||
            item.ScheduleUnit is null ||
            item.LocalTime is null)
        {
            return null;
        }

        return AutomationScheduleCalculator.ComputeNextRunAt(
            item.ScheduleInterval.Value,
            item.ScheduleUnit.Value,
            TimeOnly.FromTimeSpan(item.LocalTime.Value),
            zone,
            startLocalDate,
            nowUtc);
    }

    private async Task<List<ClientAutomationItem>> BuildLinkedCheckInItemsAsync(
        Guid coachUserId, Guid clientUserId, CancellationToken ct)
    {
        var settings = await db.WeeklyCheckInSettings
            .AsNoTracking()
            .Where(s => s.UserId == coachUserId)
            .ToListAsync(ct);

        var checkInOverrides = await db.WeeklyCheckInClientOverrides
            .AsNoTracking()
            .Where(o => o.ProfessionalUserId == coachUserId && o.ClientUserId == clientUserId)
            .ToListAsync(ct);

        return settings
            .OrderBy(s => s.Profession)
            .Select(setting => new ClientAutomationItem
            {
                Source = AutomationRuleSource.Linked,
                Profession = setting.Profession.ToString(),
                Enabled = checkInOverrides.FirstOrDefault(o => o.Profession == setting.Profession)?.Enabled
                          ?? setting.Enabled,
            })
            .ToList();
    }

    private sealed record RunRow(
        long RuleId,
        AutomationRunStatus Status,
        AutomationSkipReason? SkipReason,
        DateTime? SentAt,
        DateTime? AnsweredAt);
}
