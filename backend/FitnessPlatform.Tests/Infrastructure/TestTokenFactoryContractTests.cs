using System.IdentityModel.Tokens.Jwt;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Infrastructure.Data;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Infrastructure;

/// <summary>
/// Logs in for real once and asserts <see cref="TestTokenFactory"/>'s minted token has the same
/// claim shape as <c>LoginEndpoint</c>'s real one. This is the drift guard: if
/// <c>LoginEndpoint.HandleAsync</c>'s claim set ever changes, this test goes red before any
/// actor-builder-authenticated test silently starts asserting against a stale token shape.
/// </summary>
[Collection(TestCollection.Name)]
public class TestTokenFactoryContractTests(FitnessApiFactory factory)
{
    [Fact]
    public async Task CreateAccessToken_MatchesRealLoginToken_ClaimShapeAndSignature()
    {
        var http = factory.CreateClient();
        var email = $"{Guid.NewGuid():N}@token-contract-fixture.com";
        await TestHelpers.RegisterAsync(http, email, "TestPass1!", "Token", "Contract", "Trainer");
        var (realToken, _) = await TestHelpers.LoginAsync(http, email, "TestPass1!");

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.FirstAsync(
            u => u.Email == email, TestContext.Current.CancellationToken);

        var mintedToken = TestTokenFactory.CreateAccessToken(factory, user.Id, email, ["Trainer"]);

        var handler = new JwtSecurityTokenHandler();
        var real = handler.ReadJwtToken(realToken);
        var minted = handler.ReadJwtToken(mintedToken);

        real.Header.Alg.Should().Be(minted.Header.Alg, "both must be signed the same way");

        // exp/iat/nbf are inherently time-dependent — everything else must match exactly,
        // both in which claim types appear and what each one's value is.
        var timeDependentClaims = new HashSet<string> { "exp", "iat", "nbf" };

        StableClaims(minted, timeDependentClaims).Should().BeEquivalentTo(
            StableClaims(real, timeDependentClaims),
            "the minted token's claim shape must match LoginEndpoint's real token exactly");
    }

    private static Dictionary<string, List<string>> StableClaims(
        JwtSecurityToken token, HashSet<string> excluded) =>
        token.Claims
            .Where(c => !excluded.Contains(c.Type))
            .GroupBy(c => c.Type)
            .ToDictionary(g => g.Key, g => g.Select(c => c.Value).OrderBy(v => v).ToList());
}
