using FormUp.Application.Features.CoachPackages.Shared;

namespace FormUp.Application.Features.CoachPackages.CreateCoachPackage;

/// <summary>
/// Validates the <see cref="CreateCoachPackageRequest"/> with the shared package input rules.
/// </summary>
public class CreateCoachPackageValidator : CoachPackageInputValidator<CreateCoachPackageRequest>;
