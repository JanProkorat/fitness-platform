using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Architecture;

/// <summary>
/// Root-cause precondition for #1104's Category A/B test-reduction: proves every
/// FastEndpoints route in the booted host declares either role-based authorization
/// (<c>Roles(...)</c>) or <c>AllowAnonymous()</c>, so per-endpoint "no auth -> 401" and
/// "wrong role -> 403" tests can be safely trimmed to a handful of pipeline canaries
/// without silently losing coverage on an endpoint that regresses to no auth check at all.
/// </summary>
[Collection(TestCollection.Name)]
public class EndpointAuthorizationTests(FitnessApiFactory factory)
{
    /// <summary>
    /// Endpoints that intentionally require only authentication (any authenticated
    /// user, regardless of role) and therefore carry neither <c>Roles(...)</c> nor
    /// <c>AllowAnonymous()</c>. Each entry names the endpoint class that owns the
    /// route so a reviewer can re-verify the exception without re-deriving this list.
    /// Adding to this set is a reviewed exception, not a way to silence a failure.
    /// </summary>
    private static readonly HashSet<(string Method, string Route)> AuthenticatedNoRoleAllowList =
    [
        ("POST", "/auth/logout"), // LogoutEndpoint
        ("POST", "/auth/resend-verification"), // ResendVerificationEndpoint
        ("GET", "/exercises/{ExerciseId}"), // GetExerciseEndpoint
        ("GET", "/exercises/search"), // SearchExercisesEndpoint
        ("GET", "/foods/{FoodId}"), // GetFoodEndpoint
        ("GET", "/foods/search"), // SearchFoodsEndpoint
        ("PUT", "/users/me/avatar"), // ConfirmAvatarEndpoint
        ("DELETE", "/users/me/avatar"), // DeleteAvatarEndpoint
        ("POST", "/users/me/avatar/upload-url"), // GenerateAvatarUploadUrlEndpoint
        ("DELETE", "/users/me"), // DeleteAccountEndpoint
        ("GET", "/users/me"), // GetProfileEndpoint
        ("PUT", "/users/me"), // UpdateProfileEndpoint
        ("PUT", "/users/me/timezone"), // UpdateTimeZoneEndpoint
    ];

    /// <summary>
    /// Enumerates the live ASP.NET Core route table from the booted <see cref="FitnessApiFactory"/>
    /// host and reads each endpoint's <see cref="IAuthorizeData"/> / <see cref="IAllowAnonymous"/>
    /// metadata directly -- no FastEndpoints internals, just the framework's own
    /// <see cref="EndpointDataSource"/>, so it reflects exactly what the ASP.NET Core
    /// authorization middleware will enforce at runtime.
    /// </summary>
    [Fact]
    public void AllEndpoints_DeclareRoleAuthorization_OrAreExplicitlyAllowlisted()
    {
        var dataSource = factory.Services.GetRequiredService<EndpointDataSource>();

        var routeEndpoints = dataSource.Endpoints
            .OfType<RouteEndpoint>()
            .Where(e => e.Metadata.GetMetadata<IHttpMethodMetadata>() is not null)
            // FastEndpoints 8.0.1 registers an internal "_test_url_cache_" GET route at
            // startup to warm up its own route-matching cache -- it is not an application
            // endpoint, carries no FastEndpoints request/response types, and is unreachable
            // by any real client. Confirmed by locating the literal in the FastEndpoints.dll
            // itself (not in Microsoft.AspNetCore.Routing), so this is a framework artifact,
            // not something our Configure() calls produced.
            .Where(e => e.RoutePattern.RawText != "_test_url_cache_")
            .ToList();

        routeEndpoints.Should().NotBeEmpty(
            "the FastEndpoints route table must be populated by the time the host is built");

        var violations = new List<string>();
        var seenAllowListEntries = new HashSet<(string Method, string Route)>();

        foreach (var endpoint in routeEndpoints)
        {
            var route = endpoint.RoutePattern.RawText ?? string.Empty;
            var methods = endpoint.Metadata.GetMetadata<IHttpMethodMetadata>()?.HttpMethods ?? [];
            var isAnonymous = endpoint.Metadata.GetMetadata<IAllowAnonymous>() is not null;
            var hasRoles = endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>()
                .Any(a => !string.IsNullOrWhiteSpace(a.Roles));

            var requiresLogin = endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>().Any();

            foreach (var method in methods)
            {
                if (AuthenticatedNoRoleAllowList.Contains((method, route)))
                {
                    seenAllowListEntries.Add((method, route));

                    // An allow-listed route is exempt from roles only — it must still require a login.
                    if (isAnonymous || !requiresLogin)
                    {
                        violations.Add($"{method} {route} is allow-listed as login-only but does not require a login");
                    }

                    continue;
                }

                if (isAnonymous || hasRoles)
                {
                    continue;
                }

                violations.Add($"{method} {route} ({endpoint.DisplayName})");
            }
        }

        foreach (var (method, route) in AuthenticatedNoRoleAllowList.Except(seenAllowListEntries))
        {
            violations.Add($"{method} {route} is in the allow-list but no longer exists — remove the entry");
        }

        violations.Should().BeEmpty(
            "every endpoint must call Roles(...) or AllowAnonymous(), or be a reviewed exception " +
            "in AuthenticatedNoRoleAllowList -- an endpoint with neither has no enforced access " +
            "control beyond \"is logged in\"");
    }
}
