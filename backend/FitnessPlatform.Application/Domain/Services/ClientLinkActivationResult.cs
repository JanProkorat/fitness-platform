using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>Result of <see cref="ClientLinkActivator.ActivateAsync"/>; the link is set for Created, Reactivated and Extended.</summary>
/// <param name="Outcome">What happened.</param>
/// <param name="Link">The created, reactivated or widened link, otherwise null.</param>
/// <param name="GrantedScope">
/// The plan types this activation granted: the whole grant for a created or reactivated link, only the added
/// part for a widened one. Null when nothing was granted.
/// </param>
public readonly record struct ClientLinkActivationResult(
    ClientLinkActivationOutcome Outcome,
    ClientProfessionalLink? Link,
    LinkCapabilityScope? GrantedScope = null)
{
    /// <summary>True when an already-active link was widened, so the invite counts as accepted but brings no new terms.</summary>
    public bool Extended => Outcome == ClientLinkActivationOutcome.Extended;

    /// <summary>True when the link was created or reactivated, so the invite's terms and events apply.</summary>
    public bool Started => Outcome is ClientLinkActivationOutcome.Created or ClientLinkActivationOutcome.Reactivated;

    /// <summary>Maps a pair of plan-view flags to the scope that names them, or null when neither is set.</summary>
    /// <param name="nutrition">Nutrition plans are covered.</param>
    /// <param name="training">Training plans are covered.</param>
    public static LinkCapabilityScope? ScopeOf(bool nutrition, bool training) => (nutrition, training) switch
    {
        (true, true) => LinkCapabilityScope.Both,
        (true, false) => LinkCapabilityScope.NutritionOnly,
        (false, true) => LinkCapabilityScope.TrainingOnly,
        _ => null,
    };
}
