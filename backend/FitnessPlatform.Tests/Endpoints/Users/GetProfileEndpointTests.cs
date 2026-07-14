using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Features.Users.GetProfile;
using FitnessPlatform.Tests.Builders;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Users;

public class GetProfileEndpointTests
{
    private readonly Guid _userId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_AuthenticatedUser_ReturnsProfile()
    {
        var user = new ApplicationUser
        {
            Id = _userId, Email = "test@test.com", UserName = "test@test.com",
            FirstName = "John", LastName = "Doe"
        };

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_userId.ToString()).Returns(user);
        userManager.GetRolesAsync(user).Returns(["Client"]);

        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<GetProfileEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            userManager, db);

        await ep.HandleAsync(CancellationToken.None);

        ep.Response.Email.Should().Be("test@test.com");
        ep.Response.FirstName.Should().Be("John");
        ep.Response.LastName.Should().Be("Doe");
        ep.Response.Roles.Should().Contain("Client");
        ep.Response.TimeZone.Should().Be("Europe/Prague");
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<GetProfileEndpoint>(userManager, db);

        await ep.HandleAsync(CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }

    [Fact]
    public async Task HandleAsync_UserNotInDb_Returns404()
    {
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_userId.ToString()).Returns((ApplicationUser?)null);

        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<GetProfileEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            userManager, db);

        await ep.HandleAsync(CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task ClientUser_ReturnsIsOnboardingComplete_False()
    {
        var user = new ApplicationUser
        {
            Id = _userId, Email = "test@test.com", UserName = "test@test.com",
            FirstName = "John", LastName = "Doe"
        };

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_userId.ToString()).Returns(user);
        userManager.GetRolesAsync(user).Returns(new List<string> { "Client" });

        var clientProfile = EntityBuilder.ClientProfile.WithUserId(_userId).Build();
        var db = new MockDbBuilder().With(clientProfile).Build();

        var ep = Factory.Create<GetProfileEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            userManager, db);

        await ep.HandleAsync(CancellationToken.None);

        ep.Response.IsOnboardingComplete.Should().BeFalse();
    }

    [Fact]
    public async Task ClientUser_WithCompletedOnboarding_ReturnsTrue()
    {
        var user = new ApplicationUser
        {
            Id = _userId, Email = "test@test.com", UserName = "test@test.com",
            FirstName = "John", LastName = "Doe"
        };

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_userId.ToString()).Returns(user);
        userManager.GetRolesAsync(user).Returns(new List<string> { "Client" });

        var clientProfile = EntityBuilder.ClientProfile.WithUserId(_userId).Build();
        clientProfile.IsOnboardingComplete = true;
        var db = new MockDbBuilder().With(clientProfile).Build();

        var ep = Factory.Create<GetProfileEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            userManager, db);

        await ep.HandleAsync(CancellationToken.None);

        ep.Response.IsOnboardingComplete.Should().BeTrue();
    }

    /// <summary>
    /// Regression test for #771 — a client linked to a professional who holds BOTH
    /// Trainer and Nutritionist identity roles must see BOTH roles in LinkedRoles
    /// (drives which tabs the mobile app unlocks), not a single tie-broken role.
    /// </summary>
    [Fact]
    public async Task ClientUser_LinkedToDualRoleProfessional_ReturnsBothRolesInLinkedRoles()
    {
        var user = new ApplicationUser
        {
            Id = _userId, Email = "test@test.com", UserName = "test@test.com",
            FirstName = "John", LastName = "Doe"
        };

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_userId.ToString()).Returns(user);
        userManager.GetRolesAsync(user).Returns(new List<string> { "Client" });

        var clientProfile = EntityBuilder.ClientProfile.WithUserId(_userId).WithId(1).Build();
        var professionalProfile = EntityBuilder.ProfessionalProfile.WithId(1).Build();

        var link = EntityBuilder.ClientProfessionalLink
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(professionalProfile)
            .WithCanViewTrainingPlans(true)
            .WithCanViewNutritionPlans(true)
            .Build();

        var db = new MockDbBuilder().With(clientProfile).With(link).Build();

        var ep = Factory.Create<GetProfileEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            userManager, db);

        await ep.HandleAsync(CancellationToken.None);

        ep.Response.HasActiveLink.Should().BeTrue();
        ep.Response.LinkedRoles.Should().BeEquivalentTo(["Trainer", "Nutritionist"]);
    }

    /// <summary>
    /// Single-role professional (Trainer only) — unaffected by the fix, preserves
    /// prior single-role behavior.
    /// </summary>
    [Fact]
    public async Task ClientUser_LinkedToTrainerOnlyProfessional_ReturnsSingleRole()
    {
        var user = new ApplicationUser
        {
            Id = _userId, Email = "test@test.com", UserName = "test@test.com",
            FirstName = "John", LastName = "Doe"
        };

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_userId.ToString()).Returns(user);
        userManager.GetRolesAsync(user).Returns(new List<string> { "Client" });

        var clientProfile = EntityBuilder.ClientProfile.WithUserId(_userId).WithId(1).Build();
        var professionalProfile = EntityBuilder.ProfessionalProfile.WithId(1).Build();

        var link = EntityBuilder.ClientProfessionalLink
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(professionalProfile)
            .WithCanViewTrainingPlans(true)
            .WithCanViewNutritionPlans(false)
            .Build();

        var db = new MockDbBuilder().With(clientProfile).With(link).Build();

        var ep = Factory.Create<GetProfileEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            userManager, db);

        await ep.HandleAsync(CancellationToken.None);

        ep.Response.LinkedRoles.Should().BeEquivalentTo(["Trainer"]);
    }

    [Fact]
    public async Task NonClientUser_ReturnsIsOnboardingComplete_Null()
    {
        var user = new ApplicationUser
        {
            Id = _userId, Email = "test@test.com", UserName = "test@test.com",
            FirstName = "John", LastName = "Doe"
        };

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_userId.ToString()).Returns(user);
        userManager.GetRolesAsync(user).Returns(new List<string> { "Trainer" });

        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<GetProfileEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId, AppRoles.Trainer))),
            userManager, db);

        await ep.HandleAsync(CancellationToken.None);

        ep.Response.IsOnboardingComplete.Should().BeNull();
    }
}
