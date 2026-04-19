using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Features.Users.UpdateTimeZone;
using Microsoft.AspNetCore.Identity;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Users;

/// <summary>
/// Tests for <see cref="UpdateTimeZoneEndpoint"/>.
/// </summary>
public class UpdateTimeZoneEndpointTests
{
    private readonly Guid _userId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_ValidIanaTimeZone_Returns200AndPersists()
    {
        var user = new ApplicationUser
        {
            Id = _userId, Email = "test@test.com", UserName = "test@test.com",
            FirstName = "John", LastName = "Doe",
            TimeZone = "Europe/Prague"
        };

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_userId.ToString()).Returns(user);
        userManager.UpdateAsync(user).Returns(IdentityResult.Success);

        var ep = Factory.Create<UpdateTimeZoneEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            userManager);

        await ep.HandleAsync(new UpdateTimeZoneRequest { TimeZone = "America/New_York" },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        user.TimeZone.Should().Be("America/New_York");
        await userManager.Received(1).UpdateAsync(user);
    }

    [Fact]
    public async Task HandleAsync_InvalidTimeZone_Returns400WithErrorCode()
    {
        var userManager = EndpointTestHelpers.CreateFakeUserManager();

        var ep = Factory.Create<UpdateTimeZoneEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            userManager);

        var act = () => ep.HandleAsync(
            new UpdateTimeZoneRequest { TimeZone = "Not/A/Zone" },
            TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<ValidationFailureException>();
        ep.ValidationFailures.Should().ContainSingle(f => f.ErrorCode == ErrorCodes.InvalidTimeZone);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var userManager = EndpointTestHelpers.CreateFakeUserManager();

        var ep = Factory.Create<UpdateTimeZoneEndpoint>(userManager);

        await ep.HandleAsync(
            new UpdateTimeZoneRequest { TimeZone = "Europe/Prague" },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }

    [Fact]
    public async Task HandleAsync_UserNotFound_Returns404()
    {
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_userId.ToString()).Returns((ApplicationUser?)null);

        var ep = Factory.Create<UpdateTimeZoneEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            userManager);

        await ep.HandleAsync(
            new UpdateTimeZoneRequest { TimeZone = "Europe/Prague" },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Theory]
    [InlineData("Europe/Prague")]
    [InlineData("America/New_York")]
    [InlineData("Asia/Tokyo")]
    [InlineData("UTC")]
    public async Task HandleAsync_WellKnownIanaZones_Return200(string timeZone)
    {
        var user = new ApplicationUser
        {
            Id = _userId, Email = "test@test.com", UserName = "test@test.com",
            FirstName = "John", LastName = "Doe",
            TimeZone = "Europe/Prague"
        };

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_userId.ToString()).Returns(user);
        userManager.UpdateAsync(user).Returns(IdentityResult.Success);

        var ep = Factory.Create<UpdateTimeZoneEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            userManager);

        await ep.HandleAsync(new UpdateTimeZoneRequest { TimeZone = timeZone },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        user.TimeZone.Should().Be(timeZone);
    }
}
