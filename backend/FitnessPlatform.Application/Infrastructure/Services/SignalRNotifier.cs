using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace FitnessPlatform.Application.Infrastructure.Services;

public class SignalRNotifier(IHubContext<NotificationHub> hubContext) : IRealtimeNotifier
{
    public async Task NotifyAsync(Guid userId, string eventType, object payload, CancellationToken ct = default)
    {
        await hubContext.Clients.Group(userId.ToString()).SendAsync(eventType, payload, ct);
    }
}
