using FitnessPlatform.Application.Features.ClientRequests.SendClientRequest;
using FluentAssertions;

namespace FitnessPlatform.Tests.Endpoints.ClientRequests;

/// <summary>
/// Tests for <see cref="SendClientRequestValidator"/>: the message cap matches the entity column.
/// </summary>
public class SendClientRequestValidatorTests
{
    private readonly SendClientRequestValidator _validator = new();

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("Hi")]
    public void Message_WithinLimit_IsValid(string? message)
    {
        _validator.Validate(new SendClientRequestRequest { Message = message }).IsValid.Should().BeTrue();
    }

    [Fact]
    public void Message_AtLimit_IsValid()
    {
        _validator.Validate(new SendClientRequestRequest { Message = new string('a', 500) }).IsValid.Should().BeTrue();
    }

    [Fact]
    public void Message_OverLimit_IsInvalid()
    {
        _validator.Validate(new SendClientRequestRequest { Message = new string('a', 501) }).IsValid.Should().BeFalse();
    }
}
