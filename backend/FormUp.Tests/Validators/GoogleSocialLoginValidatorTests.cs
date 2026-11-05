using FluentAssertions;
using FormUp.Application.Features.Auth.Shared;
using FormUp.Application.Features.Auth.SocialLogin.Google;

namespace FormUp.Tests.Validators;

/// <summary>
/// Role rules of <see cref="GoogleSocialLoginValidator"/>.
/// </summary>
public class GoogleSocialLoginValidatorTests
{
    private static GoogleSocialLoginRequest Request(params string[] roles) => new()
    {
        IdToken = "token",
        Nonce = "nonce",
        Roles = [.. roles],
    };

    [Theory]
    [InlineData("Admin")]
    [InlineData("Superuser")]
    public void Validate_NonSelfAssignableRole_FailsWithInvalidRoleMessage(string role)
    {
        var result = new GoogleSocialLoginValidator().Validate(Request(role));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.ErrorMessage == SocialSignUpRoles.InvalidRoleMessage);
    }

    [Fact]
    public void Validate_ClientWithTrainer_FailsWithMixMessage()
    {
        var result = new GoogleSocialLoginValidator().Validate(Request("Client", "Trainer"));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.ErrorMessage == SocialSignUpRoles.ClientCoachMixMessage);
    }

    [Theory]
    [InlineData]
    [InlineData("Client")]
    [InlineData("Trainer")]
    [InlineData("nutritionist")]
    [InlineData("Trainer", "Nutritionist")]
    public void Validate_SelfAssignableRoles_Passes(params string[] roles)
    {
        var result = new GoogleSocialLoginValidator().Validate(Request(roles));

        result.IsValid.Should().BeTrue();
    }
}
