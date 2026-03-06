using System.Security.Claims;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints;

/// <summary>
/// Helpers for creating mocked dependencies used in FastEndpoints unit tests.
/// </summary>
public static class EndpointTestHelpers
{
    /// <summary>
    /// Creates a substitute UserManager with common default behaviors.
    /// </summary>
    public static UserManager<ApplicationUser> CreateFakeUserManager()
    {
        var store = Substitute.For<IUserStore<ApplicationUser>>();
        return Substitute.For<UserManager<ApplicationUser>>(
            store, null, null, null, null, null, null, null, null);
    }

    /// <summary>
    /// Returns claims representing an authenticated user with the given userId and role.
    /// </summary>
    public static Claim[] FakeUserClaims(Guid userId, string role = AppRoles.Client)
    {
        return
        [
            new Claim(AppClaims.UserId, userId.ToString()),
            new Claim(AppClaims.Email, "test@test.com"),
            new Claim(ClaimTypes.Role, role)
        ];
    }
}
