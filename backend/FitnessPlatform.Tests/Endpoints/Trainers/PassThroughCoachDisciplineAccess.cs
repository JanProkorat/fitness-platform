using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;

namespace FitnessPlatform.Tests.Endpoints.Trainers;

/// <summary>
/// Endpoint-unit-test stand-in for <see cref="ICoachDisciplineAccess"/> that leaves the link flags untouched,
/// so a test can focus on the link-driven behaviour. Role narrowing is covered by the integration tests.
/// </summary>
public sealed class PassThroughCoachDisciplineAccess : ICoachDisciplineAccess
{
    /// <summary>Shared instance.</summary>
    public static readonly PassThroughCoachDisciplineAccess Instance = new();

    /// <inheritdoc />
    public Task<LinkCapabilities> GetEffectiveAsync(
        Guid coachUserId, LinkCapabilities linkCapabilities, CancellationToken ct) =>
        Task.FromResult(linkCapabilities);
}
