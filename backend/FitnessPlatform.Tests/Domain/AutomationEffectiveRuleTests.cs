using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FluentAssertions;

namespace FitnessPlatform.Tests.Domain;

/// <summary>
/// Unit tests for <see cref="AutomationEffectiveRule"/> and <see cref="AutomationNextSendCalculator"/>.
/// </summary>
public class AutomationEffectiveRuleTests
{
    private static readonly DateOnly Today = new(2026, 3, 10);

    private static AutomationRule Rule() => new()
    {
        Name = "Photos",
        ActionType = AutomationActionType.RequestProgressPhotos,
        TriggerKind = AutomationTriggerKind.Schedule,
        ScheduleInterval = 4,
        ScheduleUnit = AutomationScheduleUnit.Weeks,
        LocalTime = new TimeOnly(9, 0),
        Message = "Global",
    };

    [Fact]
    public void Resolve_NoOverride_UsesTheRuleAsDefault()
    {
        var effective = AutomationEffectiveRule.Resolve(Rule(), null, Today);

        effective.Source.Should().Be(AutomationRuleSource.Default);
        effective.Message.Should().Be("Global");
        effective.ScheduleInterval.Should().Be(4);
        effective.IsPaused.Should().BeFalse();
    }

    [Fact]
    public void Resolve_CustomisedOverride_ReplacesTheRulesFields()
    {
        var clientOverride = new AutomationClientOverride
        {
            IsCustomized = true,
            Message = "Mine",
            TriggerKind = AutomationTriggerKind.Schedule,
            ScheduleInterval = 1,
            ScheduleUnit = AutomationScheduleUnit.Days,
            LocalTime = new TimeOnly(7, 0),
            Enabled = true,
        };

        var effective = AutomationEffectiveRule.Resolve(Rule(), clientOverride, Today);

        effective.Source.Should().Be(AutomationRuleSource.Custom);
        effective.Message.Should().Be("Mine");
        effective.ScheduleUnit.Should().Be(AutomationScheduleUnit.Days);
    }

    [Fact]
    public void Resolve_PauseOnly_KeepsTheRulesFieldsAndReportsPaused()
    {
        var clientOverride = new AutomationClientOverride { IsPaused = true, PausedUntil = Today, PauseNote = "knee" };

        var effective = AutomationEffectiveRule.Resolve(Rule(), clientOverride, Today);

        effective.Source.Should().Be(AutomationRuleSource.Paused);
        effective.Message.Should().Be("Global");
        effective.PauseNote.Should().Be("knee");
    }

    [Fact]
    public void Resolve_LapsedPause_IsNotPaused()
    {
        var clientOverride = new AutomationClientOverride { IsPaused = true, PausedUntil = Today.AddDays(-1) };

        var effective = AutomationEffectiveRule.Resolve(Rule(), clientOverride, Today);

        effective.IsPaused.Should().BeFalse();
        effective.Source.Should().Be(AutomationRuleSource.Default);
        effective.PausedUntil.Should().BeNull();
    }

    [Fact]
    public void Compute_PausedOrDisabledRule_HasNoNextSend()
    {
        var nowUtc = new DateTime(2026, 3, 10, 0, 0, 0, DateTimeKind.Utc);
        var rule = Rule();
        rule.Enabled = false;

        AutomationNextSendCalculator.Compute(
                AutomationEffectiveRule.Resolve(rule, null, Today), TimeZoneInfo.Utc, new DateOnly(2026, 3, 1), [], nowUtc)
            .Should().BeNull();

        rule.Enabled = true;
        var paused = new AutomationClientOverride { IsPaused = true };

        AutomationNextSendCalculator.Compute(
                AutomationEffectiveRule.Resolve(rule, paused, Today), TimeZoneInfo.Utc, new DateOnly(2026, 3, 1), [], nowUtc)
            .Should().BeNull();
    }

    [Fact]
    public void Compute_ScheduleRule_MatchesTheScheduleCalculator()
    {
        var nowUtc = new DateTime(2026, 3, 10, 0, 0, 0, DateTimeKind.Utc);
        var start = new DateOnly(2026, 3, 1);

        var next = AutomationNextSendCalculator.Compute(
            AutomationEffectiveRule.Resolve(Rule(), null, Today), TimeZoneInfo.Utc, start, [], nowUtc);

        next.Should().Be(AutomationScheduleCalculator.ComputeNextRunAt(
            4, AutomationScheduleUnit.Weeks, new TimeOnly(9, 0), TimeZoneInfo.Utc, start, nowUtc));
    }

    [Fact]
    public void Covers_AudienceKinds_MatchTheClient()
    {
        var all = new AutomationRule { Name = "all", Audience = AutomationAudience.All };
        var tag = new AutomationRule { Name = "tag", Audience = AutomationAudience.Tag, AudienceTagId = 7 };
        var orphanTag = new AutomationRule { Name = "orphan", Audience = AutomationAudience.Tag, AudienceTagId = null };
        var chosen = new AutomationRule
        {
            Name = "chosen",
            Audience = AutomationAudience.Chosen,
            AudienceClients = [new AutomationRuleAudienceClient { ClientProfileId = 5 }],
        };
        var clientOnly = new AutomationRule { Name = "only", ClientProfileId = 5 };
        IReadOnlySet<long> tags = new HashSet<long> { 7 };

        AutomationAudienceFilter.Covers(all, 5, tags).Should().BeTrue();
        AutomationAudienceFilter.Covers(tag, 5, tags).Should().BeTrue();
        AutomationAudienceFilter.Covers(tag, 5, new HashSet<long>()).Should().BeFalse();
        AutomationAudienceFilter.Covers(orphanTag, 5, tags).Should().BeFalse();
        AutomationAudienceFilter.Covers(chosen, 5, tags).Should().BeTrue();
        AutomationAudienceFilter.Covers(chosen, 6, tags).Should().BeFalse();
        AutomationAudienceFilter.Covers(clientOnly, 5, tags).Should().BeTrue();
        AutomationAudienceFilter.Covers(clientOnly, 6, tags).Should().BeFalse();
    }
}
