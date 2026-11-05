using FluentAssertions;
using FormUp.Application.Features.Auth.Shared;
using FormUp.Application.Features.Auth.SocialLogin.Apple;

namespace FormUp.Tests.Validators;

/// <summary>
/// Role rules of <see cref="AppleSocialLoginValidator"/>.
/// </summary>
public class AppleSocialLoginValidatorTests
{
    private static AppleSocialLoginRequest Request(params string[] roles) => new()
    {
        IdentityToken = "token",
        Nonce = "nonce",
        Roles = [.. roles],
    };

    [Theory]
    [InlineData("Admin")]
    [InlineData("Superuser")]
    public void Validate_NonSelfAssignableRole_FailsWithInvalidRoleMessage(string role)
    {
        var result = new AppleSocialLoginValidator().Validate(Request(role));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.ErrorMessage == SocialSignUpRoles.InvalidRoleMessage);
    }

    [Fact]
    public void Validate_ClientWithNutritionist_FailsWithMixMessage()
    {
        var result = new AppleSocialLoginValidator().Validate(Request("Client", "Nutritionist"));

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
        var result = new AppleSocialLoginValidator().Validate(Request(roles));

        result.IsValid.Should().BeTrue();
    }
}
