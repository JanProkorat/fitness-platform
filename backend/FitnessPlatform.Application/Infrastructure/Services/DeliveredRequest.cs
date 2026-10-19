using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// A request an automation run delivered, as <see cref="AutomationDeliveryTracker"/> needs it to find the answer.
/// </summary>
/// <param name="Action">What the rule asked of the client.</param>
/// <param name="DeliveredEntityId">Public id of what the run delivered.</param>
/// <param name="SentAt">When the request was sent (UTC).</param>
/// <param name="ClientProfileId">Internal id of the client profile.</param>
public readonly record struct DeliveredRequest(
    AutomationActionType Action,
    Guid? DeliveredEntityId,
    DateTime? SentAt,
    long ClientProfileId);
