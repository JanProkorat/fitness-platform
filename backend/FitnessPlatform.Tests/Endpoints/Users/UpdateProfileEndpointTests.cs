using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Users.UpdateProfile;
using Microsoft.AspNetCore.Identity;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Users;

public class UpdateProfileEndpointTests
{
    private readonly Guid _userId = Guid.NewGuid();
    private readonly IAuditService _audit = Substitute.For<IAuditService>();

    [Fact]
    public async Task HandleAsync_ValidRequest_UpdatesNameFields()
    {
        var user = new ApplicationUser
        {
            Id = _userId, Email = "test@test.com", UserName = "test@test.com",
            FirstName = "Old", LastName = "Name"
        };

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_userId.ToString()).Returns(user);
        userManager.UpdateAsync(user).Returns(IdentityResult.Success);

        var ep = Factory.Create<UpdateProfileEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            userManager, _audit);

        await ep.HandleAsync(new UpdateProfileRequest
        {
            FirstName = "New",
            LastName = "Updated"
        }, TestContext.Current.CancellationToken);

        user.FirstName.Should().Be("New");
        user.LastName.Should().Be("Updated");
        user.DateUpdated.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
        await userManager.Received(1).UpdateAsync(user);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        var ep = Factory.Create<UpdateProfileEndpoint>(userManager, _audit);

        await ep.HandleAsync(new UpdateProfileRequest
        {
            FirstName = "New",
            LastName = "Name"
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }

    [Fact]
    public async Task HandleAsync_UserNotFound_Returns404()
    {
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_userId.ToString()).Returns((ApplicationUser?)null);

        var ep = Factory.Create<UpdateProfileEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            userManager, _audit);

        await ep.HandleAsync(new UpdateProfileRequest
        {
            FirstName = "New",
            LastName = "Name"
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_WritesAuditLog()
    {
        var user = new ApplicationUser
        {
            Id = _userId, Email = "test@test.com", UserName = "test@test.com",
            FirstName = "Old", LastName = "Name"
        };

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_userId.ToString()).Returns(user);
        userManager.UpdateAsync(user).Returns(IdentityResult.Success);

        var ep = Factory.Create<UpdateProfileEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            userManager, _audit);

        await ep.HandleAsync(new UpdateProfileRequest
        {
            FirstName = "New",
            LastName = "Updated"
        }, TestContext.Current.CancellationToken);

        await _audit.Received(1).LogAsync(
            _userId,
            "Update",
            nameof(ApplicationUser),
            _userId,
            Arg.Any<string?>(),
            Arg.Is<string?>(s => s != null && s.Contains("Old")),
            Arg.Is<string?>(s => s != null && s.Contains("New")),
            Arg.Any<CancellationToken>());
    }
}
