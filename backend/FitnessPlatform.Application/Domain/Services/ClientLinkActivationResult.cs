using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>Result of <see cref="ClientLinkActivator.ActivateAsync"/>; the link is set for Created and Reactivated.</summary>
/// <param name="Outcome">What happened.</param>
/// <param name="Link">The created or reactivated link, otherwise null.</param>
public readonly record struct ClientLinkActivationResult(ClientLinkActivationOutcome Outcome, ClientProfessionalLink? Link)
{
    /// <summary>True when an already-active link was widened, so the invite counts as accepted but brings no new terms.</summary>
    public bool Extended => Outcome == ClientLinkActivationOutcome.Extended;

    /// <summary>True when the link was created or reactivated, so the invite's terms and events apply.</summary>
    public bool Started => Outcome is ClientLinkActivationOutcome.Created or ClientLinkActivationOutcome.Reactivated;
}
