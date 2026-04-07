using System.Collections.Concurrent;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Tracks which users are currently connected via SignalR.
/// Registered as a singleton — survives across requests.
/// </summary>
public class PresenceTracker
{
    private readonly ConcurrentDictionary<string, int> _connections = new();

    public void UserConnected(string userId)
    {
        _connections.AddOrUpdate(userId, 1, (_, count) => count + 1);
    }

    public void UserDisconnected(string userId)
    {
        _connections.AddOrUpdate(userId, 0, (_, count) => Math.Max(0, count - 1));
        // Clean up zero entries
        if (_connections.TryGetValue(userId, out var c) && c <= 0)
            _connections.TryRemove(userId, out _);
    }

    public bool IsOnline(string userId) => _connections.ContainsKey(userId);

    public bool IsOnline(Guid userId) => IsOnline(userId.ToString());
}
