using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Features.ClientTags.DeleteClientTag;
using FitnessPlatform.Tests.Builders;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.ClientTags;

/// <summary>
/// Unit tests for <see cref="DeleteClientTagEndpoint"/> covering the concurrent-delete race,
/// where <c>SaveChangesAsync</c> throws because another request already removed the same row.
/// </summary>
public class DeleteClientTagEndpointUnitTests
{
    [Fact]
    public async Task HandleAsync_ConcurrentDeleteAlreadyRemovedRow_Returns204()
    {
        var trainerId = Guid.NewGuid();
        var trainerProfile = new ProfessionalProfile { Id = 1, PublicId = Guid.NewGuid(), UserId = trainerId };
        var tag = new ClientTag
        {
            PublicId = Guid.NewGuid(),
            OwnerProfessionalProfileId = trainerProfile.Id,
            Name = "VIP",
            ColorHex = "#3b82f6"
        };

        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(tag)
            .Build();

        db.SaveChangesAsync(Arg.Any<CancellationToken>())
            .Returns<int>(_ => throw new DbUpdateConcurrencyException());

        var ep = Factory.Create<DeleteClientTagEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(trainerId, AppRoles.Trainer))),
            db);

        await ep.HandleAsync(new DeleteClientTagRequest { TagId = tag.PublicId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);
        db.ClientTags.Received(1).Remove(tag);
        await db.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
