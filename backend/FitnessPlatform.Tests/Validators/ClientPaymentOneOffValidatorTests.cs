using FitnessPlatform.Application.Features.ClientPayments.AddClientOneOffPayment;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Validators;

/// <summary>
/// Input rules of <see cref="AddClientOneOffPaymentValidator"/>.
/// </summary>
public class ClientPaymentOneOffValidatorTests
{
    private static AddClientOneOffPaymentRequest Valid() => new()
    {
        ClientId = Guid.NewGuid(),
        Title = "Workshop",
        Amount = 300m,
        DueDate = new DateOnly(2026, 11, 1)
    };

    private static TestValidationResult<AddClientOneOffPaymentRequest> Validate(AddClientOneOffPaymentRequest request) =>
        new AddClientOneOffPaymentValidator().TestValidate(request);

    [Fact]
    public void Validate_ValidRequest_Passes()
    {
        Validate(Valid()).IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(10_000_000)]
    public void Validate_AmountOutsideTheRange_FailsWithTheAmountCode(int amount)
    {
        var request = Valid();
        request.Amount = amount;

        Validate(request).Errors.Should().Contain(e => e.ErrorCode == "PAYMENT_AMOUNT_INVALID");
    }

    [Fact]
    public void Validate_AmountAtTheLimit_Passes()
    {
        var request = Valid();
        request.Amount = 9_999_999.99m;

        Validate(request).IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_EmptyTitle_Fails()
    {
        var request = Valid();
        request.Title = " ";

        Validate(request).Errors.Should().NotBeEmpty();
    }

    [Fact]
    public void Validate_TitleOverOneHundredCharacters_Fails()
    {
        var request = Valid();
        request.Title = new string('x', 101);

        Validate(request).Errors.Should().NotBeEmpty();
    }

    [Fact]
    public void Validate_MissingDueDate_Fails()
    {
        var request = Valid();
        request.DueDate = default;

        Validate(request).Errors.Should().NotBeEmpty();
    }
}
