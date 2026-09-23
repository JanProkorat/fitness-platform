using System.Security.Claims;
using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Messaging.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Messaging.SendMessage;

/// <summary>
/// Sends a message in a conversation. Creates the conversation if it doesn't exist yet.
/// A message carries text, an image, or both — <see cref="SendMessageRequest.ImageUploadId"/>
/// references a staged upload from <c>GenerateChatImageUploadUrlEndpoint</c>; the server
/// rebuilds the staging path itself and never trusts a client-supplied blob URL.
/// </summary>
/// <param name="db">Relational database context.</param>
/// <param name="notifier">Realtime notifier — pushes the <c>newmessage</c> event.</param>
/// <param name="blobStorage">
/// Blob storage — downloads and sniffs a staged image before promoting it to a permanent
/// object, and signs the final <c>ImageUrl</c> echoed back in the response.
/// </param>
public class SendMessageEndpoint(
    IApplicationDbContext db,
    IRealtimeNotifier notifier,
    IBlobStorageService blobStorage) : Endpoint<SendMessageRequest, SendMessageResponse>
{
    public override void Configure()
    {
        Post("/conversations/{ConversationId}/messages");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist, AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Send a message";
            s.Description = "Sends a text message, an image, or both, in a conversation.";
        });
    }

    public override async Task HandleAsync(SendMessageRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }

        var userGuid = Guid.Parse(userId);

        // Verify user is a participant
        var conversation = await db.Conversations
            .FirstOrDefaultAsync(c =>
                c.PublicId == req.ConversationId &&
                (c.ProfessionalUserId == userGuid || c.ClientUserId == userGuid), ct);

        if (conversation is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        string? imageBlobUrl = null;
        string? imageContentType = null;
        long? imageSizeBytes = null;
        Guid? messageId = null;

        if (req.ImageUploadId.HasValue)
        {
            var stagingPath = ChatImagePolicy.BuildStagingContainerPath(
                req.ConversationId, userGuid, req.ImageUploadId.Value);

            var staged = await blobStorage.DownloadAsync(stagingPath, ImageUploadService.MaxImageSizeBytes, ct);

            if (staged is null)
            {
                await this.SendProblemAsync(400, ErrorCodes.ChatImageUploadNotFound,
                    "No staged image upload found for this uploadId.", ct);
                return;
            }

            if (staged.Data is null)
            {
                // Stat-only result: the actual object exceeds the cap despite a compliant
                // declared size at upload-url time — a presigned PUT enforces neither.
                await blobStorage.DeleteAsync(stagingPath, ct);
                await this.SendProblemAsync(413, ErrorCodes.ImageTooLarge,
                    "Staged image exceeds the maximum allowed size.", ct);
                return;
            }

            var sniffedContentType = ChatImagePolicy.SniffContentType(staged.Data);
            if (sniffedContentType is null)
            {
                await blobStorage.DeleteAsync(stagingPath, ct);
                await this.SendProblemAsync(400, ErrorCodes.InvalidImageContentType,
                    "Staged file is not a recognized jpeg/png/webp image.", ct);
                return;
            }

            // Assigned up front (not left to ApplyTimestamps) so the final blob key can be built
            // before the ChatMessage row exists.
            messageId = Guid.NewGuid();
            var finalPath = ChatImagePolicy.BuildFinalContainerPath(
                req.ConversationId, messageId.Value, ChatImagePolicy.ExtensionFor(sniffedContentType));

            await blobStorage.UploadAsync(finalPath, staged.Data, sniffedContentType, ct);
            await blobStorage.DeleteAsync(stagingPath, ct);

            // Store the full public-URL form, not the bare container path — every other caller
            // of GenerateReadUrlAsync (e.g. GetPlanPhotosEndpoint) stores BuildPublicUrl's output,
            // and GenerateReadUrlAsync's TryExtractContainerPath reverses exactly that form. A
            // bare path fails the prefix match and GenerateReadUrlAsync fails closed to
            // string.Empty for every chat image (see MinioBlobStorageServiceTests for the
            // round-trip contract this depends on).
            imageBlobUrl = blobStorage.BuildPublicUrl(finalPath);
            imageContentType = sniffedContentType;
            imageSizeBytes = staged.SizeBytes;
        }

        var hasImage = imageBlobUrl is not null;

        var message = new ChatMessage
        {
            PublicId = messageId ?? Guid.Empty,
            ConversationId = conversation.Id,
            SenderUserId = userGuid,
            Text = req.Text.Trim(),
            IsRead = false,
            ImageBlobUrl = imageBlobUrl,
            ImageContentType = imageContentType,
            ImageSizeBytes = imageSizeBytes,
            ImageWidth = hasImage ? req.ImageWidth : null,
            ImageHeight = hasImage ? req.ImageHeight : null,
        };

        db.ChatMessages.Add(message);

        // Update conversation preview
        conversation.LastMessageText = message.Text.Length > 300
            ? message.Text[..300]
            : message.Text;
        conversation.LastMessageAt = DateTime.UtcNow;
        conversation.LastMessageSenderId = userGuid;
        conversation.LastMessageHasImage = hasImage;

        await db.SaveChangesAsync(ct);

        // Get sender name for notification
        var sender = await db.Users.AsNoTracking()
            .Where(u => u.Id == userGuid)
            .Select(u => new { u.FirstName, u.LastName })
            .FirstAsync(ct);

        var senderName = $"{sender.FirstName} {sender.LastName}";

        // Determine recipient
        var recipientUserId = conversation.ProfessionalUserId == userGuid
            ? conversation.ClientUserId
            : conversation.ProfessionalUserId;

        // Auto-unarchive for recipient (unless former collaboration)
        bool autoUnarchived = false;
        if (!conversation.IsFormer)
        {
            if (conversation.ProfessionalUserId == userGuid && conversation.ArchivedByClientAt != null)
            {
                conversation.ArchivedByClientAt = null;
                autoUnarchived = true;
            }
            else if (conversation.ClientUserId == userGuid && conversation.ArchivedByProfessionalAt != null)
            {
                conversation.ArchivedByProfessionalAt = null;
                autoUnarchived = true;
            }

            if (autoUnarchived)
            {
                await db.SaveChangesAsync(ct);
                await notifier.NotifyAsync(recipientUserId, "conversationunarchived", new
                {
                    conversationId = conversation.PublicId,
                    isFormer = false,
                }, ct);
            }
        }

        // A stored ImageBlobUrl is never sent to a client directly — always a fresh, short-lived
        // signed URL, and never fall back to the stored value on a signing failure.
        var imageUrl = hasImage
            ? await blobStorage.GenerateReadUrlAsync(imageBlobUrl, ct) ?? string.Empty
            : null;

        // Notify recipient via SignalR
        await notifier.NotifyAsync(recipientUserId, "newmessage", new
        {
            conversationId = conversation.PublicId,
            messageId = message.PublicId,
            senderId = userGuid,
            senderName,
            text = message.Text,
            timestamp = message.DateCreated,
            imageUrl,
            imageWidth = message.ImageWidth,
            imageHeight = message.ImageHeight,
        }, ct);

        await Send.OkAsync(new SendMessageResponse
        {
            Id = message.PublicId,
            SenderId = message.SenderUserId,
            Text = message.Text,
            Timestamp = message.DateCreated,
            IsRead = message.IsRead,
            ImageUrl = imageUrl,
            ImageWidth = message.ImageWidth,
            ImageHeight = message.ImageHeight,
        }, ct);
    }
}

public class SendMessageRequest
{
    public Guid ConversationId { get; set; }
    public string Text { get; set; } = string.Empty;

    /// <summary>
    /// References a staged upload from <c>GenerateChatImageUploadUrlEndpoint</c>. Optional —
    /// when absent, the message is text-only.
    /// </summary>
    public Guid? ImageUploadId { get; set; }

    /// <summary>Client-reported layout hint. Never trusted for security; ignored unless <see cref="ImageUploadId"/> is set.</summary>
    public int? ImageWidth { get; set; }

    /// <summary>Client-reported layout hint. Never trusted for security; ignored unless <see cref="ImageUploadId"/> is set.</summary>
    public int? ImageHeight { get; set; }
}

public class SendMessageValidator : FastEndpoints.Validator<SendMessageRequest>
{
    public SendMessageValidator()
    {
        RuleFor(x => x.Text)
            .MaximumLength(ChatMessage.MaxTextLength)
            .WithMessage($"Message must be at most {ChatMessage.MaxTextLength} characters.");

        RuleFor(x => x)
            .Must(x => !string.IsNullOrWhiteSpace(x.Text) || x.ImageUploadId.HasValue)
            .WithMessage("Message must include text or an image.")
            .OverridePropertyName(nameof(SendMessageRequest.Text));

        RuleFor(x => x.ImageWidth)
            .InclusiveBetween(1, 20000)
            .When(x => x.ImageWidth.HasValue)
            .WithMessage("Image width must be between 1 and 20000 pixels.");

        RuleFor(x => x.ImageHeight)
            .InclusiveBetween(1, 20000)
            .When(x => x.ImageHeight.HasValue)
            .WithMessage("Image height must be between 1 and 20000 pixels.");
    }
}

public class SendMessageResponse
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
