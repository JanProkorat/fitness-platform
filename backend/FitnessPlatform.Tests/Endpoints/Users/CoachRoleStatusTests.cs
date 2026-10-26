using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Tests.Builders;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Users;

public class CoachRoleStatusTests
{
    private readonly UserManager<ApplicationUser> _userManager = EndpointTestHelpers.CreateFakeUserManager();

    [Fact]
    public void ActiveRoles_NoRemovalMarkers_ReturnsBothHeldCoachRoles()
    {
        var roles = CoachRoleStatus.ActiveRoles(
            [AppRoles.Trainer, AppRoles.Nutritionist], new ProfessionalProfile());

        roles.Should().BeEquivalentTo([AppRoles.Trainer, AppRoles.Nutritionist]);
    }

    [Fact]
    public void ActiveRoles_TrainerRemoved_ReturnsOnlyNutritionist()
    {
        var profile = new ProfessionalProfile { TrainerRoleRemovedAt = DateTime.UtcNow };

        var roles = CoachRoleStatus.ActiveRoles([AppRoles.Trainer, AppRoles.Nutritionist], profile);

        roles.Should().Equal(AppRoles.Nutritionist);
    }

    [Fact]
    public void ActiveRoles_NutritionistRemoved_ReturnsOnlyTrainer()
    {
        var profile = new ProfessionalProfile { NutritionistRoleRemovedAt = DateTime.UtcNow };

        var roles = CoachRoleStatus.ActiveRoles([AppRoles.Trainer, AppRoles.Nutritionist], profile);

        roles.Should().Equal(AppRoles.Trainer);
    }

    [Fact]
    public void ActiveRoles_MarkerForRoleNotHeld_IsIgnored()
    {
        var profile = new ProfessionalProfile { NutritionistRoleRemovedAt = DateTime.UtcNow };

        var roles = CoachRoleStatus.ActiveRoles([AppRoles.Trainer], profile);

        roles.Should().Equal(AppRoles.Trainer);
    }

    [Fact]
    public void ActiveRoles_ClientRoleAndNullProfile_ExcludesClientAndKeepsCoachRole()
    {
        var roles = CoachRoleStatus.ActiveRoles([AppRoles.Client, AppRoles.Trainer], null);

        roles.Should().Equal(AppRoles.Trainer);
    }

    [Theory]
    [InlineData(null, new[] { AppRoles.Trainer, AppRoles.Nutritionist }, false, false, LinkCapabilityScope.Both)]
    [InlineData(LinkCapabilityScope.NutritionOnly, new[] { AppRoles.Trainer, AppRoles.Nutritionist }, false, false, LinkCapabilityScope.NutritionOnly)]
    [InlineData(LinkCapabilityScope.TrainingOnly, new[] { AppRoles.Trainer, AppRoles.Nutritionist }, false, false, LinkCapabilityScope.TrainingOnly)]
    [InlineData(LinkCapabilityScope.Both, new[] { AppRoles.Trainer, AppRoles.Nutritionist }, false, true, LinkCapabilityScope.TrainingOnly)]
    [InlineData(LinkCapabilityScope.NutritionOnly, new[] { AppRoles.Trainer, AppRoles.Nutritionist }, false, true, null)]
    [InlineData(null, new[] { AppRoles.Trainer, AppRoles.Nutritionist }, true, true, null)]
    [InlineData(null, new[] { AppRoles.Trainer }, true, false, null)]
    [InlineData(null, new[] { AppRoles.Client }, false, false, null)]
    public void ResolveOfferedScope_ReturnsWhatAcceptWouldGrant(
        LinkCapabilityScope? scope,
        string[] heldRoles,
        bool trainerRemoved,
        bool nutritionistRemoved,
        LinkCapabilityScope? expected)
    {
        var profile = new ProfessionalProfile
        {
            TrainerRoleRemovedAt = trainerRemoved ? DateTime.UtcNow : null,
            NutritionistRoleRemovedAt = nutritionistRemoved ? DateTime.UtcNow : null,
        };

        CoachRoleStatus.ResolveOfferedScope(scope, heldRoles, profile).Should().Be(expected);
    }

    [Theory]
    [InlineData(true, true, LinkCapabilityScope.Both)]
    [InlineData(true, false, LinkCapabilityScope.NutritionOnly)]
    [InlineData(false, true, LinkCapabilityScope.TrainingOnly)]
    [InlineData(false, false, null)]
    public void ScopeFromGrant_MapsFlagsToScope(bool nutrition, bool training, LinkCapabilityScope? expected) =>
        CoachRoleStatus.ScopeFromGrant(nutrition, training).Should().Be(expected);

    [Fact]
    public void SetRemovedAt_ThenNull_MarksAndRestoresRole()
    {
        var profile = new ProfessionalProfile();

        CoachRoleStatus.SetRemovedAt(profile, AppRoles.Trainer, DateTime.UtcNow);
        CoachRoleStatus.IsRemoved(profile, AppRoles.Trainer).Should().BeTrue();
        CoachRoleStatus.IsRemoved(profile, AppRoles.Nutritionist).Should().BeFalse();

        CoachRoleStatus.SetRemovedAt(profile, AppRoles.Trainer, null);
        CoachRoleStatus.IsRemoved(profile, AppRoles.Trainer).Should().BeFalse();
    }

    [Fact]
    public async Task GetActiveRolesAsync_ByUserId_LoadsRolesAndProfile()
    {
        var userId = Guid.NewGuid();
        var user = new ApplicationUser { Id = userId, Email = "dual@test.com", UserName = "dual@test.com" };
        var db = new MockDbBuilder()
            .With(new ProfessionalProfile { UserId = userId, TrainerRoleRemovedAt = DateTime.UtcNow })
            .Build();
        _userManager.FindByIdAsync(userId.ToString()).Returns(user);
        _userManager.GetRolesAsync(user).Returns([AppRoles.Trainer, AppRoles.Nutritionist]);

        var roles = await new CoachRoleStatus(_userManager, db)
            .GetActiveRolesAsync(userId, TestContext.Current.CancellationToken);

        roles.Should().Equal(AppRoles.Nutritionist);
    }

    [Fact]
    public async Task GetActiveRolesAsync_UnknownUser_ReturnsEmpty()
    {
        var db = new MockDbBuilder().Build();
        _userManager.FindByIdAsync(Arg.Any<string>()).Returns((ApplicationUser?)null);

        var roles = await new CoachRoleStatus(_userManager, db)
            .GetActiveRolesAsync(Guid.NewGuid(), TestContext.Current.CancellationToken);

        roles.Should().BeEmpty();
    }
}
