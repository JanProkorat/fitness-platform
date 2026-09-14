namespace FitnessPlatform.Application.Infrastructure.Cli;

/// <summary>
/// The one-shot CLI operations that run instead of the web host:
/// <c>--seed</c>, <c>--qa-seed</c>, <c>--backfill-photo-descriptions</c>,
/// <c>--drop-legacy-training-collections</c>, and
/// <c>--rename-trainer-notes-collection</c>.
/// </summary>
internal enum CliCommand
{
    /// <summary>No one-shot flag present — proceed to normal web-host startup.</summary>
    None,
    Seed,
    QaSeed,
    BackfillPhotoDescriptions,
    DropLegacyTrainingCollections,
    RenameTrainerNotesCollection,
}
