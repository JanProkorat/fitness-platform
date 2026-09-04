using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Trainers.CreateCollaboration;
using FitnessPlatform.Tests.Builders;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Trainers;

public class CreateCollaborationEndpointTests
{
    private readonly Guid _trainerAId = Guid.NewGuid();
    private readonly Guid _trainerBId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_ValidRequest_CreatesLink()
    {
        var trainerBUser = EntityBuilder.User.WithId(_trainerBId).WithEmail("b@test.com")
            .WithFirstName("B").WithLastName("Trainer").Build();
        var trainerAProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerAId).Build();
        var trainerBProfile = EntityBuilder.ProfessionalProfile.WithId(2).WithUser(trainerBUser).Build();

        var clientUser = EntityBuilder.User.WithEmail("client@test.com")
            .WithFirstName("C").WithLastName("U").Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(1).WithUser(clientUser).Build();

        var existingLink = EntityBuilder.ClientProfessionalLink
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(trainerAProfile)
            .Build();

        var db = new MockDbBuilder()
            .With(trainerAProfile)
            .With(trainerBProfile)
            .With(clientProfile)
            .With(existingLink)
            .Build();

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.GetRolesAsync(trainerBUser).Returns(["Trainer"]);

        var ep = Factory.Create<CreateCollaborationEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerAId, AppRoles.Trainer))),
            db, userManager);

        await ep.HandleAsync(new CreateCollaborationRequest
        {
            ClientPublicId = clientProfile.PublicId,
            CollaboratorPublicId = trainerBProfile.PublicId
        }, TestContext.Current.CancellationToken);

        ep.ValidationFailed.Should().BeFalse();
        ep.HttpContext.Response.StatusCode.Should().Be(201);
        db.ClientProfessionalLinks.Received(1).Add(Arg.Is<ClientProfessionalLink>(
            l => l.ProfessionalProfileId == trainerBProfile.Id && l.ClientProfileId == clientProfile.Id));
    }

    /// <summary>
    /// Collaborator holds both Trainer and Nutritionist roles, no explicit scope
    /// requested — defaults to granting both flags, matching current behavior (#776).
    /// </summary>
    [Fact]
    public async Task HandleAsync_DualRoleCollaborator_NoExplicitScope_GrantsBothFlags()
    {
        var trainerBUser = EntityBuilder.User.WithId(_trainerBId).WithEmail("b@test.com")
            .WithFirstName("B").WithLastName("Trainer").Build();
        var trainerAProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerAId).Build();
        var trainerBProfile = EntityBuilder.ProfessionalProfile.WithId(2).WithUser(trainerBUser).Build();

        var clientUser = EntityBuilder.User.WithEmail("client-dual@test.com")
            .WithFirstName("C").WithLastName("U").Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(1).WithUser(clientUser).Build();

        var existingLink = EntityBuilder.ClientProfessionalLink
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(trainerAProfile)
            .Build();

        var db = new MockDbBuilder()
            .With(trainerAProfile)
            .With(trainerBProfile)
            .With(clientProfile)
            .With(existingLink)
            .Build();

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.GetRolesAsync(trainerBUser).Returns(["Trainer", "Nutritionist"]);

        var ep = Factory.Create<CreateCollaborationEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerAId, AppRoles.Trainer))),
            db, userManager);

        await ep.HandleAsync(new CreateCollaborationRequest
        {
            ClientPublicId = clientProfile.PublicId,
            CollaboratorPublicId = trainerBProfile.PublicId
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);
        db.ClientProfessionalLinks.Received(1).Add(Arg.Is<ClientProfessionalLink>(
            l => l.CanViewNutritionPlans && l.CanViewTrainingPlans));
    }

    /// <summary>
    /// Collaborator holds both roles but the caller explicitly narrows the new link to
    /// nutrition only — the explicit scope wins over the full-held-role default.
    /// </summary>
    [Fact]
    public async Task HandleAsync_DualRoleCollaborator_ExplicitNutritionOnlyScope_GrantsNutritionOnly()
    {
        var trainerBUser = EntityBuilder.User.WithId(_trainerBId).WithEmail("b@test.com")
            .WithFirstName("B").WithLastName("Trainer").Build();
        var trainerAProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerAId).Build();
        var trainerBProfile = EntityBuilder.ProfessionalProfile.WithId(2).WithUser(trainerBUser).Build();

        var clientUser = EntityBuilder.User.WithEmail("client-scope@test.com")
            .WithFirstName("C").WithLastName("U").Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(1).WithUser(clientUser).Build();

        var existingLink = EntityBuilder.ClientProfessionalLink
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(trainerAProfile)
            .Build();

        var db = new MockDbBuilder()
            .With(trainerAProfile)
            .With(trainerBProfile)
            .With(clientProfile)
            .With(existingLink)
            .Build();

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.GetRolesAsync(trainerBUser).Returns(["Trainer", "Nutritionist"]);

        var ep = Factory.Create<CreateCollaborationEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerAId, AppRoles.Trainer))),
            db, userManager);

        await ep.HandleAsync(new CreateCollaborationRequest
        {
            ClientPublicId = clientProfile.PublicId,
            CollaboratorPublicId = trainerBProfile.PublicId,
            RequestedScope = LinkCapabilityScope.NutritionOnly
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);
        db.ClientProfessionalLinks.Received(1).Add(Arg.Is<ClientProfessionalLink>(
            l => l.CanViewNutritionPlans && !l.CanViewTrainingPlans));
    }

    /// <summary>
    /// Security invariant (#917): a Trainer-only collaborator cannot be granted
    /// NutritionOnly scope — the requested scope must be validated as a subset of the
    /// roles the collaborator actually holds. Deleting the subset check makes this test
    /// fail (proven and reverted — see PR description).
    /// </summary>
    [Fact]
    public async Task HandleAsync_TrainerOnlyCollaborator_RequestsNutritionOnlyScope_Returns400WithErrorCode()
    {
        var trainerBUser = EntityBuilder.User.WithId(_trainerBId).WithEmail("b@test.com")
            .WithFirstName("B").WithLastName("Trainer").Build();
        var trainerAProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerAId).Build();
        var trainerBProfile = EntityBuilder.ProfessionalProfile.WithId(2).WithUser(trainerBUser).Build();

        var clientUser = EntityBuilder.User.WithEmail("client-block@test.com")
            .WithFirstName("C").WithLastName("U").Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(1).WithUser(clientUser).Build();

        var existingLink = EntityBuilder.ClientProfessionalLink
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(trainerAProfile)
            .Build();

        var db = new MockDbBuilder()
            .With(trainerAProfile)
            .With(trainerBProfile)
            .With(clientProfile)
            .With(existingLink)
            .Build();

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.GetRolesAsync(trainerBUser).Returns(["Trainer"]);

        var ep = Factory.Create<CreateCollaborationEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerAId, AppRoles.Trainer))),
            db, userManager);

        var act = () => ep.HandleAsync(new CreateCollaborationRequest
        {
            ClientPublicId = clientProfile.PublicId,
            CollaboratorPublicId = trainerBProfile.PublicId,
            RequestedScope = LinkCapabilityScope.NutritionOnly
        }, TestContext.Current.CancellationToken);

        var exception = await act.Should().ThrowAsync<ValidationFailureException>();
        exception.Which.Failures.Should().ContainSingle(
            f => f.ErrorCode == ErrorCodes.RequestedScopeExceedsHeldRoles);
        db.ClientProfessionalLinks.DidNotReceive().Add(Arg.Any<ClientProfessionalLink>());
    }

    /// <summary>
    /// Security invariant (sec-f2): a caller whose own link only grants nutrition
    /// visibility cannot mint a collaborator link that grants training visibility,
    /// even when the collaborator holds the Trainer role. The intersection of the
    /// collaborator's held roles and the caller's own link flags collapses to
    /// both-false here (collaborator isn't a nutritionist; caller can't delegate
    /// training) — the endpoint rejects (400) rather than persist a link the rest
    /// of the system already treats as invalid (every gated read endpoint 403s a
    /// link with neither CanView* flag, #916). No row must be created — assert the
    /// absence of the write, not just the status code.
    /// </summary>
    [Fact]
    public async Task HandleAsync_NutritionOnlyLinkedCaller_TrainerOnlyCollaborator_Returns400_NoLinkCreated()
    {
        var trainerBUser = EntityBuilder.User.WithId(_trainerBId).WithEmail("b@test.com")
            .WithFirstName("B").WithLastName("Trainer").Build();
        var trainerAProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerAId).Build();
        var trainerBProfile = EntityBuilder.ProfessionalProfile.WithId(2).WithUser(trainerBUser).Build();

        var clientUser = EntityBuilder.User.WithEmail("client-clamp@test.com")
            .WithFirstName("C").WithLastName("U").Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(1).WithUser(clientUser).Build();

        // Caller's own link is nutrition-only — no training visibility to delegate.
        var existingLink = EntityBuilder.ClientProfessionalLink
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(trainerAProfile)
            .WithCanViewNutritionPlans(true)
            .WithCanViewTrainingPlans(false)
            .Build();

        var db = new MockDbBuilder()
            .With(trainerAProfile)
            .With(trainerBProfile)
            .With(clientProfile)
            .With(existingLink)
            .Build();

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.GetRolesAsync(trainerBUser).Returns(["Trainer"]);

        var ep = Factory.Create<CreateCollaborationEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerAId, AppRoles.Nutritionist))),
            db, userManager);

        var act = () => ep.HandleAsync(new CreateCollaborationRequest
        {
            ClientPublicId = clientProfile.PublicId,
            CollaboratorPublicId = trainerBProfile.PublicId
        }, TestContext.Current.CancellationToken);

        var exception = await act.Should().ThrowAsync<ValidationFailureException>();
        exception.Which.Failures.Should().ContainSingle(
            f => f.ErrorCode == ErrorCodes.RequestedScopeExceedsHeldRoles);
        db.ClientProfessionalLinks.DidNotReceive().Add(Arg.Any<ClientProfessionalLink>());
    }

    /// <summary>
    /// Security invariant (sec-f2): a caller whose own link grants neither CanView*
    /// flag has nothing to delegate at all and is rejected outright, before the
    /// collaborator is even looked up.
    /// </summary>
    [Fact]
    public async Task HandleAsync_CallerLinkGrantsNoCapability_Returns400WithErrorCode()
    {
        var trainerBUser = EntityBuilder.User.WithId(_trainerBId).WithEmail("b@test.com")
            .WithFirstName("B").WithLastName("Trainer").Build();
        var trainerAProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerAId).Build();
        var trainerBProfile = EntityBuilder.ProfessionalProfile.WithId(2).WithUser(trainerBUser).Build();

        var clientUser = EntityBuilder.User.WithEmail("client-nocap@test.com")
            .WithFirstName("C").WithLastName("U").Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(1).WithUser(clientUser).Build();

        // Caller's link is active but grants neither capability.
        var existingLink = EntityBuilder.ClientProfessionalLink
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(trainerAProfile)
            .WithCanViewNutritionPlans(false)
            .WithCanViewTrainingPlans(false)
            .Build();

        var db = new MockDbBuilder()
            .With(trainerAProfile)
            .With(trainerBProfile)
            .With(clientProfile)
            .With(existingLink)
            .Build();

        var userManager = EndpointTestHelpers.CreateFakeUserManager();

        var ep = Factory.Create<CreateCollaborationEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerAId, AppRoles.Trainer))),
            db, userManager);

        var act = () => ep.HandleAsync(new CreateCollaborationRequest
        {
            ClientPublicId = clientProfile.PublicId,
            CollaboratorPublicId = trainerBProfile.PublicId
        }, TestContext.Current.CancellationToken);

        var exception = await act.Should().ThrowAsync<ValidationFailureException>();
        exception.Which.Failures.Should().ContainSingle(
            f => f.ErrorCode == ErrorCodes.RequestedScopeExceedsHeldRoles);
        db.ClientProfessionalLinks.DidNotReceive().Add(Arg.Any<ClientProfessionalLink>());
    }

    /// <summary>
    /// Security invariant (sec-f2): a fully-capable caller (both CanView* flags) can
    /// still create a collaboration with a collaborator holding only one role — the
    /// stamped flags equal the intersection, which here collapses to exactly what the
    /// collaborator's own role permits.
    /// </summary>
    [Fact]
    public async Task HandleAsync_FullyCapableCaller_TrainerOnlyCollaborator_StampsIntersection()
    {
        var trainerBUser = EntityBuilder.User.WithId(_trainerBId).WithEmail("b@test.com")
            .WithFirstName("B").WithLastName("Trainer").Build();
        var trainerAProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerAId).Build();
        var trainerBProfile = EntityBuilder.ProfessionalProfile.WithId(2).WithUser(trainerBUser).Build();

        var clientUser = EntityBuilder.User.WithEmail("client-full@test.com")
            .WithFirstName("C").WithLastName("U").Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(1).WithUser(clientUser).Build();

        // Caller's own link grants both capabilities — no clamping ceiling from the caller.
        var existingLink = EntityBuilder.ClientProfessionalLink
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(trainerAProfile)
            .WithCanViewNutritionPlans(true)
            .WithCanViewTrainingPlans(true)
            .Build();

        var db = new MockDbBuilder()
            .With(trainerAProfile)
            .With(trainerBProfile)
            .With(clientProfile)
            .With(existingLink)
            .Build();

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.GetRolesAsync(trainerBUser).Returns(["Trainer"]);

        var ep = Factory.Create<CreateCollaborationEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerAId, AppRoles.Trainer))),
            db, userManager);

        await ep.HandleAsync(new CreateCollaborationRequest
        {
            ClientPublicId = clientProfile.PublicId,
            CollaboratorPublicId = trainerBProfile.PublicId
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);
        db.ClientProfessionalLinks.Received(1).Add(Arg.Is<ClientProfessionalLink>(
            l => l.CanViewTrainingPlans && !l.CanViewNutritionPlans));
    }

    /// <summary>
    /// A client may hold at most one active coach per profession (#980). The
    /// collaborator would gain CanViewNutritionPlans, but a THIRD professional (not the
    /// caller, not the collaborator) already holds an active link with that flag —
    /// CreateCollaboration previously had no profession check at all, only a check on
    /// the caller's own capabilities.
    /// </summary>
    [Fact]
    public async Task HandleAsync_ThirdProfessionalOccupiesNutritionSlot_Returns400WithErrorCode()
    {
        var trainerBUser = EntityBuilder.User.WithId(_trainerBId).WithEmail("b@test.com")
            .WithFirstName("B").WithLastName("Trainer").Build();
        var trainerAProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerAId).Build();
        var trainerBProfile = EntityBuilder.ProfessionalProfile.WithId(2).WithUser(trainerBUser).Build();

        var occupyingUser = EntityBuilder.User.WithEmail("occupying-nutritionist@test.com")
            .WithFirstName("O").WithLastName("N").Build();
        var occupyingProfile = EntityBuilder.ProfessionalProfile.WithId(3).WithUser(occupyingUser).Build();

        var clientUser = EntityBuilder.User.WithEmail("client-third@test.com")
            .WithFirstName("C").WithLastName("U").Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(1).WithUser(clientUser).Build();

        // Caller's own link grants both capabilities — nothing to clamp the delegation.
        var callerLink = EntityBuilder.ClientProfessionalLink
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(trainerAProfile)
            .WithCanViewNutritionPlans(true)
            .WithCanViewTrainingPlans(true)
            .Build();

        // A different, third professional already occupies the nutrition slot.
        var occupyingLink = EntityBuilder.ClientProfessionalLink
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(occupyingProfile)
            .WithCanViewNutritionPlans(true)
            .WithCanViewTrainingPlans(false)
            .Build();

        var db = new MockDbBuilder()
            .With(trainerAProfile)
            .With(trainerBProfile)
            .With(occupyingProfile)
            .With(clientProfile)
            .With(callerLink)
            .With(occupyingLink)
            .Build();

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.GetRolesAsync(trainerBUser).Returns(["Trainer", "Nutritionist"]);

        var ep = Factory.Create<CreateCollaborationEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerAId, AppRoles.Trainer))),
            db, userManager);

        var act = () => ep.HandleAsync(new CreateCollaborationRequest
        {
            ClientPublicId = clientProfile.PublicId,
            CollaboratorPublicId = trainerBProfile.PublicId
        }, TestContext.Current.CancellationToken);

        var exception = await act.Should().ThrowAsync<ValidationFailureException>();
        exception.Which.Failures.Should().ContainSingle(
            f => f.ErrorCode == ErrorCodes.ProfessionAlreadyOccupied);
        db.ClientProfessionalLinks.DidNotReceive().Add(Arg.Any<ClientProfessionalLink>());
    }

    [Fact]
    public async Task HandleAsync_NoActiveLink_ThrowsError()
    {
        var trainerAProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerAId).Build();
        var clientUser = EntityBuilder.User.WithEmail("c@test.com")
            .WithFirstName("C").WithLastName("U").Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(1).WithUser(clientUser).Build();

        var db = new MockDbBuilder()
            .With(trainerAProfile)
            .With(clientProfile)
            .Build();

        var userManager = EndpointTestHelpers.CreateFakeUserManager();

        var ep = Factory.Create<CreateCollaborationEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerAId, AppRoles.Trainer))),
            db, userManager);

        var act = () => ep.HandleAsync(new CreateCollaborationRequest
        {
            ClientPublicId = clientProfile.PublicId,
            CollaboratorPublicId = Guid.NewGuid()
        }, CancellationToken.None);

        await act.Should().ThrowAsync<ValidationFailureException>();
    }

    [Fact]
    public async Task HandleAsync_CollaboratorAlreadyLinked_ThrowsError()
    {
        var trainerBUser = EntityBuilder.User.WithId(_trainerBId).WithEmail("b@test.com")
            .WithFirstName("B").WithLastName("Trainer").Build();
        var trainerAProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerAId).Build();
        var trainerBProfile = EntityBuilder.ProfessionalProfile.WithId(2).WithUser(trainerBUser).Build();

        var clientUser = EntityBuilder.User.WithEmail("client@test.com")
            .WithFirstName("C").WithLastName("U").Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(1).WithUser(clientUser).Build();

        var linkA = EntityBuilder.ClientProfessionalLink
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(trainerAProfile)
            .Build();
        var linkB = EntityBuilder.ClientProfessionalLink
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(trainerBProfile)
            .Build();

        var db = new MockDbBuilder()
            .With(trainerAProfile)
            .With(trainerBProfile)
            .With(clientProfile)
            .With(linkA)
            .With(linkB)
            .Build();

        var userManager = EndpointTestHelpers.CreateFakeUserManager();

        var ep = Factory.Create<CreateCollaborationEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerAId, AppRoles.Trainer))),
            db, userManager);

        var act = () => ep.HandleAsync(new CreateCollaborationRequest
        {
            ClientPublicId = clientProfile.PublicId,
            CollaboratorPublicId = trainerBProfile.PublicId
        }, CancellationToken.None);

        await act.Should().ThrowAsync<ValidationFailureException>();
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var db = new MockDbBuilder().Build();
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        var ep = Factory.Create<CreateCollaborationEndpoint>(db, userManager);

        await ep.HandleAsync(new CreateCollaborationRequest
        {
            ClientPublicId = Guid.NewGuid(),
            CollaboratorPublicId = Guid.NewGuid()
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }

    [Fact]
    public async Task HandleAsync_NoProfessionalProfile_Returns404()
    {
        var db = new MockDbBuilder().Build();
        var userManager = EndpointTestHelpers.CreateFakeUserManager();

        var ep = Factory.Create<CreateCollaborationEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerAId, AppRoles.Trainer))),
            db, userManager);

        await ep.HandleAsync(new CreateCollaborationRequest
        {
            ClientPublicId = Guid.NewGuid(),
            CollaboratorPublicId = Guid.NewGuid()
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }
}
