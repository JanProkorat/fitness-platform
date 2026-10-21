namespace FitnessPlatform.Application.Features.CoachPackages.ArchiveCoachPackage;

/// <summary>
/// Request for archiving a coach package.
/// </summary>
public class ArchiveCoachPackageRequest
{
    /// <summary>Route parameter — public id of the package.</summary>
    public Guid PackageId { get; set; }
}
