namespace FitnessPlatform.Application.Infrastructure.Cli;

/// <summary>
/// The one-shot CLI operations that run instead of the web host:
/// <c>--seed</c>, <c>--qa-seed</c>, <c>--backfill-photo-descriptions</c>, and
/// <c>--backfill-plan-goals</c>.
/// </summary>
internal enum CliCommand
{
    /// <summary>No one-shot flag present — proceed to normal web-host startup.</summary>
    None,
    Seed,
    QaSeed,
    BackfillPhotoDescriptions,
    BackfillPlanGoals,
}
