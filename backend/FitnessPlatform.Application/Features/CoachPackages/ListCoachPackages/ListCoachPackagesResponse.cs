using FitnessPlatform.Application.Features.CoachPackages.Shared;

namespace FitnessPlatform.Application.Features.CoachPackages.ListCoachPackages;

/// <summary>
/// The calling coach's packages.
/// </summary>
public class ListCoachPackagesResponse
{
    /// <summary>Packages, active first, then by name.</summary>
    public List<CoachPackageDto> Items { get; set; } = [];
}
