using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Features.Auth.ResetPassword;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore.Storage;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace FitnessPlatform.Tests.Endpoints.Auth;

public class ResetPasswordEndpointTests
{
    [Fact]
    public async Task HandleAsync_ValidToken_ResetsPasswordAndRevokesSessionsOnce()
    {
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(), Email = "test@test.com", UserName = "test@test.com",
            FirstName = "T", LastName = "U"
        };

        var db = Substitute.For<IApplicationDbContext>();
        var transaction = Substitute.For<IDbContextTransaction>();
        db.BeginTransactionAsync(Arg.Any<CancellationToken>()).Returns(transaction);
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByEmailAsync("test@test.com").Returns(user);
        userManager.ResetPasswordAsync(user, "valid-token", "NewPass123!")
            .Returns(IdentityResult.Success);

        var ep = Factory.Create<ResetPasswordEndpoint>(userManager, db, TimeProvider.System);

        await ep.HandleAsync(new ResetPasswordRequest
        {
            Token = "valid-token",
            Email = "test@test.com",
            NewPassword = "NewPass123!",
            ConfirmPassword = "NewPass123!"
        }, TestContext.Current.CancellationToken);

        ep.ValidationFailed.Should().BeFalse();
        await db.Received(1).RevokeRefreshTokenFamilyAsync(
            user.Id, Arg.Any<DateTime>(), Arg.Any<CancellationToken>());
        await transaction.Received(1).CommitAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_RevokeThrows_PropagatesAndDoesNotCommit()
    {
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(), Email = "test@test.com", UserName = "test@test.com",
            FirstName = "T", LastName = "U"
        };

        var db = Substitute.For<IApplicationDbContext>();
        var transaction = Substitute.For<IDbContextTransaction>();
        db.BeginTransactionAsync(Arg.Any<CancellationToken>()).Returns(transaction);
        db.RevokeRefreshTokenFamilyAsync(user.Id, Arg.Any<DateTime>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new InvalidOperationException("revoke failed"));
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByEmailAsync("test@test.com").Returns(user);
        userManager.ResetPasswordAsync(user, "valid-token", "NewPass123!")
            .Returns(IdentityResult.Success);

        var ep = Factory.Create<ResetPasswordEndpoint>(userManager, db, TimeProvider.System);

        var act = () => ep.HandleAsync(new ResetPasswordRequest
        {
            Token = "valid-token",
            Email = "test@test.com",
            NewPassword = "NewPass123!",
            ConfirmPassword = "NewPass123!"
        }, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("revoke failed");
        await transaction.DidNotReceiveWithAnyArgs().CommitAsync(default);
    }

    [Fact]
    public async Task HandleAsync_UserNotFound_ThrowsErrorAndRevokesNothing()
    {
        var db = Substitute.For<IApplicationDbContext>();
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByEmailAsync("missing@test.com").Returns((ApplicationUser?)null);

        var ep = Factory.Create<ResetPasswordEndpoint>(userManager, db, TimeProvider.System);

        var act = () => ep.HandleAsync(new ResetPasswordRequest
        {
            Token = "token",
            Email = "missing@test.com",
            NewPassword = "NewPass123!",
            ConfirmPassword = "NewPass123!"
        }, CancellationToken.None);

        await act.Should().ThrowAsync<ValidationFailureException>();
        await db.DidNotReceiveWithAnyArgs().RevokeRefreshTokenFamilyAsync(default, default, default);
    }

    [Fact]
    public async Task HandleAsync_InvalidToken_ThrowsErrorAndRevokesNothing()
    {
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(), Email = "test@test.com", UserName = "test@test.com",
            FirstName = "T", LastName = "U"
        };

        var db = Substitute.For<IApplicationDbContext>();
        var transaction = Substitute.For<IDbContextTransaction>();
        db.BeginTransactionAsync(Arg.Any<CancellationToken>()).Returns(transaction);
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByEmailAsync("test@test.com").Returns(user);
        userManager.ResetPasswordAsync(user, "bad-token", "NewPass123!")
            .Returns(IdentityResult.Failed(new IdentityError { Description = "Invalid token." }));

        var ep = Factory.Create<ResetPasswordEndpoint>(userManager, db, TimeProvider.System);

        var act = () => ep.HandleAsync(new ResetPasswordRequest
        {
            Token = "bad-token",
            Email = "test@test.com",
            NewPassword = "NewPass123!",
            ConfirmPassword = "NewPass123!"
        }, CancellationToken.None);

        await act.Should().ThrowAsync<ValidationFailureException>();
        await db.DidNotReceiveWithAnyArgs().RevokeRefreshTokenFamilyAsync(default, default, default);
        await transaction.DidNotReceiveWithAnyArgs().CommitAsync(default);
    }

    /// <summary>
    /// Regression test for #656 (email-enumeration oracle). Both the
    /// non-existent-email branch and the existing-email/wrong-token branch
    /// must throw the exact same error message text — otherwise an attacker
    /// can distinguish registered accounts by diffing the response body.
    /// </summary>
    [Fact]
    public async Task HandleAsync_NonExistentEmailAndWrongTokenForExistingEmail_ReturnSameErrorMessage()
    {
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(), Email = "existing@test.com", UserName = "existing@test.com",
            FirstName = "T", LastName = "U"
        };

        var db = Substitute.For<IApplicationDbContext>();

        var userManagerForMissingEmail = EndpointTestHelpers.CreateFakeUserManager();
        userManagerForMissingEmail.FindByEmailAsync("missing@test.com").Returns((ApplicationUser?)null);
        var missingEmailEndpoint = Factory.Create<ResetPasswordEndpoint>(userManagerForMissingEmail, db, TimeProvider.System);

        var userManagerForExistingEmail = EndpointTestHelpers.CreateFakeUserManager();
        userManagerForExistingEmail.FindByEmailAsync("existing@test.com").Returns(user);
        userManagerForExistingEmail.ResetPasswordAsync(user, "bad-token", "NewPass123!")
            .Returns(IdentityResult.Failed(new IdentityError { Code = "InvalidToken", Description = "Invalid token." }));
        var existingEmailEndpoint = Factory.Create<ResetPasswordEndpoint>(userManagerForExistingEmail, db, TimeProvider.System);

        var missingEmailAct = () => missingEmailEndpoint.HandleAsync(new ResetPasswordRequest
        {
            Token = "bad-token",
            Email = "missing@test.com",
            NewPassword = "NewPass123!",
            ConfirmPassword = "NewPass123!"
        }, CancellationToken.None);

        var existingEmailAct = () => existingEmailEndpoint.HandleAsync(new ResetPasswordRequest
        {
            Token = "bad-token",
            Email = "existing@test.com",
            NewPassword = "NewPass123!",
            ConfirmPassword = "NewPass123!"
        }, CancellationToken.None);

        var missingEmailException = await missingEmailAct.Should().ThrowAsync<ValidationFailureException>();
        var existingEmailException = await existingEmailAct.Should().ThrowAsync<ValidationFailureException>();

        var missingEmailMessages = missingEmailException.Which.Failures.Select(f => f.ErrorMessage ?? string.Empty).ToList();
        var existingEmailMessages = existingEmailException.Which.Failures.Select(f => f.ErrorMessage ?? string.Empty).ToList();

        missingEmailMessages.Should().BeEquivalentTo(existingEmailMessages);
        missingEmailMessages.Should().ContainSingle()
            .Which.Should().NotContain("Invalid token").And.NotContain("Invalid reset request");
    }
}
