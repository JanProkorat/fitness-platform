using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.Client.GetClientAppConfig;
using FitnessPlatform.Tests.Builders;
using FluentAssertions;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Client;

/// <summary>
/// Unit tests for <see cref="GetClientAppConfigEndpoint"/>.
/// </summary>
public class GetClientAppConfigEndpointTests
{
    [Fact]
    public async Task HandleAsync_IosSwitchedOff_ReturnsBothFlagsAndNoStoreHeader()
    {
        var options = Substitute.For<IOptionsMonitor<ClientAppOptions>>();
        options.CurrentValue.Returns(new ClientAppOptions { ShowPaymentsOnIos = false });

        var ep = Factory.Create<GetClientAppConfigEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(Guid.NewGuid(), AppRoles.Client))),
            options);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.ShowPaymentsOnIos.Should().BeFalse();
        ep.Response.ShowPaymentsOnAndroid.Should().BeTrue("an unset flag defaults to shown");
        ep.HttpContext.Response.Headers.CacheControl.ToString().Should().Be("no-store");
    }
}
