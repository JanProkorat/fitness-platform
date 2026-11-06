using FormUp.Application.Features.Trainers.PendingInvites.CheckSlot;
using FluentValidation.TestHelper;

namespace FormUp.Tests.Validators;

/// <summary>
/// Coverage of the email rules of the slot-check query.
/// </summary>
public class CheckPendingInviteSlotValidatorTests
{
    private readonly CheckPendingInviteSlotValidator _validator = new();

    [Theory]
    [InlineData("")]
    [InlineData("not-an-email")]
    public void Validate_MissingOrMalformedEmail_Fails(string email)
    {
        _validator.TestValidate(new CheckPendingInviteSlotRequest { Email = email })
            .ShouldHaveValidationErrorFor(x => x.Email);
    }

    [Fact]
    public void Validate_EmailOverHundredCharacters_Fails()
    {
        var email = new string('a', 92) + "@test.com";

        _validator.TestValidate(new CheckPendingInviteSlotRequest { Email = email })
            .ShouldHaveValidationErrorFor(x => x.Email);
    }

    [Fact]
    public void Validate_ValidEmail_Passes()
    {
        _validator.TestValidate(new CheckPendingInviteSlotRequest { Email = "client@example.com" })
            .ShouldNotHaveAnyValidationErrors();
    }
}
