namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Indicates the direction a client's weight is moving relative to their target.
/// </summary>
public enum WeightDirection
{
    /// <summary>
    /// Weight is moving toward the client's target weight.
    /// </summary>
    Towards,

    /// <summary>
    /// Weight is moving away from the client's target weight.
    /// </summary>
    Away,

    /// <summary>
    /// Weight change is negligible (within ±0.5 kg) or no target/measurements available.
    /// </summary>
    Stable
}
