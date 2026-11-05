using FluentAssertions;
using FluentValidation.TestHelper;
using FormUp.Application.Features.Auth.AcceptInvitation;

namespace FormUp.Tests.Validators;

public class AcceptInvitationValidatorTests
{
    private readonly AcceptInvitationValidator _validator = new();

    [Fact]
    public void ValidRequest_PassesValidation()
    {
        var result = _validator.TestValidate(new AcceptInvitationRequest
        {
            Token = "valid-invitation-token"
        });
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Token_Empty_Fails()
    {
        var result = _validator.TestValidate(new AcceptInvitationRequest
        {
            Token = ""
        });
        result.ShouldHaveValidationErrorFor(x => x.Token);
    }
}
