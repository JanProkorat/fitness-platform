using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Messaging.GetMessages;

/// <summary>
/// Returns paginated messages for a conversation.
/// </summary>
/// <param name="db">Relational database context.</param>
/// <param name="blobStorage">Signs each message's stored image key into a short-lived read URL.</param>
public class GetMessagesEndpoint(IApplicationDbContext db, IBlobStorageService blobStorage)
    : Endpoint<GetMessagesRequest, GetMessagesResponse>
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
            .OrderByDescending(m => m.DateCreated)
            .ThenByDescending(m => m.Id);

        if (req.Cursor.HasValue)
        {
            var cursorMsg = await db.ChatMessages
                .AsNoTracking()
                .FirstOrDefaultAsync(m => m.PublicId == req.Cursor.Value, ct);

            if (cursorMsg is not null)
            {
                var cursorDate = cursorMsg.DateCreated;
                var cursorId = cursorMsg.Id;
                query = (IOrderedQueryable<Domain.Entities.ChatMessage>)query
                    .Where(m => m.DateCreated < cursorDate ||
                                (m.DateCreated == cursorDate && m.Id < cursorId));
            }
        }

        var rows = await query
            .Take(limit)
            .Select(m => new MessageRow
            {
                Id = m.PublicId,
                SenderId = m.SenderUserId,
                Text = m.Text,
                Timestamp = m.DateCreated,
                IsRead = m.IsRead,
                ImageBlobUrl = m.ImageBlobUrl,
                ImageWidth = m.ImageWidth,
                ImageHeight = m.ImageHeight,
            })
            .ToListAsync(ct);

        // Sign each stored image key into a fresh, short-lived read URL — never surface
        // ImageBlobUrl (the permanent, unsigned identity value) to the client.
        var items = new List<MessageDto>(rows.Count);
        foreach (var row in rows)
        {
            items.Add(new MessageDto
            {
                Id = row.Id,
                SenderId = row.SenderId,
                Text = row.Text,
                Timestamp = row.Timestamp,
                IsRead = row.IsRead,
                ImageUrl = row.ImageBlobUrl is not null
                    ? await blobStorage.GenerateReadUrlAsync(row.ImageBlobUrl, ct) ?? string.Empty
                    : null,
                ImageWidth = row.ImageWidth,
                ImageHeight = row.ImageHeight,
            });
        }

        Guid? nextCursor = null;
        if (items.Count == limit)
            nextCursor = items[^1].Id;

        await Send.OkAsync(new GetMessagesResponse { Items = items, Cursor = nextCursor }, ct);
    }

    /// <summary>Internal EF projection shape — carries the raw, unsigned <c>ImageBlobUrl</c> before signing.</summary>
    private sealed class MessageRow
    {
        public Guid Id { get; set; }
        public Guid SenderId { get; set; }
        public string Text { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; }
        public bool IsRead { get; set; }
        public string? ImageBlobUrl { get; set; }
        public int? ImageWidth { get; set; }
        public int? ImageHeight { get; set; }
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

    /// <summary>Short-lived signed URL for the image attachment, or null for a text-only message.</summary>
    public string? ImageUrl { get; set; }

    public int? ImageWidth { get; set; }
    public int? ImageHeight { get; set; }
}
