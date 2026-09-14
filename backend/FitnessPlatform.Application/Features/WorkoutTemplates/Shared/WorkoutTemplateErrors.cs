namespace FitnessPlatform.Application.Features.WorkoutTemplates.Shared;

/// <summary>
/// The workout-template feature's single pinned 404 denial message. Used identically for a
/// genuinely-missing template and for another trainer's template, so the two are byte-for-byte
/// indistinguishable — per the doctrine documented in
/// <see cref="FitnessPlatform.Application.Domain.Extensions.LibraryDenialExtensions"/>'s class
/// remarks. WorkoutTemplate is deliberately private-only (keyed on <c>OwnerTrainerId</c>, no
/// <c>Visibility</c>) and does not implement <c>ILibraryDocument</c>, so it cannot use
/// <see cref="FitnessPlatform.Application.Domain.Extensions.LibraryDenial"/> or
/// <see cref="FitnessPlatform.Application.Domain.Extensions.LibraryDenialExtensions"/> directly —
/// this is the slice-local equivalent for the one denial outcome this feature needs.
/// </summary>
internal static class WorkoutTemplateErrors
{
    /// <summary>
    /// The detail message shared by the missing-template and not-owned-template 404 responses.
    /// </summary>
    internal const string NotFoundDetail = "Workout template not found.";
}
