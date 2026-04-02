namespace FitnessPlatform.Application.Domain.Interfaces;

public interface IRealtimeNotifier
{
    Task NotifyAsync(Guid userId, string eventType, object payload, CancellationToken ct = default);
}
