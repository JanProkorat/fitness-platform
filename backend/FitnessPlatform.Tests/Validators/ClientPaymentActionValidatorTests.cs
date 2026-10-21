using FitnessPlatform.Application.Features.ClientPayments.MarkClientPaymentPaid;
using FitnessPlatform.Application.Features.ClientPayments.RequestClientPayment;
using FitnessPlatform.Application.Features.ClientPayments.WaiveClientPayment;
using FluentAssertions;

namespace FitnessPlatform.Tests.Validators;

/// <summary>
/// Input rules of the mark-paid, waive and request validators.
/// </summary>
public class ClientPaymentActionValidatorTests
{
    private static DateOnly UtcToday => DateOnly.FromDateTime(DateTime.UtcNow);

    [Fact]
    public void MarkPaid_NoDate_Passes()
    {
        var request = new MarkClientPaymentPaidRequest { ClientId = Guid.NewGuid(), PaymentId = Guid.NewGuid() };

        new MarkClientPaymentPaidValidator().Validate(request).IsValid.Should().BeTrue();
    }

    [Fact]
    public void MarkPaid_DateInThePast_Passes()
    {
        var request = new MarkClientPaymentPaidRequest { ClientId = Guid.NewGuid(), PaymentId = Guid.NewGuid(), PaidOn = UtcToday.AddDays(-30) };

        new MarkClientPaymentPaidValidator().Validate(request).IsValid.Should().BeTrue();
    }

    [Fact]
    public void MarkPaid_DateInTheFuture_FailsWithTheFutureCode()
    {
        var request = new MarkClientPaymentPaidRequest { ClientId = Guid.NewGuid(), PaymentId = Guid.NewGuid(), PaidOn = UtcToday.AddDays(3) };

        new MarkClientPaymentPaidValidator().Validate(request).Errors
            .Should().Contain(e => e.ErrorCode == "PAYMENT_PAID_ON_IN_FUTURE");
    }

    [Fact]
    public void Waive_ReasonOverOneHundredCharacters_Fails()
    {
        var request = new WaiveClientPaymentRequest { ClientId = Guid.NewGuid(), PaymentId = Guid.NewGuid(), Reason = new string('x', 101) };

        new WaiveClientPaymentValidator().Validate(request).IsValid.Should().BeFalse();
    }

    [Fact]
    public void Waive_NoReason_Passes()
    {
        var request = new WaiveClientPaymentRequest { ClientId = Guid.NewGuid(), PaymentId = Guid.NewGuid() };

        new WaiveClientPaymentValidator().Validate(request).IsValid.Should().BeTrue();
    }

    [Fact]
    public void Request_NeitherChannel_FailsWithTheChannelCode()
    {
        var request = new RequestClientPaymentRequest { ClientId = Guid.NewGuid(), PaymentId = Guid.NewGuid() };

        new RequestClientPaymentValidator().Validate(request).Errors
            .Should().Contain(e => e.ErrorCode == "PAYMENT_REQUEST_CHANNEL_REQUIRED");
    }

    [Theory]
    [InlineData(true, false)]
    [InlineData(false, true)]
    public void Request_AtLeastOneChannel_Passes(bool email, bool notification)
    {
        var request = new RequestClientPaymentRequest
        {
            ClientId = Guid.NewGuid(),
            PaymentId = Guid.NewGuid(),
            SendEmail = email,
            SendNotification = notification
        };

        new RequestClientPaymentValidator().Validate(request).IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(10_000_000)]
    public void Request_AmountOutsideTheRange_FailsWithTheAmountCode(int amount)
    {
        var request = new RequestClientPaymentRequest
        {
            ClientId = Guid.NewGuid(),
            PaymentId = Guid.NewGuid(),
            SendEmail = true,
            Amount = amount
        };

        new RequestClientPaymentValidator().Validate(request).Errors
            .Should().Contain(e => e.ErrorCode == "PAYMENT_AMOUNT_INVALID");
    }

    [Fact]
    public void Request_DueDateInThePast_Fails()
    {
        var request = new RequestClientPaymentRequest
        {
            ClientId = Guid.NewGuid(),
            PaymentId = Guid.NewGuid(),
            SendEmail = true,
            DueDate = UtcToday.AddDays(-5)
        };

        new RequestClientPaymentValidator().Validate(request).IsValid.Should().BeFalse();
    }
}
