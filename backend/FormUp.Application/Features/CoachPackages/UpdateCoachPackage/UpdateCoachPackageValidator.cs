using FormUp.Application.Features.CoachPackages.Shared;

namespace FormUp.Application.Features.CoachPackages.UpdateCoachPackage;

/// <summary>
/// Validates the <see cref="UpdateCoachPackageRequest"/> with the shared package input rules.
/// </summary>
public class UpdateCoachPackageValidator : CoachPackageInputValidator<UpdateCoachPackageRequest>;
