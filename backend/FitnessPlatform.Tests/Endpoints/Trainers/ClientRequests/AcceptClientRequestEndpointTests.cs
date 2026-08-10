using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Trainers.ClientRequests.AcceptClientRequest;
using FitnessPlatform.Tests.Builders;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Trainers.ClientRequests;

/// <summary>
/// Tests for <see cref="AcceptClientRequestEndpoint"/>, in particular the plan-view
/// permission flags granted on the created/reactivated <see cref="ClientProfessionalLink"/>.
///
/// Regression coverage for #776 — a professional holding BOTH the Trainer and
/// Nutritionist roles must be granted CanViewTrainingPlans AND CanViewNutritionPlans.
/// Previously the endpoint resolved a single, mutually-exclusive "professionalRole"
/// from identity roles (biased toward Nutritionist) and used it to set both flags,
/// which meant accepting ANY client request as a dual-role professional reset
/// CanViewTrainingPlans back to false — even on an existing link that already had it
/// granted true from an earlier Trainer-only acceptance.
/// </summary>
public class AcceptClientRequestEndpointTests
{
    private readonly Guid _professionalUserId = Guid.NewGuid();
    private readonly INotificationService _notificationService = Substitute.For<INotificationService>();
    private readonly IRealtimeNotifier _notifier = Substitute.For<IRealtimeNotifier>();
    private readonly UserManager<ApplicationUser> _userManager = EndpointTestHelpers.CreateFakeUserManager();

    private static Claim[] MultiRoleClaims(Guid userId, params string[] roles) =>
    [
        new Claim(AppClaims.UserId, userId.ToString()),
        new Claim(AppClaims.Email, "professional@test.com"),
        .. roles.Select(r => new Claim(ClaimTypes.Role, r))
    ];

    private ApplicationUser CreateProfessionalUser() => new()
    {
        Id = _professionalUserId,
        Email = "professional@test.com",
        FirstName = "Pat",
        LastName = "Pro"
    };

    private AcceptClientRequestEndpoint CreateEndpoint(
        FitnessPlatform.Application.Infrastructure.Data.IApplicationDbContext db,
        params string[] callerRoles) =>
        Factory.Create<AcceptClientRequestEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(MultiRoleClaims(_professionalUserId, callerRoles))),
            db, _notifier, _notificationService, _userManager,
            Substitute.For<ILogger<AcceptClientRequestEndpoint>>());

    /// <summary>
    /// Existing link already has CanViewTrainingPlans=true from a prior Trainer-only
    /// acceptance. The professional now also holds the Nutritionist role and accepts a
    /// second (or re-processed) request for the same client — the training flag must
    /// survive, and the nutrition flag must now also be granted.
    /// </summary>
    [Fact]
    public async Task Accept_DualRoleProfessional_ExistingTrainerLink_GrantsBothFlags_KeepsTrainingAccess()
    {
        var professionalUser = CreateProfessionalUser();
        var professionalProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUser(professionalUser).Build();

        var clientUser = EntityBuilder.User.WithEmail("client@test.com")
            .WithFirstName("C").WithLastName("Lient").Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(1).WithUser(clientUser).Build();

        var existingLink = EntityBuilder.ClientProfessionalLink
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(professionalProfile)
            .WithProfessionalRole(UserRole.Trainer)
            .WithCanViewTrainingPlans(true)
            .WithCanViewNutritionPlans(false)
            .Build();

        var clientRequest = new ClientRequest
        {
            PublicId = Guid.NewGuid(),
            ClientProfileId = clientProfile.Id,
            ClientProfile = clientProfile,
            ProfessionalProfileId = professionalProfile.Id,
            ProfessionalProfile = professionalProfile,
            Status = ClientRequestStatus.Pending
        };

        var db = new MockDbBuilder()
            .With(professionalUser)
            .With(professionalProfile)
            .With(clientProfile)
            .With(existingLink)
            .With(clientRequest)
            .Build();

        var ep = CreateEndpoint(db, AppRoles.Trainer, AppRoles.Nutritionist);

        await ep.HandleAsync(
            new AcceptClientRequestRequest { PublicId = clientRequest.PublicId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);
        existingLink.CanViewTrainingPlans.Should().BeTrue(
            "the professional still holds the Trainer role and must not lose training-plan access");
        existingLink.CanViewNutritionPlans.Should().BeTrue(
            "the professional now also holds the Nutritionist role and must gain nutrition-plan access");
    }

    /// <summary>
    /// New link, single-role (Trainer only) professional — unaffected by the fix,
    /// preserves prior single-role behavior.
    /// </summary>
    [Fact]
    public async Task Accept_TrainerOnlyProfessional_NewLink_GrantsTrainingAccessOnly()
    {
        var professionalUser = CreateProfessionalUser();
        var professionalProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUser(professionalUser).Build();

        var clientUser = EntityBuilder.User.WithEmail("client2@test.com")
            .WithFirstName("C").WithLastName("Lient").Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(1).WithUser(clientUser).Build();

        var clientRequest = new ClientRequest
        {
            PublicId = Guid.NewGuid(),
            ClientProfileId = clientProfile.Id,
            ClientProfile = clientProfile,
            ProfessionalProfileId = professionalProfile.Id,
            ProfessionalProfile = professionalProfile,
            Status = ClientRequestStatus.Pending
        };

        var db = new MockDbBuilder()
            .With(professionalUser)
            .With(professionalProfile)
            .With(clientProfile)
            .With(clientRequest)
            .Build();

        var ep = CreateEndpoint(db, AppRoles.Trainer);

        await ep.HandleAsync(
            new AcceptClientRequestRequest { PublicId = clientRequest.PublicId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);
        db.ClientProfessionalLinks.Received(1).Add(Arg.Is<ClientProfessionalLink>(
            l => l.CanViewTrainingPlans && !l.CanViewNutritionPlans));
    }

    /// <summary>
    /// Dual-role professional explicitly narrows the new link to nutrition only, even
    /// though they also hold the Trainer role — the explicit scope wins over the
    /// full-held-role default.
    /// </summary>
    [Fact]
    public async Task Accept_DualRoleProfessional_ExplicitNutritionOnlyScope_GrantsNutritionOnly()
    {
        var professionalUser = CreateProfessionalUser();
        var professionalProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUser(professionalUser).Build();

        var clientUser = EntityBuilder.User.WithEmail("client3@test.com")
            .WithFirstName("C").WithLastName("Lient").Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(1).WithUser(clientUser).Build();

        var clientRequest = new ClientRequest
        {
            PublicId = Guid.NewGuid(),
            ClientProfileId = clientProfile.Id,
            ClientProfile = clientProfile,
            ProfessionalProfileId = professionalProfile.Id,
            ProfessionalProfile = professionalProfile,
            Status = ClientRequestStatus.Pending
        };

        var db = new MockDbBuilder()
            .With(professionalUser)
            .With(professionalProfile)
            .With(clientProfile)
            .With(clientRequest)
            .Build();

        var ep = CreateEndpoint(db, AppRoles.Trainer, AppRoles.Nutritionist);

        await ep.HandleAsync(
            new AcceptClientRequestRequest
            {
                PublicId = clientRequest.PublicId,
                RequestedScope = LinkCapabilityScope.NutritionOnly
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);
        db.ClientProfessionalLinks.Received(1).Add(Arg.Is<ClientProfessionalLink>(
            l => l.CanViewNutritionPlans && !l.CanViewTrainingPlans));
    }

    /// <summary>
    /// Reactivate path: an existing link already grants both flags from a prior
    /// dual-role acceptance. Explicitly requesting TrainingOnly on reactivation must
    /// overwrite the stale nutrition flag to false, not merge/preserve it.
    /// </summary>
    [Fact]
    public async Task Accept_DualRoleProfessional_ReactivateWithExplicitTrainingOnlyScope_NarrowsAwayStaleNutritionFlag()
    {
        var professionalUser = CreateProfessionalUser();
        var professionalProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUser(professionalUser).Build();

        var clientUser = EntityBuilder.User.WithEmail("client4@test.com")
            .WithFirstName("C").WithLastName("Lient").Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(1).WithUser(clientUser).Build();

        var existingLink = EntityBuilder.ClientProfessionalLink
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(professionalProfile)
            .WithProfessionalRole(UserRole.Nutritionist)
            .WithCanViewTrainingPlans(true)
            .WithCanViewNutritionPlans(true)
            .Build();

        var clientRequest = new ClientRequest
        {
            PublicId = Guid.NewGuid(),
            ClientProfileId = clientProfile.Id,
            ClientProfile = clientProfile,
            ProfessionalProfileId = professionalProfile.Id,
            ProfessionalProfile = professionalProfile,
            Status = ClientRequestStatus.Pending
        };

        var db = new MockDbBuilder()
            .With(professionalUser)
            .With(professionalProfile)
            .With(clientProfile)
            .With(existingLink)
            .With(clientRequest)
            .Build();

        var ep = CreateEndpoint(db, AppRoles.Trainer, AppRoles.Nutritionist);

        await ep.HandleAsync(
            new AcceptClientRequestRequest
            {
                PublicId = clientRequest.PublicId,
                RequestedScope = LinkCapabilityScope.TrainingOnly
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);
        existingLink.CanViewTrainingPlans.Should().BeTrue();
        existingLink.CanViewNutritionPlans.Should().BeFalse(
            "the explicit TrainingOnly scope must overwrite the stale nutrition flag, not preserve it");
    }

    /// <summary>
    /// Security invariant (#917): a Trainer-only professional cannot request
    /// NutritionOnly scope for themselves — the requested scope must be validated as a
    /// subset of the caller's actually-held roles. Deleting the subset check makes this
    /// test fail (proven and reverted — see PR description).
    /// </summary>
    [Fact]
    public async Task Accept_TrainerOnlyProfessional_RequestsNutritionOnlyScope_Returns400WithErrorCode()
    {
        var professionalUser = CreateProfessionalUser();
        var professionalProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUser(professionalUser).Build();

        var clientUser = EntityBuilder.User.WithEmail("client5@test.com")
            .WithFirstName("C").WithLastName("Lient").Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(1).WithUser(clientUser).Build();

        var clientRequest = new ClientRequest
        {
            PublicId = Guid.NewGuid(),
            ClientProfileId = clientProfile.Id,
            ClientProfile = clientProfile,
            ProfessionalProfileId = professionalProfile.Id,
            ProfessionalProfile = professionalProfile,
            Status = ClientRequestStatus.Pending
        };

        var db = new MockDbBuilder()
            .With(professionalUser)
            .With(professionalProfile)
            .With(clientProfile)
            .With(clientRequest)
            .Build();

        var ep = CreateEndpoint(db, AppRoles.Trainer);

        var act = () => ep.HandleAsync(
            new AcceptClientRequestRequest
            {
                PublicId = clientRequest.PublicId,
                RequestedScope = LinkCapabilityScope.NutritionOnly
            },
            TestContext.Current.CancellationToken);

        var exception = await act.Should().ThrowAsync<ValidationFailureException>();
        exception.Which.Failures.Should().ContainSingle(
            f => f.ErrorCode == ErrorCodes.RequestedScopeExceedsHeldRoles);
        db.ClientProfessionalLinks.DidNotReceive().Add(Arg.Any<ClientProfessionalLink>());
    }
}
