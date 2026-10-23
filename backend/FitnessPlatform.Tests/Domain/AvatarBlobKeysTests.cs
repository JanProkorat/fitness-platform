using FitnessPlatform.Application.Domain.Services;
using FluentAssertions;

namespace FitnessPlatform.Tests.Domain;

/// <summary>
/// Tests for <see cref="AvatarBlobKeys"/>.
/// </summary>
public class AvatarBlobKeysTests
{
    private const string Hex = "0123456789abcdef0123456789abcdef";
    private static readonly Guid UserId = Guid.Parse("11111111-2222-3333-4444-555555555555");

    [Fact]
    public void NewSubPath_RoundTripsThroughTryParse_AndIsUniquePerCall()
    {
        var professionalPath = AvatarBlobKeys.NewProfessionalSubPath(12, "jpg");
        var userPath = AvatarBlobKeys.NewUserSubPath(UserId, "webp");

        professionalPath.Should().NotBe(AvatarBlobKeys.NewProfessionalSubPath(12, "jpg"));
        AvatarBlobKeys.TryParseProfessionalKey($"avatars/{professionalPath}", 12, out var professionalKey).Should().BeTrue();
        professionalKey.Should().Be(professionalPath[..professionalPath.LastIndexOf('.')]);
        AvatarBlobKeys.TryParseUserKey($"avatars/{userPath}", UserId, out var userKey).Should().BeTrue();
        userKey.Should().Be(userPath[..userPath.LastIndexOf('.')]);
    }

    [Theory]
    [InlineData("avatars/prof-1-" + Hex + ".jpg", 1, true)]
    [InlineData("https://cdn.test/avatars/prof-1-" + Hex + ".jpg", 1, true)]
    [InlineData("avatars/prof-12-" + Hex + ".jpg", 1, false)]
    [InlineData("avatars/prof-1-" + Hex + ".jpg", 12, false)]
    [InlineData("avatars/prof-1.jpg", 1, false)]
    [InlineData("avatars/prof-1-" + "0123456789abcdeg0123456789abcdef" + ".jpg", 1, false)]
    [InlineData("avatars/prof-1-" + Hex + ".jpg/..", 1, false)]
    [InlineData("avatars/..%2Fprof-1-" + Hex + ".jpg", 1, false)]
    [InlineData("avatars/prof-1-" + Hex + ".jpg?signed=test", 1, false)]
    [InlineData("", 1, false)]
    public void TryParseProfessionalKey_ChecksOwnerAndStrictShape(string blobUrl, long profileId, bool expected)
    {
        AvatarBlobKeys.TryParseProfessionalKey(blobUrl, profileId, out _).Should().Be(expected);
    }

    [Theory]
    [InlineData("avatars/11111111-2222-3333-4444-555555555555-" + Hex + ".png", true)]
    [InlineData("avatars/99999999-2222-3333-4444-555555555555-" + Hex + ".png", false)]
    [InlineData("avatars/11111111-2222-3333-4444-555555555555.png", false)]
    [InlineData("avatars/11111111-2222-3333-4444-555555555555-nothex.png", false)]
    [InlineData("avatars/11111111-2222-3333-4444-555555555555-" + Hex + ".png/..", false)]
    public void TryParseUserKey_ChecksOwnerAndStrictShape(string blobUrl, bool expected)
    {
        AvatarBlobKeys.TryParseUserKey(blobUrl, UserId, out _).Should().Be(expected);
    }

    [Theory]
    [InlineData("avatars/prof-1.jpg", 1, true)]
    [InlineData("avatars/prof-1-" + Hex + ".jpg", 1, true)]
    [InlineData("avatars/prof-12.jpg", 1, false)]
    [InlineData("avatars/prof-12-" + Hex + ".jpg", 1, false)]
    [InlineData("https://evil.example/photo.jpg", 1, false)]
    public void TryGetOwnedProfessionalSegment_AcceptsLegacyAndUniqueNamesOfSameOwnerOnly(
        string blobUrl, long profileId, bool expected)
    {
        AvatarBlobKeys.TryGetOwnedProfessionalSegment(blobUrl, profileId, out var segment).Should().Be(expected);
        segment.Should().Be(expected ? blobUrl[(blobUrl.LastIndexOf('/') + 1)..] : string.Empty);
    }

    [Theory]
    [InlineData("avatars/11111111-2222-3333-4444-555555555555.jpg", true)]
    [InlineData("avatars/11111111-2222-3333-4444-555555555555-" + Hex + ".jpg", true)]
    [InlineData("avatars/99999999-2222-3333-4444-555555555555.jpg", false)]
    [InlineData("seed/avatar.jpg", false)]
    public void TryGetOwnedUserSegment_AcceptsLegacyAndUniqueNamesOfSameOwnerOnly(string blobUrl, bool expected)
    {
        AvatarBlobKeys.TryGetOwnedUserSegment(blobUrl, UserId, out _).Should().Be(expected);
    }
}
