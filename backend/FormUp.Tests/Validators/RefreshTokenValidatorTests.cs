using FluentAssertions;
using FluentValidation.TestHelper;
using FormUp.Application.Features.Auth.RefreshToken;

namespace FormUp.Tests.Validators;

public class RefreshTokenValidatorTests
{
    private readonly RefreshTokenValidator _validator = new();

    [Fact]
    public void ValidRequest_PassesValidation()
    {
        var result = _validator.TestValidate(new RefreshTokenRequest
        {
            RefreshToken = "some-valid-token"
        });
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void RefreshToken_Empty_Fails()
    {
        var result = _validator.TestValidate(new RefreshTokenRequest
        {
            RefreshToken = ""
        });
        result.ShouldHaveValidationErrorFor(x => x.RefreshToken);
    }
}
