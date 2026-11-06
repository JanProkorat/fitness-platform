using FluentAssertions;
using FluentValidation.TestHelper;
using FormUp.Application.Features.Client.PushToken.RemovePushTokenAnonymous;

namespace FormUp.Tests.Validators;

public class RemovePushTokenAnonymousValidatorTests
{
    private readonly RemovePushTokenAnonymousValidator _validator = new();

    [Theory]
    [InlineData("ExponentPushToken[abc123_-XYZ]")]
    [InlineData("ExpoPushToken[abc123_-XYZ]")]
    public void Validate_ExpoShapedToken_Passes(string token)
    {
        var result = _validator.TestValidate(new RemovePushTokenAnonymousRequest { Token = token });

        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("not-a-token")]
    [InlineData("ExponentPushToken[]")]
    [InlineData("ExponentPushToken[abc")]
    [InlineData("FcmToken[abc]")]
    [InlineData("ExponentPushToken[a b]")]
    [InlineData("xExponentPushToken[abc]")]
    public void Validate_MalformedToken_Fails(string token)
    {
        var result = _validator.TestValidate(new RemovePushTokenAnonymousRequest { Token = token });

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_TokenLongerThan256_Fails()
    {
        var token = $"ExponentPushToken[{new string('a', 256)}]";

        var result = _validator.TestValidate(new RemovePushTokenAnonymousRequest { Token = token });

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_TokenOfExactly256_Passes()
    {
        var token = $"ExponentPushToken[{new string('a', 256 - "ExponentPushToken[]".Length)}]";

        token.Length.Should().Be(256);
        _validator.TestValidate(new RemovePushTokenAnonymousRequest { Token = token }).IsValid.Should().BeTrue();
    }
}
