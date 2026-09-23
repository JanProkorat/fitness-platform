namespace FitnessPlatform.Application.Features.Messaging.Shared;

/// <summary>
/// Chat-image-specific policy shared by <c>GenerateChatImageUploadUrlEndpoint</c> and
/// <c>SendMessageEndpoint</c>: the narrower jpeg/png/webp allowlist (excluding the shared
/// <see cref="Infrastructure.Services.ImageUploadService"/>'s heic/heif, which browsers cannot
/// render inline), magic-byte signature verification of the staged bytes, and the deterministic
/// container-path builders both actions use to agree on the same object key without either one
/// trusting a client-supplied path or URL.
/// </summary>
public static class ChatImagePolicy
{
    /// <summary>
    /// Container-path prefix for a staged (not-yet-sent) chat image upload. Must match
    /// <c>ImageUploadService.ScopeToPrefix(ImageUploadScope.ChatUpload)</c> — see the comment
    /// there.
    /// </summary>
    public const string StagingPrefix = "chat-uploads";

    /// <summary>Container-path prefix for a sent chat image's permanent object.</summary>
    public const string FinalPrefix = "chat";

    /// <summary>
    /// Content types accepted for a chat image attachment — narrower than
    /// <see cref="Infrastructure.Services.ImageUploadService"/>'s shared allowlist (excludes
    /// heic/heif).
    /// </summary>
    public static readonly IReadOnlyCollection<string> AllowedContentTypes = ["image/jpeg", "image/png", "image/webp"];

    /// <summary>
    /// Builds the scope-relative sub-path passed to <c>IImageUploadService.GenerateUploadUrlAsync</c>
    /// when minting the upload URL — <see cref="StagingPrefix"/> is prepended by that service, not
    /// here.
    /// </summary>
    public static string BuildStagingSubPath(Guid conversationId, Guid callerUserId, Guid uploadId) =>
        $"{conversationId}/{callerUserId}/{uploadId}";

    /// <summary>
    /// Builds the full container path of a staged upload — reconstructed identically at
    /// upload-url time and at send time from (conversation, caller, uploadId) alone, so the
    /// server never has to trust a client-supplied path or URL. Used for direct
    /// <see cref="Domain.Interfaces.IBlobStorageService"/> calls (download, delete) that bypass
    /// <c>IImageUploadService</c>.
    /// </summary>
    public static string BuildStagingContainerPath(Guid conversationId, Guid callerUserId, Guid uploadId) =>
        $"{StagingPrefix}/{BuildStagingSubPath(conversationId, callerUserId, uploadId)}";

    /// <summary>
    /// Builds the permanent, final blob key for a sent chat image — one per message, so a resend
    /// or a duplicate upload never collides with another message's image.
    /// </summary>
    public static string BuildFinalContainerPath(Guid conversationId, Guid messageId, string extension) =>
        $"{FinalPrefix}/{conversationId}/{messageId}.{extension}";

    /// <summary>
    /// Detects the image's real content type from its magic-byte signature, ignoring whatever
    /// content type the client declared when the upload URL was minted — a pre-signed PUT binds
    /// neither content type nor length. Returns null when the bytes match none of the three
    /// allowed signatures (JPEG <c>FF D8 FF</c>, PNG <c>89 50 4E 47 0D 0A 1A 0A</c>, WebP
    /// <c>RIFF....WEBP</c>) — including a spoofed or disguised file such as an HTML/SVG/PDF body
    /// renamed to <c>.jpg</c>, or sent with a forged declared content type.
    /// </summary>
    public static string? SniffContentType(byte[] data)
    {
        if (data.Length >= 3 && data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF)
        {
            return "image/jpeg";
        }

        if (data.Length >= 8 &&
            data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47 &&
            data[4] == 0x0D && data[5] == 0x0A && data[6] == 0x1A && data[7] == 0x0A)
        {
            return "image/png";
        }

        if (data.Length >= 12 &&
            data[0] == 0x52 && data[1] == 0x49 && data[2] == 0x46 && data[3] == 0x46 &&
            data[8] == 0x57 && data[9] == 0x45 && data[10] == 0x42 && data[11] == 0x50)
        {
            return "image/webp";
        }

        return null;
    }

    /// <summary>Maps a sniffed content type (see <see cref="SniffContentType"/>) to its stored file extension.</summary>
    public static string ExtensionFor(string sniffedContentType) => sniffedContentType switch
    {
        "image/jpeg" => "jpg",
        "image/png"  => "png",
        "image/webp" => "webp",
        _            => throw new ArgumentOutOfRangeException(nameof(sniffedContentType), sniffedContentType, null),
    };
}
