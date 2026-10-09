using FastEndpoints;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Users.RemoveCoachRole;
using FitnessPlatform.Tests.Builders;
using FluentAssertions;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Users;

public class RemoveCoachRoleEndpointTests
{
    [Fact]
    public async Task HandleAsync_NoUserClaim_Returns401()
    {
        var ep = Factory.Create<RemoveCoachRoleEndpoint>(
            EndpointTestHelpers.CreateFakeUserManager(),
            new MockDbBuilder().Build(),
            Substitute.For<ICoachRoleStatus>(),
            Substitute.For<IAuditService>(),
            TimeProvider.System);

        await ep.HandleAsync(new RemoveCoachRoleRequest { Role = "Trainer" }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }
}
