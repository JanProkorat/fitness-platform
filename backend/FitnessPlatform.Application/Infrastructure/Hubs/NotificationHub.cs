using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Infrastructure.Hubs;

[Authorize]
public class NotificationHub(
    PresenceTracker presence,
    IServiceScopeFactory scopeFactory) : Hub
{
    public override async Task OnConnectedAsync()
    {
        var userId = Context.User?.FindFirst(AppClaims.UserId)?.Value;
        if (userId is not null)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, userId);
            presence.UserConnected(userId);
            await BroadcastPresenceAsync(userId, true);
        }
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.User?.FindFirst(AppClaims.UserId)?.Value;
        if (userId is not null)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, userId);
            presence.UserDisconnected(userId);
            if (!presence.IsOnline(userId))
            {
                await BroadcastPresenceAsync(userId, false);
            }
        }
        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Called by clients to notify the other participant that they are typing.
    /// </summary>
    public async Task SendTyping(string conversationId)
    {
        var userId = Context.User?.FindFirst(AppClaims.UserId)?.Value;
        if (userId is null) return;

        var userGuid = Guid.Parse(userId);

        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();

        var conversation = await db.Conversations
            .AsNoTracking()
            .FirstOrDefaultAsync(c =>
                c.PublicId == Guid.Parse(conversationId) &&
                (c.ProfessionalUserId == userGuid || c.ClientUserId == userGuid));

        if (conversation is null) return;

        var recipientId = conversation.ProfessionalUserId == userGuid
            ? conversation.ClientUserId
            : conversation.ProfessionalUserId;

        await Clients.Group(recipientId.ToString()).SendAsync("typing", new
        {
            conversationId,
            senderId = userId,
        });
    }

    /// <summary>
    /// Notify all conversation partners about a user's online/offline status.
    /// </summary>
    private async Task BroadcastPresenceAsync(string userId, bool isOnline)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();

        var userGuid = Guid.Parse(userId);

        // Find all conversation partners
        var partnerIds = await db.Conversations
            .AsNoTracking()
            .Where(c => c.ProfessionalUserId == userGuid || c.ClientUserId == userGuid)
            .Select(c => c.ProfessionalUserId == userGuid ? c.ClientUserId : c.ProfessionalUserId)
            .Distinct()
            .ToListAsync();

        var payload = new { userId, isOnline };

        foreach (var partnerId in partnerIds)
        {
            await Clients.Group(partnerId.ToString()).SendAsync("userPresence", payload);
        }
    }
}
