using System.Buffers.Binary;
using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using FluentAssertions;
using FormUp.Application.Domain.Constants;
using FormUp.Application.Domain.Enums;
using FormUp.Application.Infrastructure.Services;
using Microsoft.Extensions.Configuration;

namespace FormUp.Tests.Infrastructure.Services;

/// <summary>
/// The signed token behind a notification email's "Turn off these emails" link.
/// </summary>
public partial class EmailTurnOffTokenServiceTests
{
    private static readonly string Secret = new('s', 64);
    private static readonly Guid UserId = Guid.Parse("6f1f2c3a-8d54-4f0e-9a37-0c1d2e3f4a5b");
    private static readonly DateTimeOffset Now = new(2026, 11, 5, 9, 0, 0, TimeSpan.Zero);

    private static IConfiguration Configuration(string? secret) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { [ConfigKeys.JwtSecret] = secret })
            .Build();

    private static EmailTurnOffTokenService Service(TimeProvider? clock = null, string? secret = null) =>
        new(Configuration(secret ?? Secret), clock ?? new FixedTimeProvider(Now));

    // Mirrors the documented layout so a token with a valid signature but another version, event or age can be built.
    private static string Forge(byte version, int notificationEvent, DateTimeOffset issuedAt, string? secret = null, bool derive = true)
    {
        var secretBytes = Encoding.UTF8.GetBytes(secret ?? Secret);
        var key = derive
            ? HKDF.DeriveKey(HashAlgorithmName.SHA256, secretBytes, 32, salt: [], info: "formup-email-turn-off-v1"u8.ToArray())
            : secretBytes;
        var token = new byte[29 + 32];

        token[0] = version;
        UserId.TryWriteBytes(token.AsSpan(1, 16));
        BinaryPrimitives.WriteInt32BigEndian(token.AsSpan(17, 4), notificationEvent);
        BinaryPrimitives.WriteInt64BigEndian(token.AsSpan(21, 8), issuedAt.ToUnixTimeSeconds());
        HMACSHA256.HashData(key, token.AsSpan(0, 29), token.AsSpan(29));

        return Base64Url.EncodeToString(token);
    }

    [Fact]
    public void Forge_WithTheDocumentedLayout_IsAccepted()
    {
        var claims = Service().Validate(Forge(1, (int)NotificationEvent.JoinRequest, Now));

        claims.Should().Be(new Application.Domain.Interfaces.EmailTurnOffTokenClaims(UserId, NotificationEvent.JoinRequest));
    }

    [Fact]
    public void CreateThenValidate_EveryEmailEvent_RoundTripsUserAndEvent()
    {
        var service = Service();

        foreach (var notificationEvent in NotificationPreferenceDefaults.AllEvents)
        {
            var claims = service.Validate(service.Create(UserId, notificationEvent));

            claims.Should().NotBeNull();
            claims!.Value.UserId.Should().Be(UserId);
            claims.Value.Event.Should().Be(notificationEvent);
        }
    }

    [Fact]
    public void Create_Token_IsUrlSafeUnpaddedAndShort()
    {
        var token = Service().Create(UserId, NotificationEvent.NewMessage);

        UrlSafe().IsMatch(token).Should().BeTrue();
        token.Length.Should().BeLessThanOrEqualTo(256);
    }

    [Fact]
    public void Validate_AnyChangedCharacter_IsRejected()
    {
        var service = Service();
        var token = service.Create(UserId, NotificationEvent.WeeklyCheckInSubmitted);

        // The last character carries padding bits that do not change the decoded bytes, so it is left out.
        for (var index = 0; index < token.Length - 1; index++)
        {
            var changed = string.Concat(token.AsSpan(0, index), token[index] == 'A' ? "B" : "A", token.AsSpan(index + 1));

            service.Validate(changed).Should().BeNull($"character {index} was changed");
        }
    }

    [Fact]
    public void Validate_TokenSignedWithTheRawJwtSecretInsteadOfTheDerivedKey_IsRejected()
    {
        var raw = Forge(1, (int)NotificationEvent.JoinRequest, Now, derive: false);

        Service().Validate(raw).Should().BeNull();
    }

    [Fact]
    public void Validate_TokenFromAnotherSecret_IsRejected()
    {
        var foreign = Service(secret: new string('t', 64)).Create(UserId, NotificationEvent.JoinRequest);

        Service().Validate(foreign).Should().BeNull();
    }

    [Fact]
    public void Validate_UnknownVersionWithAValidSignature_IsRejected()
    {
        Service().Validate(Forge(2, (int)NotificationEvent.JoinRequest, Now)).Should().BeNull();
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(5)]
    [InlineData(99)]
    public void Validate_EventWithNoEmailAndAValidSignature_IsRejected(int notificationEvent)
    {
        Service().Validate(Forge(1, notificationEvent, Now)).Should().BeNull();
    }

    [Fact]
    public void Validate_NinetyDaysOld_IsAcceptedAndOneSecondOlderIsRejected()
    {
        var clock = new FixedTimeProvider(Now);
        var service = Service(clock);
        var token = service.Create(UserId, NotificationEvent.JoinRequest);

        clock.Now = Now + EmailTurnOffTokenService.Lifetime;
        service.Validate(token).Should().NotBeNull();

        clock.Now = Now + EmailTurnOffTokenService.Lifetime + TimeSpan.FromSeconds(1);
        service.Validate(token).Should().BeNull();
    }

    [Fact]
    public void Validate_IssuedSlightlyInTheFuture_IsAcceptedButFarInTheFutureIsNot()
    {
        var service = Service();

        service.Validate(Forge(1, (int)NotificationEvent.JoinRequest, Now.AddMinutes(1))).Should().NotBeNull();
        service.Validate(Forge(1, (int)NotificationEvent.JoinRequest, Now.AddHours(1))).Should().BeNull();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("not a token")]
    [InlineData("AAAA")]
    public void Validate_MalformedInput_IsRejected(string? token)
    {
        Service().Validate(token).Should().BeNull();
    }

    [Fact]
    public void Validate_Oversized_IsRejected()
    {
        Service().Validate(new string('A', 257)).Should().BeNull();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void Create_WithoutAJwtSecret_FailsInsteadOfSigningWithAnEmptyKey(string? secret)
    {
        var service = new EmailTurnOffTokenService(Configuration(secret), new FixedTimeProvider(Now));

        var act = () => service.Create(UserId, NotificationEvent.JoinRequest);

        act.Should().Throw<InvalidOperationException>();
    }

    [GeneratedRegex("^[A-Za-z0-9_-]+$")]
    private static partial Regex UrlSafe();

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = now;

        public override DateTimeOffset GetUtcNow() => Now;
    }
}
