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
    [InlineData("Trainer")]
    [InlineData("nutritionist")]
    public void Validate_CoachWithHealthDataConsent_FailsWithCoachConsentMessage(string role)
    {
        var request = Request(role);
        request.HealthDataConsent = true;

        var result = new GoogleSocialLoginValidator().Validate(request);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.ErrorMessage == SocialSignUpRoles.CoachHealthDataConsentMessage);
    }

    [Theory]
    [InlineData]
    [InlineData("Client")]
    public void Validate_ClientRolesWithOrWithoutConsent_Passes(params string[] roles)
    {
        foreach (var consent in new bool?[] { null, true, false })
        {
            var request = Request(roles);
            request.HealthDataConsent = consent;

            new GoogleSocialLoginValidator().Validate(request).IsValid.Should().BeTrue();
        }
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
