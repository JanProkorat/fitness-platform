using System.Buffers.Binary;
using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;
using FormUp.Application.Domain.Constants;
using FormUp.Application.Domain.Enums;
using FormUp.Application.Domain.Interfaces;

namespace FormUp.Application.Infrastructure.Services;

/// <summary>
/// HMAC-SHA256 tokens for notification email links. The signing key is derived with HKDF from the configured
/// JWT secret under its own purpose string, so the JWT key itself never signs these and a token from another
/// purpose never validates. Layout: version byte, user id, event, issued-at (unix seconds), then the signature.
/// </summary>
/// <param name="configuration">Application configuration; supplies the JWT secret the key is derived from.</param>
/// <param name="timeProvider">Clock.</param>
public sealed class EmailTurnOffTokenService(IConfiguration configuration, TimeProvider timeProvider)
    : IEmailTurnOffTokenService
{
    /// <summary>How long a link keeps working after the email was sent.</summary>
    public static readonly TimeSpan Lifetime = TimeSpan.FromDays(90);

    private const byte Version = 1;
    private const int MaxTokenLength = 256;
    private const int PayloadLength = 1 + 16 + 4 + 8;
    private const int SignatureLength = 32;
    private const string KeyPurpose = "formup-email-turn-off-v1";

    // A small allowance so a token minted by a node whose clock runs ahead is not rejected.
    private static readonly TimeSpan ClockSkew = TimeSpan.FromMinutes(5);

    private readonly Lazy<byte[]> _key = new(() => DeriveKey(configuration));

    /// <inheritdoc />
    public string Create(Guid userId, NotificationEvent notificationEvent)
    {
        var token = new byte[PayloadLength + SignatureLength];
        var payload = token.AsSpan(0, PayloadLength);

        payload[0] = Version;
        userId.TryWriteBytes(payload.Slice(1, 16));
        BinaryPrimitives.WriteInt32BigEndian(payload.Slice(17, 4), (int)notificationEvent);
        BinaryPrimitives.WriteInt64BigEndian(payload.Slice(21, 8), timeProvider.GetUtcNow().ToUnixTimeSeconds());
        HMACSHA256.HashData(_key.Value, payload, token.AsSpan(PayloadLength));

        return Base64Url.EncodeToString(token);
    }

    /// <inheritdoc />
    public EmailTurnOffTokenClaims? Validate(string? token)
    {
        // IsValid first: the decoder throws, rather than returns false, on an illegal character.
        if (string.IsNullOrEmpty(token) || token.Length > MaxTokenLength || !Base64Url.IsValid(token))
        {
            return null;
        }

        var bytes = new byte[Base64Url.GetMaxDecodedLength(token.Length)];

        if (!Base64Url.TryDecodeFromChars(token, bytes, out var written) || written != PayloadLength + SignatureLength)
        {
            return null;
        }

        var payload = bytes.AsSpan(0, PayloadLength);
        var expected = HMACSHA256.HashData(_key.Value, payload);

        if (!CryptographicOperations.FixedTimeEquals(expected, bytes.AsSpan(PayloadLength, SignatureLength)) || payload[0] != Version)
        {
            return null;
        }

        var notificationEvent = (NotificationEvent)BinaryPrimitives.ReadInt32BigEndian(payload.Slice(17, 4));

        if (!Enum.IsDefined(notificationEvent) || EmailTemplateRenderer.TemplateFor(notificationEvent) is null)
        {
            return null;
        }

        var issuedAt = DateTimeOffset.FromUnixTimeSeconds(BinaryPrimitives.ReadInt64BigEndian(payload.Slice(21, 8)));
        var age = timeProvider.GetUtcNow() - issuedAt;

        if (age > Lifetime || age < -ClockSkew)
        {
            return null;
        }

        return new EmailTurnOffTokenClaims(new Guid(payload.Slice(1, 16)), notificationEvent);
    }

    private static byte[] DeriveKey(IConfiguration configuration)
    {
        var secret = configuration[ConfigKeys.JwtSecret];

        if (string.IsNullOrEmpty(secret))
        {
            throw new InvalidOperationException($"{ConfigKeys.JwtSecret} must be configured to sign notification email links.");
        }

        return HKDF.DeriveKey(
            HashAlgorithmName.SHA256,
            Encoding.UTF8.GetBytes(secret),
            SignatureLength,
            salt: [],
            info: Encoding.UTF8.GetBytes(KeyPurpose));
    }
}
