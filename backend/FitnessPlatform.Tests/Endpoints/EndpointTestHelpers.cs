using System.Security.Claims;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Services;
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

    /// <summary>
    /// A <see cref="ProfessionalAuthHelper"/> substitute that grants every link capability.
    /// </summary>
    /// <remarks>
    /// Plan-addressed endpoints authorize on the caller's live <c>ClientProfessionalLink</c>, not
    /// on the plan document's author field. A unit test whose subject is something else —
    /// response mapping, optimistic concurrency, lock state, macro totals — injects this so it
    /// keeps testing its own subject instead of silently becoming an authorization test. The
    /// authorization behaviour itself is covered end-to-end against the real API by
    /// <c>PlanLinkRevocationTests</c>, where the link is a real row that can be deactivated.
    /// </remarks>
    /// <param name="hasAccess">Whether the simulated link grants the capability being asked about.</param>
    /// <param name="accessibleClientUserIds">
    /// What <see cref="ProfessionalAuthHelper.GetAccessibleClientUserIdsAsync"/> returns — only
    /// consulted by the plan LIST routes, whose unit tests mock the Mongo collection and so never
    /// evaluate the resulting filter.
    /// </param>
    public static ProfessionalAuthHelper CreateGrantingAuthHelper(
        bool hasAccess = true, params Guid[] accessibleClientUserIds)
    {
        var db = Substitute.For<IApplicationDbContext>();
        var helper = Substitute.For<ProfessionalAuthHelper>(db);

        helper.HasActiveLinkAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(hasAccess);
        helper.HasAnyPlanAccessAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(hasAccess);
        helper.HasPlanAccessAsync(
                Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<bool>(), Arg.Any<CancellationToken>())
            .Returns(hasAccess);
        helper.HasPlanAccessForClientUserAsync(
                Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<bool>(), Arg.Any<CancellationToken>())
            .Returns(hasAccess);
        helper.GetAccessibleClientUserIdsAsync(
                Arg.Any<Guid>(), Arg.Any<bool>(), Arg.Any<CancellationToken>())
            .Returns((IReadOnlyList<Guid>)accessibleClientUserIds.ToList());

        return helper;
    }
}
