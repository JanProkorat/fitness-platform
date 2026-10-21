namespace FitnessPlatform.Application.Features.CoachPackages.GetCoachPackage;

/// <summary>
/// Request for reading one coach package.
/// </summary>
public class GetCoachPackageRequest
{
    /// <summary>Route parameter — public id of the package.</summary>
    public Guid PackageId { get; set; }
}
