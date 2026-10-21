using System.Net;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.Client.PushToken;

/// <summary>
/// <c>DELETE /client/push-token</c>: removes the caller's own token only, idempotently.
/// </summary>
[Collection(TestCollection.Name)]
public class RemovePushTokenEndpointTests(FitnessApiFactory factory)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private async Task SeedTokenAsync(Guid userId, string token)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.DevicePushTokens.Add(new DevicePushToken { UserId = userId, Token = token, Platform = "ios" });
        await db.SaveChangesAsync(Ct);
    }

    private async Task<List<Guid>> TokenOwnersAsync(string token)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await db.DevicePushTokens.Where(t => t.Token == token).Select(t => t.UserId).ToListAsync(Ct);
    }

    [Fact]
    public async Task Delete_OwnToken_Returns204_AndRemovesIt()
    {
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        var token = $"ExponentPushToken[{Guid.NewGuid():N}]";
        await SeedTokenAsync(client.UserId, token);

        var response = await client.Http.DeleteAsync($"/client/push-token?token={Uri.EscapeDataString(token)}", Ct);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await TokenOwnersAsync(token)).Should().BeEmpty();
    }

    [Fact]
    public async Task Delete_AnotherUsersToken_Returns204_AndKeepsIt()
    {
        var owner = await TestActors.Client(factory).CreateAsync(Ct);
        var other = await TestActors.Client(factory).CreateAsync(Ct);
        var token = $"ExponentPushToken[{Guid.NewGuid():N}]";
        await SeedTokenAsync(owner.UserId, token);

        var response = await other.Http.DeleteAsync($"/client/push-token?token={Uri.EscapeDataString(token)}", Ct);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await TokenOwnersAsync(token)).Should().Equal(owner.UserId);
    }

    [Fact]
    public async Task Delete_AbsentToken_Returns204()
    {
        var client = await TestActors.Client(factory).CreateAsync(Ct);

        var response = await client.Http.DeleteAsync("/client/push-token?token=ExponentPushToken[never-registered]", Ct);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }
}
