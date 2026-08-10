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
