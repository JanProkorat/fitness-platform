using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Messaging.GetMessages;

/// <summary>
/// Returns paginated messages for a conversation.
/// </summary>
public class GetMessagesEndpoint(IApplicationDbContext db) : Endpoint<GetMessagesRequest, GetMessagesResponse>
{
    public override void Configure()
    {
        Get("/conversations/{ConversationId}/messages");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist, AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get conversation messages";
            s.Description = "Returns messages for a conversation with cursor-based pagination.";
        });
    }

    public override async Task HandleAsync(GetMessagesRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }

        var userGuid = Guid.Parse(userId);

        // Verify user is a participant
        var conversation = await db.Conversations
            .AsNoTracking()
            .FirstOrDefaultAsync(c =>
                c.PublicId == req.ConversationId &&
                (c.ProfessionalUserId == userGuid || c.ClientUserId == userGuid), ct);

        if (conversation is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var limit = req.Limit is > 0 and <= 50 ? req.Limit.Value : 30;

        var query = db.ChatMessages
            .AsNoTracking()
            .Where(m => m.ConversationId == conversation.Id)
            .OrderByDescending(m => m.DateCreated);

        if (req.Cursor.HasValue)
        {
            var cursorMsg = await db.ChatMessages
                .AsNoTracking()
                .FirstOrDefaultAsync(m => m.PublicId == req.Cursor.Value, ct);

            if (cursorMsg is not null)
                query = (IOrderedQueryable<Domain.Entities.ChatMessage>)query
                    .Where(m => m.DateCreated < cursorMsg.DateCreated);
        }

        var items = await query
            .Take(limit)
            .Select(m => new MessageDto
            {
                Id = m.PublicId,
                SenderId = m.SenderUserId,
                Text = m.Text,
                Timestamp = m.DateCreated,
                IsRead = m.IsRead,
            })
            .ToListAsync(ct);

        Guid? nextCursor = null;
        if (items.Count == limit)
            nextCursor = items[^1].Id;

        await Send.OkAsync(new GetMessagesResponse { Items = items, Cursor = nextCursor }, ct);
    }
}

public class GetMessagesRequest
{
    public Guid ConversationId { get; set; }
    [QueryParam] public int? Limit { get; set; }
    [QueryParam] public Guid? Cursor { get; set; }
}

public class GetMessagesResponse
{
    public List<MessageDto> Items { get; set; } = [];
    public Guid? Cursor { get; set; }
}

public class MessageDto
{
    public Guid Id { get; set; }
    public Guid SenderId { get; set; }
    public string Text { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public bool IsRead { get; set; }
}
