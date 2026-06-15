using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;

namespace FitnessPlatform.Tests.Services;

/// <summary>
/// Pure unit tests for <see cref="ClientVerdictService.ComputeVerdict"/>.
/// No Docker required — no I/O, pure threshold logic.
/// Covers every verdict branch required by issue #485 AC.
/// </summary>
public class ClientVerdictServiceTests
{
    // ── Shared helpers ────────────────────────────────────────────────────────

    /// <summary>
    /// Calls ComputeVerdict with safe defaults for signals not under test.
    /// All plans active by default; all signals "on track".
    /// Pass <c>explicitLastActiveAt: null</c> to test the no-activity path.
    /// </summary>
    private static ClientVerdict Compute(
        decimal? compliancePercent = 90m,
        bool hasActiveNutritionPlan = true,
        WeightDirection weightDirection = WeightDirection.Towards,
        decimal? weightDeltaToGoal = -1m,
        bool hasWeightSignal = true,
        int? frequencyActual = 3,
        int? frequencyPrescribed = 3,
        bool hasActiveTrainingPlan = true,
        DateTime? lastActiveAt = null,
        bool noActivity = false)
    {
        // If the caller explicitly wants null (no activity), honour it.
        // Otherwise default to "active yesterday" so inactivity doesn't interfere.
        DateTime? resolvedLastActiveAt = noActivity ? null : (lastActiveAt ?? DateTime.UtcNow.AddDays(-1));

        return ClientVerdictService.ComputeVerdict(
            compliancePercent, hasActiveNutritionPlan,
            weightDirection, weightDeltaToGoal, hasWeightSignal,
            frequencyActual, frequencyPrescribed, hasActiveTrainingPlan,
            resolvedLastActiveAt);
    }

    // ── Full OnTrack ──────────────────────────────────────────────────────────

    [Fact]
    public void ComputeVerdict_AllSignalsGreen_ReturnsOnTrack()
    {
        var verdict = Compute(
            compliancePercent: 92m,
            weightDirection: WeightDirection.Towards,
            weightDeltaToGoal: -0.5m,
            frequencyActual: 3,
            frequencyPrescribed: 3);

        verdict.Should().Be(ClientVerdict.OnTrack);
    }

    // ── Single-signal NeedsAttention ──────────────────────────────────────────

    [Fact]
    public void ComputeVerdict_ComplianceBetween60And84_ReturnsNeedsAttention()
    {
        // Compliance in [60, 84] is a soft signal — NeedsAttention, not OffTrack.
        var verdict = Compute(compliancePercent: 72m);

        verdict.Should().Be(ClientVerdict.NeedsAttention);
    }

    [Fact]
    public void ComputeVerdict_ComplianceAt60_ReturnsNeedsAttention()
    {
        // Exactly 60% — the boundary between OffTrack (<60) and NeedsAttention ([60,84]).
        var verdict = Compute(compliancePercent: 60m);

        verdict.Should().Be(ClientVerdict.NeedsAttention);
    }

    [Fact]
    public void ComputeVerdict_WeightStable_ReturnsNeedsAttention()
    {
        var verdict = Compute(
            weightDirection: WeightDirection.Stable,
            weightDeltaToGoal: 0.2m);

        verdict.Should().Be(ClientVerdict.NeedsAttention);
    }

    [Fact]
    public void ComputeVerdict_WeightAwaySmallDelta_ReturnsNeedsAttention()
    {
        // Away but delta <= WeightOffTrackDeltaKg (1 kg) is soft, not hard OffTrack.
        var verdict = Compute(
            weightDirection: WeightDirection.Away,
            weightDeltaToGoal: 0.8m);

        verdict.Should().Be(ClientVerdict.NeedsAttention);
    }

    [Fact]
    public void ComputeVerdict_FrequencyBelowPrescribed_ReturnsNeedsAttention()
    {
        var verdict = Compute(
            frequencyActual: 2,
            frequencyPrescribed: 3);

        verdict.Should().Be(ClientVerdict.NeedsAttention);
    }

    // ── Multiple soft signals ─────────────────────────────────────────────────

    [Fact]
    public void ComputeVerdict_TwoSoftSignalsOff_ReturnsNeedsAttention()
    {
        // Multiple soft signals still NeedsAttention — no hard threshold crossed.
        var verdict = Compute(
            compliancePercent: 75m,     // soft: [60, 84]
            weightDirection: WeightDirection.Stable,
            frequencyActual: 3,
            frequencyPrescribed: 3);

        verdict.Should().Be(ClientVerdict.NeedsAttention);
    }

    // ── OffTrack hard thresholds ──────────────────────────────────────────────

    [Fact]
    public void ComputeVerdict_ComplianceBelow60_ReturnsOffTrack()
    {
        var verdict = Compute(compliancePercent: 45m);

        verdict.Should().Be(ClientVerdict.OffTrack);
    }

    [Fact]
    public void ComputeVerdict_ComplianceAt59_ReturnsOffTrack()
    {
        // Just below the 60% threshold.
        var verdict = Compute(compliancePercent: 59.9m);

        verdict.Should().Be(ClientVerdict.OffTrack);
    }

    [Fact]
    public void ComputeVerdict_WeightAwayDeltaAbove1Kg_ReturnsOffTrack()
    {
        var verdict = Compute(
            weightDirection: WeightDirection.Away,
            weightDeltaToGoal: 1.5m);

        verdict.Should().Be(ClientVerdict.OffTrack);
    }

    [Fact]
    public void ComputeVerdict_WeightAwayDeltaExactly1Kg_ReturnsNeedsAttention()
    {
        // Exactly 1 kg Away is NOT OffTrack — threshold is strict greater-than.
        var verdict = Compute(
            weightDirection: WeightDirection.Away,
            weightDeltaToGoal: 1.0m);

        verdict.Should().Be(ClientVerdict.NeedsAttention);
    }

    [Fact]
    public void ComputeVerdict_Inactivity_MoreThan14Days_ReturnsOffTrack()
    {
        // 15 days since last activity — strictly > 14 days.
        var lastActive = DateTime.UtcNow.AddDays(-(ClientDashboardConstants.InactivityThresholdDays + 1));
        var verdict = Compute(lastActiveAt: lastActive);

        verdict.Should().Be(ClientVerdict.OffTrack);
    }

    [Fact]
    public void ComputeVerdict_Inactivity_Exactly14Days_ReturnsNotOffTrack()
    {
        // Exactly 14 days — the boundary: the code uses strict > so 14 days is NOT OffTrack.
        // Give a small buffer (14 days minus a few seconds) to avoid floating-point edge in CI.
        var lastActive = DateTime.UtcNow.AddDays(-ClientDashboardConstants.InactivityThresholdDays).AddSeconds(10);
        var verdict = Compute(lastActiveAt: lastActive);

        verdict.Should().NotBe(ClientVerdict.OffTrack);
    }

    [Fact]
    public void ComputeVerdict_NoActivity_WithActivePlan_ReturnsOffTrack()
    {
        // No activity at all + active plan = OffTrack.
        var verdict = Compute(
            noActivity: true,
            hasActiveNutritionPlan: true,
            compliancePercent: 90m);

        verdict.Should().Be(ClientVerdict.OffTrack);
    }

    // ── Null-exclusion paths ──────────────────────────────────────────────────

    [Fact]
    public void ComputeVerdict_NoActiveNutritionPlan_ComplianceExcluded_ReturnsOnTrack()
    {
        // No nutrition plan: compliancePercent signal is excluded — should still be OnTrack
        // if all other signals are green.
        var verdict = Compute(
            compliancePercent: null,
            hasActiveNutritionPlan: false,
            weightDirection: WeightDirection.Towards,
            frequencyActual: 3,
            frequencyPrescribed: 3);

        verdict.Should().Be(ClientVerdict.OnTrack);
    }

    [Fact]
    public void ComputeVerdict_NoActiveTrainingPlan_FrequencyExcluded_ReturnsOnTrack()
    {
        // No training plan: frequency signal is excluded — should still be OnTrack
        // if all other signals are green.
        var verdict = Compute(
            compliancePercent: 90m,
            hasActiveNutritionPlan: true,
            frequencyActual: null,
            frequencyPrescribed: null,
            hasActiveTrainingPlan: false,
            weightDirection: WeightDirection.Towards);

        verdict.Should().Be(ClientVerdict.OnTrack);
    }

    [Fact]
    public void ComputeVerdict_NoWeightSignal_WeightExcluded_ReturnsOnTrack()
    {
        // No measurements or no target weight: weight signal excluded.
        var verdict = Compute(
            compliancePercent: 90m,
            hasWeightSignal: false,
            weightDirection: WeightDirection.Stable,
            weightDeltaToGoal: null);

        verdict.Should().Be(ClientVerdict.OnTrack);
    }

    [Fact]
    public void ComputeVerdict_NoBotchPlans_NoActivity_ReturnsOnTrack()
    {
        // No active plans at all and no activity: no inactivity flag because no plans.
        var verdict = Compute(
            noActivity: true,
            hasActiveNutritionPlan: false,
            compliancePercent: null,
            hasActiveTrainingPlan: false,
            frequencyActual: null,
            frequencyPrescribed: null,
            hasWeightSignal: false,
            weightDeltaToGoal: null);

        verdict.Should().Be(ClientVerdict.OnTrack);
    }

    // ── WeightDirection.Away with no weight signal (edge case) ───────────────

    [Fact]
    public void ComputeVerdict_WeightAwayButNoSignal_DoesNotFlagOffTrack()
    {
        // hasWeightSignal=false means the weight signal is excluded even if Away+delta>1.
        var verdict = Compute(
            hasWeightSignal: false,
            weightDirection: WeightDirection.Away,
            weightDeltaToGoal: 5m);

        verdict.Should().NotBe(ClientVerdict.OffTrack);
    }
}
