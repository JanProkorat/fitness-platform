using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Users.DeleteAccount;
using FitnessPlatform.Tests.Builders;
using Microsoft.AspNetCore.Identity;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Users;

public class DeleteAccountEndpointTests
{
    private readonly Guid _userId = Guid.NewGuid();
    private readonly IAuditService _audit = Substitute.For<IAuditService>();

    [Fact]
    public async Task HandleAsync_ValidUser_Returns204()
    {
        var user = EntityBuilder.User.WithId(_userId).WithEmail("test@test.com").Build();

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_userId.ToString()).Returns(user);
        userManager.DeleteAsync(user).Returns(IdentityResult.Success);

        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<DeleteAccountEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            userManager, db, _audit);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<DeleteAccountEndpoint>(userManager, db, _audit);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }

    [Fact]
    public async Task HandleAsync_UserNotFound_Returns404()
    {
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_userId.ToString()).Returns((ApplicationUser?)null);

        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<DeleteAccountEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            userManager, db, _audit);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_WritesAuditLogAfterDeletion()
    {
        var user = EntityBuilder.User.WithId(_userId).WithEmail("test@test.com").Build();

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_userId.ToString()).Returns(user);
        userManager.DeleteAsync(user).Returns(IdentityResult.Success);

        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<DeleteAccountEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            userManager, db, _audit);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        await _audit.Received(1).LogAsync(
            _userId,
            "Delete",
            nameof(ApplicationUser),
            _userId,
            Arg.Any<string?>(),
            Arg.Any<string?>(),
            Arg.Any<string?>(),
            Arg.Any<CancellationToken>());
    }
}
