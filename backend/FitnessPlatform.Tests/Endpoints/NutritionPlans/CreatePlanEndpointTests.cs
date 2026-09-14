using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.NutritionPlans.CreatePlan;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.NutritionPlans;

/// <summary>
/// Tests for <see cref="CreatePlanEndpoint"/>.
/// </summary>
public class CreatePlanEndpointTests
{
    private readonly Guid _nutritionistId = Guid.NewGuid();
    private readonly Guid _clientId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_ValidRequest_CreatesPlan()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();
        var authHelper = CreateAuthHelper(hasLink: true);
        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

        var ep = Factory.Create<CreatePlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, authHelper, db);

        var request = new CreatePlanRequest
        {
            ClientId = _clientId,
            Name = "Weight Loss Plan",
            WeekCount = 2
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await mongo.NutritionPlans.Received(1).InsertOneAsync(
            Arg.Is<NutritionPlan>(p =>
                p.Name == "Weight Loss Plan" &&
                p.ClientId == _clientId &&
                p.NutritionistId == _nutritionistId &&
                p.Status == NutritionPlanStatus.Draft &&
                p.Weeks.Count == 2 &&
                p.Weeks[0].Days.Count == 7),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// #780 Task 3: creating a plan whose date window overlaps an existing Active plan for
    /// the same client must be rejected with 409 + ErrorCodes.PlanOverlap.
    /// </summary>
    [Fact]
    public async Task HandleAsync_OverlappingWindow_Returns409WithPlanOverlapCode()
    {
        var existingPlan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            nutritionistId: _nutritionistId,
            status: NutritionPlanStatus.Active,
            weekCount: 4);
        existingPlan.StartDate = DateTime.UtcNow.Date;

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [existingPlan]);
        var authHelper = CreateAuthHelper(hasLink: true);
        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

        using var responseBody = new MemoryStream();
        var ep = Factory.Create<CreatePlanEndpoint>(
            ctx =>
            {
                ctx.Request.HttpContext.User = new ClaimsPrincipal(
                    new ClaimsIdentity(
                        EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist)));
                ctx.Request.HttpContext.Response.Body = responseBody;
            },
            mongo, authHelper, db);

        // New plan's window [today, today+14) overlaps the existing plan's [today, today+28).
        var request = new CreatePlanRequest
        {
            ClientId = _clientId,
            Name = "Overlapping Plan",
            WeekCount = 2,
            StartDate = DateTime.UtcNow.Date
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(409);

        responseBody.Seek(0, SeekOrigin.Begin);
        using var doc = await System.Text.Json.JsonDocument.ParseAsync(
            responseBody, cancellationToken: TestContext.Current.CancellationToken);
        doc.RootElement.GetProperty("errorCode").GetString().Should().Be(ErrorCodes.PlanOverlap);

        await mongo.NutritionPlans.DidNotReceive().InsertOneAsync(
            Arg.Any<NutritionPlan>(), Arg.Any<InsertOneOptions>(), Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// #780: a new plan whose window does NOT overlap any existing plan for the client must
    /// be created normally, even when an Active plan already exists (multi-plan support).
    /// </summary>
    [Fact]
    public async Task HandleAsync_NonOverlappingWindow_CreatesPlan()
    {
        // Existing Active plan, window fully in the past.
        var existingPlan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            nutritionistId: _nutritionistId,
            status: NutritionPlanStatus.Active,
            weekCount: 2);
        existingPlan.StartDate = DateTime.UtcNow.Date.AddDays(-60);

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [existingPlan]);
        var authHelper = CreateAuthHelper(hasLink: true);
        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

        var ep = Factory.Create<CreatePlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, authHelper, db);

        var request = new CreatePlanRequest
        {
            ClientId = _clientId,
            Name = "New Non-Overlapping Plan",
            WeekCount = 2,
            StartDate = DateTime.UtcNow.Date
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await mongo.NutritionPlans.Received(1).InsertOneAsync(
            Arg.Is<NutritionPlan>(p => p.Name == "New Non-Overlapping Plan"),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// #840 pass-2 fix: QuestionnaireResponse.ClientId is ApplicationUser.Id, not the
    /// trainer-facing ClientProfile.PublicId in req.ClientId. A plan linked to a valid,
    /// submitted questionnaire response for this client must be creatable.
    /// </summary>
    /// <remarks>
    /// #840 test-strengthening: PublicId and UserId must be DISTINCT guids here. With the
    /// same guid for both (the original fixture), the pre-fix comparison
    /// (<c>r.ClientId == req.ClientId</c>) and the post-fix comparison
    /// (<c>r.ClientId == clientUserId</c>) both reduce to true, so the test stays green even
    /// if the questionnaire-link fix in <see cref="CreatePlanEndpoint"/> is reverted. Keeping
    /// them distinct makes the old (broken) comparison actually fail the link check.
    /// </remarks>
    [Fact]
    public async Task HandleAsync_WithValidQuestionnaireResponseLink_CreatesPlan()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();
        var authHelper = CreateAuthHelper(hasLink: true);
        var questionnaireResponseId = Guid.NewGuid();

        // Distinct on purpose — see remarks above. PublicId is the trainer-facing key the
        // endpoint receives on the request; UserId is the ApplicationUser.Id that
        // QuestionnaireResponse.ClientId is actually keyed on.
        var clientPublicId = Guid.NewGuid();
        var clientUserId = Guid.NewGuid();

        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = clientUserId, PublicId = clientPublicId })
            .With(new QuestionnaireResponse
            {
                PublicId = questionnaireResponseId,
                QuestionnaireId = 1,
                ClientId = clientUserId,
                ProfessionalId = _nutritionistId,
                LinkId = 1,
                Status = QuestionnaireResponseStatus.Submitted,
                SubmittedAt = DateTime.UtcNow,
                DateCreated = DateTime.UtcNow,
            })
            .Build();

        var ep = Factory.Create<CreatePlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, authHelper, db);

        var request = new CreatePlanRequest
        {
            ClientId = clientPublicId,
            Name = "Linked Questionnaire Plan",
            WeekCount = 2,
            QuestionnaireResponseId = questionnaireResponseId,
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await mongo.NutritionPlans.Received(1).InsertOneAsync(
            Arg.Is<NutritionPlan>(p =>
                p.Name == "Linked Questionnaire Plan" &&
                p.ClientId == clientUserId &&
                p.QuestionnaireResponseId == questionnaireResponseId),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NoLink_Returns404()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();
        var authHelper = CreateAuthHelper(hasLink: false);
        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

        var ep = Factory.Create<CreatePlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, authHelper, db);

        await ep.HandleAsync(
            new CreatePlanRequest { ClientId = _clientId, Name = "Plan" },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();
        var authHelper = CreateAuthHelper(hasLink: true);
        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<CreatePlanEndpoint>(mongo, authHelper, db);

        await ep.HandleAsync(
            new CreatePlanRequest { ClientId = _clientId, Name = "Plan" },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }

    private static IClientLinkAuthorizationService CreateAuthHelper(bool hasLink) =>
        hasLink
            ? EndpointTestHelpers.CreateGrantingLinkAuthorizationService()
            : PlanTestHelpers.CreateDenyingLinkAuthorizationService();

    /// <summary>
    /// Mirror-site regression guard: this is a nutrition route and must require
    /// <c>CanViewNutritionPlans</c> specifically. A link that grants only the training domain
    /// must still be denied — if the guard were ever widened to <c>caps is not null</c>, this
    /// test would regress to 201.
    /// </summary>
    /// <remarks>
    /// The client profile is seeded so the capability check is the sole source of the 404 —
    /// without it, an empty <c>ClientProfiles</c> would 404 on the profile lookup regardless of
    /// whether the capability guard fired, masking a flag inversion (nutrition &lt;-&gt; training).
    /// </remarks>
    [Fact]
    public async Task HandleAsync_LinkGrantsOnlyTraining_Returns404()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();
        var linkAuthorizationService = EndpointTestHelpers.CreateGrantingLinkAuthorizationService(
            canViewNutritionPlans: false, canViewTrainingPlans: true);
        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

        var ep = Factory.Create<CreatePlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, linkAuthorizationService, db);

        await ep.HandleAsync(
            new CreatePlanRequest { ClientId = _clientId, Name = "Plan" },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }
}
