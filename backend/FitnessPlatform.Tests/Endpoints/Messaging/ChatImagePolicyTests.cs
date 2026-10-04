using FluentAssertions;
using FitnessPlatform.Application.Features.Messaging.Shared;

namespace FitnessPlatform.Tests.Endpoints.Messaging;

/// <summary>
/// Unit tests for <see cref="ChatImagePolicy"/> — magic-byte signature sniffing (the
/// content-type source of truth at send time, never the client-declared type) and the
/// deterministic staging/final container-path builders.
/// </summary>
public class ChatImagePolicyTests
{
    // ── SniffContentType — allowed signatures ──────────────────────────────────

    [Fact]
    public void SniffContentType_JpegSignature_ReturnsImageJpeg()
    {
        byte[] data = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46];

        ChatImagePolicy.SniffContentType(data).Should().Be("image/jpeg");
    }

    [Fact]
    public void SniffContentType_PngSignature_ReturnsImagePng()
    {
        byte[] data = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00];

        ChatImagePolicy.SniffContentType(data).Should().Be("image/png");
    }

    [Fact]
    public void SniffContentType_WebPSignature_ReturnsImageWebp()
    {
        byte[] data =
        [
            0x52, 0x49, 0x46, 0x46, // "RIFF"
            0x00, 0x00, 0x00, 0x00, // file size (unused by the sniff)
            0x57, 0x45, 0x42, 0x50  // "WEBP"
        ];

        ChatImagePolicy.SniffContentType(data).Should().Be("image/webp");
    }

    // ── SniffContentType — rejected / disguised content ────────────────────────

    [Fact]
    public void SniffContentType_PlainTextNamedAsImage_ReturnsNull()
    {
        // Root cause this proves: a text file renamed to end in .jpg has no magic-byte
        // signature at all — the sniff must reject it regardless of the client-declared
        // Content-Type or the file extension in the upload request.
        var data = "this is not an image, just plain text content"u8.ToArray();

        ChatImagePolicy.SniffContentType(data).Should().BeNull();
    }

    [Fact]
    public void SniffContentType_HtmlDisguisedAsJpeg_ReturnsNull()
    {
        // An attacker could PUT an HTML/SVG payload to the presigned upload URL (which enforces
        // neither content type nor length) and declare "image/jpeg" at upload-url time. The
        // sniff must catch this at send time regardless.
        var data = "<html><body><script>alert(1)</script></body></html>"u8.ToArray();

        ChatImagePolicy.SniffContentType(data).Should().BeNull();
    }

    [Fact]
    public void SniffContentType_PngHeaderPrefixOnLargerPayload_StillDetectsPng()
    {
        // A genuine PNG signature followed by arbitrary trailing bytes (e.g. an executable's
        // payload appended after a forged PNG header) is intentionally still detected as PNG —
        // signature sniffing verifies the FIRST bytes, not the entire file structure. This is a
        // documented limitation: full content is still passed through the target platform's own
        // image decoder, not re-parsed here.
        byte[] header = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        byte[] trailing = [0x4D, 0x5A, 0x90, 0x00]; // arbitrary non-image trailing bytes
        var data = header.Concat(trailing).ToArray();

        ChatImagePolicy.SniffContentType(data).Should().Be("image/png");
    }

    [Fact]
    public void SniffContentType_TooShortForAnySignature_ReturnsNull()
    {
        byte[] data = [0xFF, 0xD8];

        ChatImagePolicy.SniffContentType(data).Should().BeNull();
    }

    [Fact]
    public void SniffContentType_EmptyArray_ReturnsNull()
    {
        ChatImagePolicy.SniffContentType([]).Should().BeNull();
    }

    // ── ExtensionFor ────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("image/jpeg", "jpg")]
    [InlineData("image/png", "png")]
    [InlineData("image/webp", "webp")]
    public void ExtensionFor_AllowedContentType_ReturnsExpectedExtension(string contentType, string expected)
    {
        ChatImagePolicy.ExtensionFor(contentType).Should().Be(expected);
    }

    [Fact]
    public void ExtensionFor_UnknownContentType_Throws()
    {
        var act = () => ChatImagePolicy.ExtensionFor("image/heic");

        act.Should().Throw<ArgumentOutOfRangeException>();
    }

    // ── Container-path builders ─────────────────────────────────────────────────

    [Fact]
    public void BuildStagingContainerPath_IncludesPrefixAndAllThreeIdentifiers()
    {
        var conversationId = Guid.NewGuid();
        var callerUserId = Guid.NewGuid();
        var uploadId = Guid.NewGuid();

        var path = ChatImagePolicy.BuildStagingContainerPath(conversationId, callerUserId, uploadId);

        path.Should().Be($"{ChatImagePolicy.StagingPrefix}/{conversationId}/{callerUserId}/{uploadId}");
    }

    [Fact]
    public void BuildStagingContainerPath_IsDeterministic_SameInputsProduceSamePath()
    {
        // Load-bearing for the "server rebuilds the staging key, never trusts a client-sent URL"
        // ruling: the upload-url endpoint and SendMessage must independently compute the exact
        // same path from the same three identifiers.
        var conversationId = Guid.NewGuid();
        var callerUserId = Guid.NewGuid();
        var uploadId = Guid.NewGuid();

        var first = ChatImagePolicy.BuildStagingContainerPath(conversationId, callerUserId, uploadId);
        var second = ChatImagePolicy.BuildStagingContainerPath(conversationId, callerUserId, uploadId);

        first.Should().Be(second);
    }

    [Fact]
    public void BuildStagingSubPath_HasNoStagingPrefix()
    {
        var conversationId = Guid.NewGuid();
        var callerUserId = Guid.NewGuid();
        var uploadId = Guid.NewGuid();

        var subPath = ChatImagePolicy.BuildStagingSubPath(conversationId, callerUserId, uploadId);

        subPath.Should().Be($"{conversationId}/{callerUserId}/{uploadId}");
        subPath.Should().NotContain(ChatImagePolicy.StagingPrefix);
    }

    [Fact]
    public void BuildFinalContainerPath_UsesFinalPrefixAndExtension()
    {
        var conversationId = Guid.NewGuid();
        var messageId = Guid.NewGuid();

        var path = ChatImagePolicy.BuildFinalContainerPath(conversationId, messageId, "jpg");

        path.Should().Be($"{ChatImagePolicy.FinalPrefix}/{conversationId}/{messageId}.jpg");
    }
}
