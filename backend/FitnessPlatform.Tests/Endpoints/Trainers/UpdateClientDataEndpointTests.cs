using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.Trainers.UpdateClientData;
using FitnessPlatform.Tests.Builders;
using Microsoft.AspNetCore.Identity;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Trainers;

/// <summary>
/// Tests for <see cref="UpdateClientDataEndpoint"/>, in particular the (#667)
/// identity-field write path — trainers persisting a client's first/last name
/// and email from the Edit Profile dialog.
/// </summary>
public class UpdateClientDataEndpointTests
{
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly Guid _clientUserId = Guid.NewGuid();
    private readonly IAuditService _audit = Substitute.For<IAuditService>();

    private static (ProfessionalProfile Trainer, ClientProfile Client, ClientProfessionalLink Link) BuildLinkedPair(
        Guid trainerUserId, Guid clientUserId)
    {
        var trainerProfile = new ProfessionalProfile { Id = 1, UserId = trainerUserId, PublicId = Guid.NewGuid() };
        var clientProfile = new ClientProfile { Id = 1, UserId = clientUserId, PublicId = Guid.NewGuid() };
        var link = new ClientProfessionalLink
        {
            ProfessionalProfileId = trainerProfile.Id,
            ClientProfileId = clientProfile.Id,
            IsActive = true,
            PublicId = Guid.NewGuid(),
            DateCreated = DateTime.UtcNow
        };
        return (trainerProfile, clientProfile, link);
    }

    private UpdateClientDataEndpoint CreateEndpoint(
        FitnessPlatform.Application.Infrastructure.Data.IApplicationDbContext db,
        UserManager<ApplicationUser> userManager) =>
        Factory.Create<UpdateClientDataEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            db, userManager, _audit, new ClientLinkAuthorizationService(db));

    [Fact]
    public async Task HandleAsync_ValidNameAndEmail_UpdatesIdentityFields_Returns200()
    {
        var (trainerProfile, clientProfile, link) = BuildLinkedPair(_trainerId, _clientUserId);
        var db = new MockDbBuilder()
            .With(trainerProfile).With(clientProfile).With(link)
            .Build();

        var clientUser = new ApplicationUser
        {
            Id = _clientUserId, Email = "old@test.com", UserName = "old@test.com",
            FirstName = "Old", LastName = "Name"
        };
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_clientUserId.ToString()).Returns(clientUser);
        userManager.SetEmailAsync(clientUser, "new@test.com").Returns(IdentityResult.Success);
        userManager.SetUserNameAsync(clientUser, "new@test.com").Returns(IdentityResult.Success);
        userManager.UpdateAsync(clientUser).Returns(IdentityResult.Success);

        var ep = CreateEndpoint(db, userManager);

        await ep.HandleAsync(new UpdateClientDataRequest
        {
            ClientId = clientProfile.PublicId,
            FirstName = "New",
            LastName = "Name",
            Email = "new@test.com"
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        clientUser.FirstName.Should().Be("New");
        clientUser.LastName.Should().Be("Name");

        await userManager.Received(1).SetEmailAsync(clientUser, "new@test.com");
        await userManager.Received(1).SetUserNameAsync(clientUser, "new@test.com");
        await userManager.Received(1).UpdateAsync(clientUser);
    }

    [Fact]
    public async Task HandleAsync_DuplicateEmail_ThrowsValidationError_DoesNotSilentlyNoOpOr500()
    {
        var (trainerProfile, clientProfile, link) = BuildLinkedPair(_trainerId, _clientUserId);
        var db = new MockDbBuilder()
            .With(trainerProfile).With(clientProfile).With(link)
            .Build();

        var clientUser = new ApplicationUser
        {
            Id = _clientUserId, Email = "old@test.com", UserName = "old@test.com",
            FirstName = "Old", LastName = "Name"
        };
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_clientUserId.ToString()).Returns(clientUser);
        userManager.SetEmailAsync(clientUser, "taken@test.com")
            .Returns(IdentityResult.Failed(new IdentityError { Code = "DuplicateEmail", Description = "Email 'taken@test.com' is already taken." }));

        var ep = CreateEndpoint(db, userManager);

        var act = () => ep.HandleAsync(new UpdateClientDataRequest
        {
            ClientId = clientProfile.PublicId,
            Email = "taken@test.com"
        }, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<ValidationFailureException>();

        // The username must never be touched when the email uniqueness check fails —
        // no partial/silent write.
        await userManager.DidNotReceive().SetUserNameAsync(Arg.Any<ApplicationUser>(), Arg.Any<string>());
    }

    [Fact]
    public async Task HandleAsync_NoActiveLink_Returns404_AndDoesNotTouchIdentity()
    {
        var (trainerProfile, clientProfile, _) = BuildLinkedPair(_trainerId, _clientUserId);
        // No link added — the trainer has no active relationship to this client.
        var db = new MockDbBuilder()
            .With(trainerProfile).With(clientProfile)
            .Build();

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        var ep = CreateEndpoint(db, userManager);

        await ep.HandleAsync(new UpdateClientDataRequest
        {
            ClientId = clientProfile.PublicId,
            FirstName = "New"
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
        await userManager.DidNotReceive().FindByIdAsync(Arg.Any<string>());
    }

    [Fact]
    public async Task HandleAsync_SameEmailCasingDifference_DoesNotCallSetEmailAsync()
    {
        var (trainerProfile, clientProfile, link) = BuildLinkedPair(_trainerId, _clientUserId);
        var db = new MockDbBuilder()
            .With(trainerProfile).With(clientProfile).With(link)
            .Build();

        var clientUser = new ApplicationUser
        {
            Id = _clientUserId, Email = "same@test.com", UserName = "same@test.com",
            FirstName = "Old", LastName = "Name"
        };
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_clientUserId.ToString()).Returns(clientUser);

        var ep = CreateEndpoint(db, userManager);

        await ep.HandleAsync(new UpdateClientDataRequest
        {
            ClientId = clientProfile.PublicId,
            Email = "SAME@TEST.COM"
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        await userManager.DidNotReceive().SetEmailAsync(Arg.Any<ApplicationUser>(), Arg.Any<string>());
    }
}
