using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Tests.Builders;
using FluentAssertions;
using MockQueryable.NSubstitute;

namespace FitnessPlatform.Tests.Domain;

/// <summary>
/// Unit tests for <see cref="ProfessionSlotGuard"/> — the shared one-active-coach-per-
/// profession invariant check reused by all four <see cref="ClientProfessionalLink"/>
/// creation/reactivation paths (#980).
/// </summary>
public class ProfessionSlotGuardTests
{
    private const long ClientId = 1;
    private const long NewProfessionalId = 10;
    private const long OtherProfessionalId = 20;

    [Fact]
    public async Task IsSlotTakenByAnotherProfessionalAsync_NoOtherLink_ReturnsFalse()
    {
        var links = new List<ClientProfessionalLink>().BuildMockDbSet();

        var result = await ProfessionSlotGuard.IsSlotTakenByAnotherProfessionalAsync(
            links, ClientId, NewProfessionalId,
            wantsNutritionPlans: true, wantsTrainingPlans: false,
            TestContext.Current.CancellationToken);

        result.Should().BeFalse();
    }

    [Fact]
    public async Task IsSlotTakenByAnotherProfessionalAsync_AnotherActiveNutritionist_OccupiesNutritionSlot_ReturnsTrue()
    {
        var existing = EntityBuilder.ClientProfessionalLink
            .WithClientProfileId(ClientId)
            .WithProfessionalProfileId(OtherProfessionalId)
            .WithCanViewNutritionPlans(true)
            .WithCanViewTrainingPlans(false)
            .Build();

        var links = new List<ClientProfessionalLink> { existing }.BuildMockDbSet();

        var result = await ProfessionSlotGuard.IsSlotTakenByAnotherProfessionalAsync(
            links, ClientId, NewProfessionalId,
            wantsNutritionPlans: true, wantsTrainingPlans: false,
            TestContext.Current.CancellationToken);

        result.Should().BeTrue();
    }

    /// <summary>
    /// The other professional's link is scoped TrainingOnly (CanViewNutritionPlans=false) —
    /// it does not occupy the nutrition slot, so a new nutrition-scoped link is allowed.
    /// Proves occupancy is read from the CanView* flags, not from any global role.
    /// </summary>
    [Fact]
    public async Task IsSlotTakenByAnotherProfessionalAsync_OtherLinkScopedToDifferentProfession_ReturnsFalse()
    {
        var existing = EntityBuilder.ClientProfessionalLink
            .WithClientProfileId(ClientId)
            .WithProfessionalProfileId(OtherProfessionalId)
            .WithCanViewNutritionPlans(false)
            .WithCanViewTrainingPlans(true)
            .Build();

        var links = new List<ClientProfessionalLink> { existing }.BuildMockDbSet();

        var result = await ProfessionSlotGuard.IsSlotTakenByAnotherProfessionalAsync(
            links, ClientId, NewProfessionalId,
            wantsNutritionPlans: true, wantsTrainingPlans: false,
            TestContext.Current.CancellationToken);

        result.Should().BeFalse();
    }

    /// <summary>
    /// A dual-role professional's own link carries BOTH flags — self-exclusion by
    /// ProfessionalProfileId means reactivating (or re-processing) their own link, which
    /// legitimately occupies both slots, never blocks itself.
    /// </summary>
    [Fact]
    public async Task IsSlotTakenByAnotherProfessionalAsync_SameProfessionalOwnDualRoleLink_ExcludesSelf_ReturnsFalse()
    {
        var ownLink = EntityBuilder.ClientProfessionalLink
            .WithClientProfileId(ClientId)
            .WithProfessionalProfileId(NewProfessionalId)
            .WithCanViewNutritionPlans(true)
            .WithCanViewTrainingPlans(true)
            .Build();

        var links = new List<ClientProfessionalLink> { ownLink }.BuildMockDbSet();

        var result = await ProfessionSlotGuard.IsSlotTakenByAnotherProfessionalAsync(
            links, ClientId, NewProfessionalId,
            wantsNutritionPlans: true, wantsTrainingPlans: true,
            TestContext.Current.CancellationToken);

        result.Should().BeFalse();
    }

    [Fact]
    public async Task IsSlotTakenByAnotherProfessionalAsync_OtherLinkIsInactive_ReturnsFalse()
    {
        var inactiveLink = EntityBuilder.ClientProfessionalLink
            .WithClientProfileId(ClientId)
            .WithProfessionalProfileId(OtherProfessionalId)
            .WithCanViewNutritionPlans(true)
            .WithCanViewTrainingPlans(true)
            .Inactive()
            .Build();

        var links = new List<ClientProfessionalLink> { inactiveLink }.BuildMockDbSet();

        var result = await ProfessionSlotGuard.IsSlotTakenByAnotherProfessionalAsync(
            links, ClientId, NewProfessionalId,
            wantsNutritionPlans: true, wantsTrainingPlans: false,
            TestContext.Current.CancellationToken);

        result.Should().BeFalse();
    }

    [Fact]
    public async Task IsSlotTakenByAnotherProfessionalAsync_NeitherFlagRequested_ReturnsFalse()
    {
        var existing = EntityBuilder.ClientProfessionalLink
            .WithClientProfileId(ClientId)
            .WithProfessionalProfileId(OtherProfessionalId)
            .WithCanViewNutritionPlans(true)
            .WithCanViewTrainingPlans(true)
            .Build();

        var links = new List<ClientProfessionalLink> { existing }.BuildMockDbSet();

        var result = await ProfessionSlotGuard.IsSlotTakenByAnotherProfessionalAsync(
            links, ClientId, NewProfessionalId,
            wantsNutritionPlans: false, wantsTrainingPlans: false,
            TestContext.Current.CancellationToken);

        result.Should().BeFalse();
    }
}
