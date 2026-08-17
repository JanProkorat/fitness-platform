using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Infrastructure.Services;

/// <summary>
/// Characterization truth-table for the seven pre-#958 authorization checks on
/// <see cref="ProfessionalAuthHelper"/> and <see cref="NutritionAuthHelper"/>. Written and passing
/// against their pre-refactor bodies before #958's <c>ClientLinkAuthorizationService</c>
/// extraction, and left unchanged afterward — a green run on both sides is the equivalence proof
/// that the delegating wrappers #958 introduces preserve behaviour exactly.
/// <para>
/// Covers every method x {no professional profile, no client profile, no link, inactive link, and
/// all four capability flag combinations} — including the three methods
/// <c>CrossRoleLinkAccessTests</c> never exercises: <c>HasPlanAccessForClientUserAsync</c>,
/// <c>HasPlanAccessAsync</c>, and <c>GetAccessibleClientUserIdsAsync</c>.
/// </para>
/// </summary>
[Collection(TestCollection.Name)]
public class LinkAuthHelperEquivalenceTests(FitnessApiFactory factory)
{
    private static string UniqueEmail(string tag) => $"{Guid.NewGuid():N}@link-auth-equiv-{tag}.com";

    private async Task<Guid> RegisterProfessionalAsync(string tag)
    {
        var client = factory.CreateClient();
        var email = UniqueEmail(tag);
        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Test", "Professional", "Trainer");

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.FirstAsync(u => u.Email == email, TestContext.Current.CancellationToken);
        return user.Id;
    }

    private async Task<(Guid ClientPublicId, Guid ClientUserId)> RegisterClientAsync(string tag)
    {
        var client = factory.CreateClient();
        var email = UniqueEmail(tag);
        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Test", "Client", "Client");

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.FirstAsync(u => u.Email == email, TestContext.Current.CancellationToken);
        var profile = await db.ClientProfiles.FirstAsync(
            cp => cp.UserId == user.Id, TestContext.Current.CancellationToken);
        return (profile.PublicId, user.Id);
    }

    private async Task CreateLinkAsync(
        Guid professionalUserId, Guid clientUserId, bool isActive, bool canViewNutritionPlans, bool canViewTrainingPlans)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var professionalProfile = await db.ProfessionalProfiles.FirstAsync(
            pp => pp.UserId == professionalUserId, TestContext.Current.CancellationToken);
        var clientProfile = await db.ClientProfiles.FirstAsync(
            cp => cp.UserId == clientUserId, TestContext.Current.CancellationToken);

        db.ClientProfessionalLinks.Add(new ClientProfessionalLink
        {
            PublicId = Guid.NewGuid(),
            ProfessionalProfileId = professionalProfile.Id,
            ClientProfileId = clientProfile.Id,
            ProfessionalRole = UserRole.Trainer,
            IsActive = isActive,
            CanViewNutritionPlans = canViewNutritionPlans,
            CanViewTrainingPlans = canViewTrainingPlans,
            DateCreated = DateTime.UtcNow
        });

        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    /// <summary>
    /// Asserts every one of the seven methods denies access — the shape shared by "no professional
    /// profile", "no client profile", "no link", and "inactive link".
    /// </summary>
    private async Task AssertNoAccessAsync(Guid professionalUserId, Guid clientPublicId, Guid clientUserId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var professionalHelper = new ProfessionalAuthHelper(db);
        var nutritionHelper = new NutritionAuthHelper(db);
        var ct = TestContext.Current.CancellationToken;

        (await professionalHelper.HasActiveLinkAsync(professionalUserId, clientPublicId, ct)).Should().BeFalse();
        (await professionalHelper.HasAnyPlanAccessAsync(professionalUserId, clientPublicId, ct)).Should().BeFalse();
        (await professionalHelper.HasPlanAccessForClientUserAsync(professionalUserId, clientUserId, true, ct)).Should().BeFalse();
        (await professionalHelper.HasPlanAccessForClientUserAsync(professionalUserId, clientUserId, false, ct)).Should().BeFalse();
        (await professionalHelper.HasPlanAccessAsync(professionalUserId, clientPublicId, true, ct)).Should().BeFalse();
        (await professionalHelper.HasPlanAccessAsync(professionalUserId, clientPublicId, false, ct)).Should().BeFalse();
        (await professionalHelper.GetAccessibleClientUserIdsAsync(professionalUserId, true, ct)).Should().BeEmpty();
        (await professionalHelper.GetAccessibleClientUserIdsAsync(professionalUserId, false, ct)).Should().BeEmpty();
        (await professionalHelper.GetLinkCapabilitiesAsync(professionalUserId, clientPublicId, ct)).Should().BeNull();
        (await nutritionHelper.HasActiveLinkAsync(professionalUserId, clientPublicId, ct)).Should().BeFalse();
    }

    [Fact]
    public async Task AllSevenMethods_NoProfessionalProfile_DenyAccess()
    {
        var (clientPublicId, clientUserId) = await RegisterClientAsync("no-prof");
        var nonExistentProfessionalUserId = Guid.NewGuid();

        await AssertNoAccessAsync(nonExistentProfessionalUserId, clientPublicId, clientUserId);
    }

    [Fact]
    public async Task AllSevenMethods_NoClientProfile_DenyAccess()
    {
        var professionalUserId = await RegisterProfessionalAsync("no-client");
        var nonExistentClientPublicId = Guid.NewGuid();
        var nonExistentClientUserId = Guid.NewGuid();

        await AssertNoAccessAsync(professionalUserId, nonExistentClientPublicId, nonExistentClientUserId);
    }

    [Fact]
    public async Task AllSevenMethods_NoLink_DenyAccess()
    {
        var professionalUserId = await RegisterProfessionalAsync("no-link");
        var (clientPublicId, clientUserId) = await RegisterClientAsync("no-link");

        await AssertNoAccessAsync(professionalUserId, clientPublicId, clientUserId);
    }

    [Fact]
    public async Task AllSevenMethods_InactiveLink_DenyAccess()
    {
        var professionalUserId = await RegisterProfessionalAsync("inactive");
        var (clientPublicId, clientUserId) = await RegisterClientAsync("inactive");

        // Flags both true — proves the denial comes from IsActive, not the capability flags.
        await CreateLinkAsync(professionalUserId, clientUserId, isActive: false, canViewNutritionPlans: true, canViewTrainingPlans: true);

        await AssertNoAccessAsync(professionalUserId, clientPublicId, clientUserId);
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(true, false)]
    [InlineData(false, true)]
    [InlineData(true, true)]
    public async Task AllSevenMethods_ActiveLink_MatchCapabilityFlags(bool canViewTrainingPlans, bool canViewNutritionPlans)
    {
        var tag = $"active-{canViewTrainingPlans}-{canViewNutritionPlans}";
        var professionalUserId = await RegisterProfessionalAsync(tag);
        var (clientPublicId, clientUserId) = await RegisterClientAsync(tag);

        await CreateLinkAsync(professionalUserId, clientUserId, isActive: true, canViewNutritionPlans, canViewTrainingPlans);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var professionalHelper = new ProfessionalAuthHelper(db);
        var nutritionHelper = new NutritionAuthHelper(db);
        var ct = TestContext.Current.CancellationToken;

        (await professionalHelper.HasActiveLinkAsync(professionalUserId, clientPublicId, ct))
            .Should().Be(canViewTrainingPlans, "ProfessionalAuthHelper.HasActiveLinkAsync gates on CanViewTrainingPlans, not mere presence");

        (await professionalHelper.HasAnyPlanAccessAsync(professionalUserId, clientPublicId, ct))
            .Should().Be(canViewTrainingPlans || canViewNutritionPlans);

        (await professionalHelper.HasPlanAccessForClientUserAsync(professionalUserId, clientUserId, true, ct))
            .Should().Be(canViewTrainingPlans);
        (await professionalHelper.HasPlanAccessForClientUserAsync(professionalUserId, clientUserId, false, ct))
            .Should().Be(canViewNutritionPlans);

        (await professionalHelper.HasPlanAccessAsync(professionalUserId, clientPublicId, true, ct))
            .Should().Be(canViewTrainingPlans);
        (await professionalHelper.HasPlanAccessAsync(professionalUserId, clientPublicId, false, ct))
            .Should().Be(canViewNutritionPlans);

        var trainingAccessibleIds = await professionalHelper.GetAccessibleClientUserIdsAsync(professionalUserId, true, ct);
        if (canViewTrainingPlans)
        {
            trainingAccessibleIds.Should().ContainSingle().Which.Should().Be(clientUserId);
        }
        else
        {
            trainingAccessibleIds.Should().BeEmpty();
        }

        var nutritionAccessibleIds = await professionalHelper.GetAccessibleClientUserIdsAsync(professionalUserId, false, ct);
        if (canViewNutritionPlans)
        {
            nutritionAccessibleIds.Should().ContainSingle().Which.Should().Be(clientUserId);
        }
        else
        {
            nutritionAccessibleIds.Should().BeEmpty();
        }

        var capabilities = await professionalHelper.GetLinkCapabilitiesAsync(professionalUserId, clientPublicId, ct);
        capabilities.Should().NotBeNull();
        capabilities!.Value.CanViewTrainingPlans.Should().Be(canViewTrainingPlans);
        capabilities.Value.CanViewNutritionPlans.Should().Be(canViewNutritionPlans);

        (await nutritionHelper.HasActiveLinkAsync(professionalUserId, clientPublicId, ct))
            .Should().Be(canViewNutritionPlans, "NutritionAuthHelper.HasActiveLinkAsync is the mirror gate on CanViewNutritionPlans");
    }
}
