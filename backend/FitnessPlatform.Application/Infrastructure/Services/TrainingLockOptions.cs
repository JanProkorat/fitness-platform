namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Configuration options for training session lock TTLs.
/// Bind from <c>appsettings.json</c> section <c>"TrainingLock"</c>:
/// <code>
/// "TrainingLock": {
///   "LiveTtlHours": 6,
///   "EditingTtlHours": 2
/// }
/// </code>
/// </summary>
public class TrainingLockOptions
{
    /// <summary>
    /// Configuration section key used for binding via
    /// <c>builder.Services.Configure&lt;TrainingLockOptions&gt;(builder.Configuration.GetSection(SectionName))</c>.
    /// </summary>
    public const string SectionName = "TrainingLock";

    /// <summary>
    /// How many hours a <em>live</em> session lock remains valid without a keep-alive refresh.
    /// Default: 6 hours (covers a typical training session with buffer).
    /// </summary>
    public int LiveTtlHours { get; set; } = 6;

    /// <summary>
    /// How many hours a trainer <em>editing</em> lock remains valid.
    /// Default: 2 hours (shorter — editing is expected to be a short, intentional action).
    /// </summary>
    public int EditingTtlHours { get; set; } = 2;
}
