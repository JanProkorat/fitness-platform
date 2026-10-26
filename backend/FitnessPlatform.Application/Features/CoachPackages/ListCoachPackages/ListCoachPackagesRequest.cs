namespace FitnessPlatform.Application.Features.CoachPackages.ListCoachPackages;

/// <summary>
/// Query for listing the calling coach's packages.
/// </summary>
public class ListCoachPackagesRequest
{
    /// <summary>Whether archived packages are included; defaults to false.</summary>
    public bool IncludeArchived { get; set; }
}
