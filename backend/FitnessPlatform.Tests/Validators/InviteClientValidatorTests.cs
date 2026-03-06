using FluentAssertions;
using FluentValidation.TestHelper;
using FitnessPlatform.Application.Features.Trainers.InviteClient;

namespace FitnessPlatform.Tests.Validators;

public class InviteClientValidatorTests
{
    private readonly InviteClientValidator _validator = new();

    [Fact]
    public void ValidRequest_PassesValidation()
    {
        var result = _validator.TestValidate(new InviteClientRequest
        {
            Email = "client@example.com"
        });
        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-an-email")]
    public void Email_InvalidOrEmpty_Fails(string email)
    {
        var result = _validator.TestValidate(new InviteClientRequest
        {
            Email = email
        });
        result.ShouldHaveValidationErrorFor(x => x.Email);
    }

    [Fact]
    public void Email_TooLong_Fails()
    {
        var result = _validator.TestValidate(new InviteClientRequest
        {
            Email = new string('a', 92) + "@test.com"
        });
        result.ShouldHaveValidationErrorFor(x => x.Email);
    }
}
