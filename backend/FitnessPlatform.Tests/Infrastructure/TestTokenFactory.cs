using FastEndpoints.Security;
using FitnessPlatform.Application.Domain.Constants;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Infrastructure;

/// <summary>
/// Mints an access JWT with exactly the claims/signing key/expiry shape
/// <c>LoginEndpoint.HandleAsync</c> produces, without the HTTP register+login round trip.
/// </summary>
/// <remarks>
/// This is test-only control flow that duplicates production token-minting code by design (the
/// maintainer chose a test-side token over refactoring the 5 endpoints that mint JWTs inline).
/// The duplication is guarded by <see cref="TestTokenFactoryContractTests"/>, which logs in for
/// real once and asserts the claim shape here still matches — if <c>LoginEndpoint</c>'s claims
/// change, that test goes red and this factory must be updated to match.
/// </remarks>
public static class TestTokenFactory
{
    /// <summary>
    /// Creates a bearer access token for the given user, matching <c>LoginEndpoint</c>'s
    /// signing key, expiry, and claim set (<see cref="AppClaims.UserId"/>,
    /// <see cref="AppClaims.Email"/>, plus one role claim per entry in <paramref name="roles"/>).
    /// </summary>
    public static string CreateAccessToken(
        FitnessApiFactory factory, Guid userId, string email, IEnumerable<string> roles)
    {
        var config = factory.Services.GetRequiredService<IConfiguration>();
        var expiresAt = DateTime.UtcNow.AddMinutes(
            config.GetValue(ConfigKeys.JwtAccessTokenExpirationMinutes, 15));

        return JwtBearer.CreateToken(o =>
        {
            o.SigningKey = config[ConfigKeys.JwtSecret]!;
            o.ExpireAt = expiresAt;
            o.User.Roles.AddRange(roles);
            o.User.Claims.Add((AppClaims.UserId, userId.ToString()));
            o.User.Claims.Add((AppClaims.Email, email));
        });
    }
}
