using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Trainers.GetClientDashboard;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.NutritionPlans;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Trainers;

/// <summary>
/// Verifies that GetClientDashboardResponse correctly surfaces the
/// CanViewNutritionPlans and CanViewTrainingPlans flags from the
/// ClientProfessionalLink row — matching the seeded link value on the wire.
/// </summary>
public class GetClientDashboardPermissionFlagsTests
{
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly IAuditService _audit = Substitute.For<IAuditService>();

    // Stub the compliance service to return a non-null ComplianceResult so the happy path
    // is exercised in all permission-flag tests. The endpoint has a catch path that
    // logs a warning on compliance failure; providing a real stub keeps the test focused on
    // the CanViewNutritionPlans/CanViewTrainingPlans assertions rather than graceful degradation.
    // Pattern matches TrainingCompletionTestHelpers.CreateStubComplianceService().
    //
    // The three percent values are DELIBERATELY distinct (50/80/20) — a stub with all three
    // at the same value (e.g. all 0m) cannot discriminate whether GetClientDashboardEndpoint
    // is actually substituting NutritionCompliancePercent/TrainingCompliancePercent into the
    // wire-level CompliancePercent field for a single-flag caller, or silently passing through
    // the combined figure. See #916 rework: a prior version of this stub made that bug
    // invisible to every test in this file.
    private readonly IComplianceService _complianceService = CreateStubComplianceService();

    private static IComplianceService CreateStubComplianceService()
    {
        var svc = Substitute.For<IComplianceService>();
        svc.CalculateComplianceAsync(
                Arg.Any<Guid>(), Arg.Any<DateTime>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>())
            .Returns(new ComplianceResult
            {
                CompliancePercent = 50m,
                NutritionCompliancePercent = 80m,
                TrainingCompliancePercent = 20m
            });
        // The endpoint always calls the discipline-aware 3-arg overload (never the
        // parameterless 2-arg one, which defaults to ComplianceDiscipline.Both) — stub that
        // overload, not the 2-arg one.
        svc.CalculateStreakAsync(Arg.Any<Guid>(), Arg.Any<ComplianceDiscipline>(), Arg.Any<CancellationToken>())
            .Returns(0);
        return svc;
    }

    private static System.Security.Claims.ClaimsPrincipal TrainerPrincipal(Guid trainerId) =>
        new(new System.Security.Claims.ClaimsIdentity(
            EndpointTestHelpers.FakeUserClaims(trainerId, AppRoles.Trainer)));

    [Fact]
    public async Task HandleAsync_LinkWithCanViewNutritionPlansFalse_ReturnsFalseOnWire()
    {
        // Arrange: link with CanViewNutritionPlans=false, CanViewTrainingPlans=true
        var clientUser = EntityBuilder.User.WithEmail("noplans@test.com")
            .WithFirstName("No").WithLastName("Plans").Build();
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(10).WithUserId(_trainerId).Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(10).WithUser(clientUser).Build();
        var link = EntityBuilder.ClientProfessionalLink
            .WithId(200)
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(trainerProfile)
            .WithCanViewNutritionPlans(false)
            .WithCanViewTrainingPlans(true)
            .Build();

        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(clientProfile)
            .With(link)
            .Build();

        var ep = Factory.Create<GetClientDashboardEndpoint>(
            ctx => ctx.Request.HttpContext.User = TrainerPrincipal(_trainerId),
            db, _audit, _complianceService, PlanTestHelpers.CreateMockMongo());

        // Act
        await ep.HandleAsync(new GetClientDashboardRequest
        {
            ClientId = clientProfile.PublicId
        }, TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.CanViewNutritionPlans.Should().BeFalse();
        ep.Response.CanViewTrainingPlans.Should().BeTrue();
    }

    [Fact]
    public async Task HandleAsync_LinkWithCanViewNutritionPlansTrue_ReturnsTrueOnWire()
    {
        // Arrange: link with CanViewNutritionPlans=true, CanViewTrainingPlans=true (default)
        var clientUser = EntityBuilder.User.WithEmail("withplans@test.com")
            .WithFirstName("With").WithLastName("Plans").Build();
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(11).WithUserId(_trainerId).Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(11).WithUser(clientUser).Build();
        var link = EntityBuilder.ClientProfessionalLink
            .WithId(201)
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(trainerProfile)
            .WithCanViewNutritionPlans(true)
            .WithCanViewTrainingPlans(true)
            .Build();

        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(clientProfile)
            .With(link)
            .Build();

        var ep = Factory.Create<GetClientDashboardEndpoint>(
            ctx => ctx.Request.HttpContext.User = TrainerPrincipal(_trainerId),
            db, _audit, _complianceService, PlanTestHelpers.CreateMockMongo());

        // Act
        await ep.HandleAsync(new GetClientDashboardRequest
        {
            ClientId = clientProfile.PublicId
        }, TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.CanViewNutritionPlans.Should().BeTrue();
        ep.Response.CanViewTrainingPlans.Should().BeTrue();
    }

    [Fact]
    public async Task HandleAsync_LinkWithBothFlagsFalse_Returns403()
    {
        // Arrange: link where both plan types are forbidden. Per #916 AC4, an active link
        // carrying neither capability flag must be denied outright (403), matching
        // ProfessionalAuthHelper.HasAnyPlanAccessAsync semantics from #903 — it must not
        // fall through to a 200 with both flags reported false on the wire.
        var clientUser = EntityBuilder.User.WithEmail("noaccess@test.com")
            .WithFirstName("No").WithLastName("Access").Build();
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(12).WithUserId(_trainerId).Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(12).WithUser(clientUser).Build();
        var link = EntityBuilder.ClientProfessionalLink
            .WithId(202)
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(trainerProfile)
            .WithCanViewNutritionPlans(false)
            .WithCanViewTrainingPlans(false)
            .Build();

        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(clientProfile)
            .With(link)
            .Build();

        var ep = Factory.Create<GetClientDashboardEndpoint>(
            ctx => ctx.Request.HttpContext.User = TrainerPrincipal(_trainerId),
            db, _audit, _complianceService, PlanTestHelpers.CreateMockMongo());

        // Act
        await ep.HandleAsync(new GetClientDashboardRequest
        {
            ClientId = clientProfile.PublicId
        }, TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(403);
    }

    // ── #916 compliance-substitution discrimination tests ────────────────────
    // These exist specifically to catch the case where the endpoint silently
    // returns the combined CompliancePercent to a single-flag caller instead of
    // substituting the per-domain figure. They rely on CreateStubComplianceService's
    // three distinct percent values (50/80/20) to discriminate — see comment there.

    [Fact]
    public async Task HandleAsync_NutritionOnlyLink_ReturnsNutritionCompliancePercent_AndNutritionOnlyDiscipline()
    {
        // Arrange: link with CanViewNutritionPlans=true, CanViewTrainingPlans=false
        var clientUser = EntityBuilder.User.WithEmail("nutrition-only-compliance@test.com")
            .WithFirstName("Nutrition").WithLastName("Only").Build();
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(20).WithUserId(_trainerId).Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(20).WithUser(clientUser).Build();
        var link = EntityBuilder.ClientProfessionalLink
            .WithId(300)
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(trainerProfile)
            .WithCanViewNutritionPlans(true)
            .WithCanViewTrainingPlans(false)
            .Build();

        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(clientProfile)
            .With(link)
            .Build();

        var ep = Factory.Create<GetClientDashboardEndpoint>(
            ctx => ctx.Request.HttpContext.User = TrainerPrincipal(_trainerId),
            db, _audit, _complianceService, PlanTestHelpers.CreateMockMongo());

        // Act
        await ep.HandleAsync(new GetClientDashboardRequest
        {
            ClientId = clientProfile.PublicId
        }, TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.CompliancePercent.Should().Be(80m,
            "a nutrition-only caller must see NutritionCompliancePercent substituted into the " +
            "existing CompliancePercent wire field, not the combined figure");

        await _complianceService.Received(1).CalculateStreakAsync(
            clientUser.Id, ComplianceDiscipline.NutritionOnly, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_TrainingOnlyLink_ReturnsTrainingCompliancePercent_AndTrainingOnlyDiscipline()
    {
        // Arrange: link with CanViewNutritionPlans=false, CanViewTrainingPlans=true
        var clientUser = EntityBuilder.User.WithEmail("training-only-compliance@test.com")
            .WithFirstName("Training").WithLastName("Only").Build();
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(21).WithUserId(_trainerId).Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(21).WithUser(clientUser).Build();
        var link = EntityBuilder.ClientProfessionalLink
            .WithId(301)
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(trainerProfile)
            .WithCanViewNutritionPlans(false)
            .WithCanViewTrainingPlans(true)
            .Build();

        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(clientProfile)
            .With(link)
            .Build();

        var ep = Factory.Create<GetClientDashboardEndpoint>(
            ctx => ctx.Request.HttpContext.User = TrainerPrincipal(_trainerId),
            db, _audit, _complianceService, PlanTestHelpers.CreateMockMongo());

        // Act
        await ep.HandleAsync(new GetClientDashboardRequest
        {
            ClientId = clientProfile.PublicId
        }, TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.CompliancePercent.Should().Be(20m,
            "a training-only caller must see TrainingCompliancePercent substituted into the " +
            "existing CompliancePercent wire field, not the combined figure");

        await _complianceService.Received(1).CalculateStreakAsync(
            clientUser.Id, ComplianceDiscipline.TrainingOnly, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_BothFlagsLink_ReturnsCombinedCompliancePercent_AndBothDiscipline()
    {
        // Regression guard — a fully-entitled caller keeps the pre-#916 combined behaviour.
        var clientUser = EntityBuilder.User.WithEmail("both-flags-compliance@test.com")
            .WithFirstName("Both").WithLastName("Flags").Build();
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(22).WithUserId(_trainerId).Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(22).WithUser(clientUser).Build();
        var link = EntityBuilder.ClientProfessionalLink
            .WithId(302)
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(trainerProfile)
            .WithCanViewNutritionPlans(true)
            .WithCanViewTrainingPlans(true)
            .Build();

        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(clientProfile)
            .With(link)
            .Build();

        var ep = Factory.Create<GetClientDashboardEndpoint>(
            ctx => ctx.Request.HttpContext.User = TrainerPrincipal(_trainerId),
            db, _audit, _complianceService, PlanTestHelpers.CreateMockMongo());

        // Act
        await ep.HandleAsync(new GetClientDashboardRequest
        {
            ClientId = clientProfile.PublicId
        }, TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.CompliancePercent.Should().Be(50m,
            "a fully-entitled caller must keep receiving the combined CompliancePercent — additive/unchanged");

        await _complianceService.Received(1).CalculateStreakAsync(
            clientUser.Id, ComplianceDiscipline.Both, Arg.Any<CancellationToken>());
    }
}
