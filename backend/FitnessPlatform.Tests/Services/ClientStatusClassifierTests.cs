using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FluentAssertions;

namespace FitnessPlatform.Tests.Services;

/// <summary>
/// Unit tests for <see cref="ClientStatusClassifier.Classify"/> — the pure Active/Paused/Archived
/// derivation extracted from <c>GetClientsEndpoint</c> (issue #1094). Pure inputs only, no Mongo,
/// no <c>DbContext</c> — the window resolution itself stays covered by
/// <c>GetClientsEndpointTests</c> against Testcontainers; these tests only pin the classifier's
/// own combination logic once plan presence has already been resolved.
/// </summary>
public class ClientStatusClassifierTests
{
    [Fact]
    public void Classify_InactiveLink_ReturnsArchived_RegardlessOfPlans()
    {
        var status = ClientStatusClassifier.Classify(
            isActive: false,
            capabilities: new LinkCapabilities(true, true),
            hasActiveNutritionPlan: true,
            hasActiveTrainingPlan: true);

        status.Should().Be(ClientListStatus.Archived);
    }

    [Fact]
    public void Classify_ActiveLink_NoActivePlans_ReturnsPaused()
    {
        var status = ClientStatusClassifier.Classify(
            isActive: true,
            capabilities: new LinkCapabilities(true, true),
            hasActiveNutritionPlan: false,
            hasActiveTrainingPlan: false);

        status.Should().Be(ClientListStatus.Paused);
    }

    [Fact]
    public void Classify_ActiveLink_ActiveNutritionPlan_ReturnsActive()
    {
        var status = ClientStatusClassifier.Classify(
            isActive: true,
            capabilities: new LinkCapabilities(true, true),
            hasActiveNutritionPlan: true,
            hasActiveTrainingPlan: false);

        status.Should().Be(ClientListStatus.Active);
    }

    [Fact]
    public void Classify_ActiveLink_ActiveTrainingPlan_ReturnsActive()
    {
        var status = ClientStatusClassifier.Classify(
            isActive: true,
            capabilities: new LinkCapabilities(true, true),
            hasActiveNutritionPlan: false,
            hasActiveTrainingPlan: true);

        status.Should().Be(ClientListStatus.Active);
    }

    [Fact]
    public void Classify_NutritionOnlyLink_ActiveTrainingPlanOnly_ReturnsPaused()
    {
        // Capability-scoped: the caller passes an unfiltered training-plan-presence flag, but a
        // link that does not grant CanViewTrainingPlans must never read it as Active. Mirrors
        // GetClientsEndpointTests.List_NutritionOnlyLink_ClientHasActiveTrainingPlan_ClassifiesPausedAndOmitsTrainingPlan.
        var status = ClientStatusClassifier.Classify(
            isActive: true,
            capabilities: new LinkCapabilities(CanViewNutritionPlans: true, CanViewTrainingPlans: false),
            hasActiveNutritionPlan: false,
            hasActiveTrainingPlan: true);

        status.Should().Be(ClientListStatus.Paused);
    }

    [Fact]
    public void Classify_TrainingOnlyLink_ActiveNutritionPlanOnly_ReturnsPaused()
    {
        var status = ClientStatusClassifier.Classify(
            isActive: true,
            capabilities: new LinkCapabilities(CanViewNutritionPlans: false, CanViewTrainingPlans: true),
            hasActiveNutritionPlan: true,
            hasActiveTrainingPlan: false);

        status.Should().Be(ClientListStatus.Paused);
    }

    [Fact]
    public void Classify_GrantsNothingLink_AlwaysPaused_EvenWithBothPlansPresent()
    {
        // Mirrors GetClientsEndpointTests.List_GrantsNothingLink_AlwaysPaused.
        var status = ClientStatusClassifier.Classify(
            isActive: true,
            capabilities: new LinkCapabilities(CanViewNutritionPlans: false, CanViewTrainingPlans: false),
            hasActiveNutritionPlan: true,
            hasActiveTrainingPlan: true);

        status.Should().Be(ClientListStatus.Paused);
    }

    [Fact]
    public void Classify_ActiveLink_BothPlansActive_ReturnsActive()
    {
        var status = ClientStatusClassifier.Classify(
            isActive: true,
            capabilities: new LinkCapabilities(true, true),
            hasActiveNutritionPlan: true,
            hasActiveTrainingPlan: true);

        status.Should().Be(ClientListStatus.Active);
    }
}
