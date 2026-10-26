using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.Trainers.PendingInvites.Create;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Validators;

/// <summary>
/// Coverage of the package rules of the pending invite input validation.
/// </summary>
public class CreatePendingInviteValidatorTests
{
    private readonly CreatePendingInviteValidator _validator = new();

    [Fact]
    public void Validate_DiscountWithoutPackage_FailsWithItsOwnCode()
    {
        var request = new CreatePendingInviteRequest { Email = "client@example.com", DiscountId = Guid.NewGuid() };

        _validator.TestValidate(request)
            .ShouldHaveValidationErrorFor(x => x.PackageId)
            .WithErrorCode(ErrorCodes.InviteDiscountNeedsPackage);
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(true, false)]
    [InlineData(true, true)]
    public void Validate_PackageAndDiscountCombinations_Pass(bool withPackage, bool withDiscount)
    {
        var request = new CreatePendingInviteRequest
        {
            Email = "client@example.com",
            PackageId = withPackage ? Guid.NewGuid() : null,
            DiscountId = withDiscount ? Guid.NewGuid() : null
        };

        _validator.TestValidate(request).ShouldNotHaveAnyValidationErrors();
    }
}
