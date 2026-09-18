using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Auth.RequestPasswordReset;
using Microsoft.Extensions.Logging;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace FitnessPlatform.Tests.Endpoints.Auth;

public class RequestPasswordResetEndpointTests
{
    [Fact]
    public async Task HandleAsync_ExistingUser_SendsResetEmail()
    {
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(), Email = "test@test.com", UserName = "test@test.com",
            FirstName = "T", LastName = "U"
        };

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByEmailAsync("test@test.com").Returns(user);
        userManager.GeneratePasswordResetTokenAsync(user).Returns("reset-token-123");

        var emailService = Substitute.For<IEmailService>();
        var logger = Substitute.For<ILogger<RequestPasswordResetEndpoint>>();

        var ep = Factory.Create<RequestPasswordResetEndpoint>(userManager, emailService, logger);

        await ep.HandleAsync(new RequestPasswordResetRequest { Email = "test@test.com" }, CancellationToken.None);

        await emailService.Received(1).SendPasswordResetEmailAsync(
            "test@test.com", "reset-token-123", Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NonexistentUser_StillReturns200()
    {
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByEmailAsync("missing@test.com").Returns((ApplicationUser?)null);

        var emailService = Substitute.For<IEmailService>();
        var logger = Substitute.For<ILogger<RequestPasswordResetEndpoint>>();

        var ep = Factory.Create<RequestPasswordResetEndpoint>(userManager, emailService, logger);

        await ep.HandleAsync(new RequestPasswordResetRequest { Email = "missing@test.com" }, CancellationToken.None);

        ep.ValidationFailed.Should().BeFalse();
        await emailService.DidNotReceive().SendPasswordResetEmailAsync(
            Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_ExistingUserEmailSendThrows_StillReturns200_SameAsNonexistentUser()
    {
        // Regression test for the enumeration oracle: before the fix, an unhandled
        // exception from the email provider propagated to the global exception
        // handler and turned into a 500 -- distinguishing an existing address (500)
        // from a missing one (200) by status code alone. The send failure must be
        // swallowed (and logged) so this endpoint always returns 200, exactly like
        // the nonexistent-user branch above.
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(), Email = "test@test.com", UserName = "test@test.com",
            FirstName = "T", LastName = "U"
        };

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByEmailAsync("test@test.com").Returns(user);
        userManager.GeneratePasswordResetTokenAsync(user).Returns("reset-token-123");

        var emailService = Substitute.For<IEmailService>();
        emailService.SendPasswordResetEmailAsync(
                Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new InvalidOperationException("email provider unavailable"));
        var logger = Substitute.For<ILogger<RequestPasswordResetEndpoint>>();

        var ep = Factory.Create<RequestPasswordResetEndpoint>(userManager, emailService, logger);

        await ep.HandleAsync(new RequestPasswordResetRequest { Email = "test@test.com" }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }
}
