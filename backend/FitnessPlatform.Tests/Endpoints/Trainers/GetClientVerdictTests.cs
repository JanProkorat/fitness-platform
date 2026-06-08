using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Trainers.GetClientVerdict;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Trainers;

public class GetClientVerdictTests
{
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly IClientVerdictService _verdictService = Substitute.For<IClientVerdictService>();

    // ── Happy path — OnTrack ─────────────────────────────────────────────────

    [Fact]
    public async Task GetVerdict_FullOnTrack_Returns200WithOnTrackVerdict()
    {
        var (db, clientProfile) = BuildLinkedClientSetup();

        _verdictService.ComputeAsync(
            clientProfile.UserId,
            clientProfile.Id,
            clientProfile.PublicId,
            Arg.Any<decimal?>(),
            Arg.Any<CancellationToken>())
            .Returns(new ClientVerdictResult
            {
                Verdict = ClientVerdict.OnTrack,
                CompliancePercent = 92m,
                WeightDeltaToGoal = -2.5m,
                WeightDirection = WeightDirection.Towards,
                TrainingFrequencyActual = 3,
                TrainingFrequencyPrescribed = 3,
                LastActiveAt = DateTime.UtcNow.AddDays(-1),
                PrCountThisMonth = 2
            });

        var ep = Factory.Create<GetClientVerdictEndpoint>(
            ctx => ctx.Request.HttpContext.User = FakeTrainerPrincipal(_trainerId),
            db, _verdictService);

        await ep.HandleAsync(new GetClientVerdictRequest { ClientId = clientProfile.PublicId },
            TestContext.Current.CancellationToken);

        ep.Response.Verdict.Should().Be(ClientVerdict.OnTrack);
        ep.Response.CompliancePercent.Should().Be(92m);
        ep.Response.WeightDirection.Should().Be(WeightDirection.Towards);
        ep.Response.TrainingFrequencyActual.Should().Be(3);
        ep.Response.TrainingFrequencyPrescribed.Should().Be(3);
        ep.Response.PrCountThisMonth.Should().Be(2);
        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }

    // ── NeedsAttention — single-signal variants ─────────────────────────────

    [Fact]
    public async Task GetVerdict_ComplianceBelow85_Returns200WithNeedsAttention()
    {
        var (db, clientProfile) = BuildLinkedClientSetup();

        _verdictService.ComputeAsync(
            Arg.Any<Guid>(), Arg.Any<long>(), Arg.Any<Guid>(),
            Arg.Any<decimal?>(), Arg.Any<CancellationToken>())
            .Returns(new ClientVerdictResult
            {
                Verdict = ClientVerdict.NeedsAttention,
                CompliancePercent = 72m,
                WeightDirection = WeightDirection.Towards,
                TrainingFrequencyActual = 3,
                TrainingFrequencyPrescribed = 3,
                LastActiveAt = DateTime.UtcNow.AddDays(-1)
            });

        var ep = Factory.Create<GetClientVerdictEndpoint>(
            ctx => ctx.Request.HttpContext.User = FakeTrainerPrincipal(_trainerId),
            db, _verdictService);

        await ep.HandleAsync(new GetClientVerdictRequest { ClientId = clientProfile.PublicId },
            TestContext.Current.CancellationToken);

        ep.Response.Verdict.Should().Be(ClientVerdict.NeedsAttention);
        ep.Response.CompliancePercent.Should().Be(72m);
    }

    [Fact]
    public async Task GetVerdict_WeightStable_Returns200WithNeedsAttention()
    {
        var (db, clientProfile) = BuildLinkedClientSetup();

        _verdictService.ComputeAsync(
            Arg.Any<Guid>(), Arg.Any<long>(), Arg.Any<Guid>(),
            Arg.Any<decimal?>(), Arg.Any<CancellationToken>())
            .Returns(new ClientVerdictResult
            {
                Verdict = ClientVerdict.NeedsAttention,
                CompliancePercent = 90m,
                WeightDeltaToGoal = 0.3m,
                WeightDirection = WeightDirection.Stable,
                TrainingFrequencyActual = 3,
                TrainingFrequencyPrescribed = 3,
                LastActiveAt = DateTime.UtcNow.AddDays(-1)
            });

        var ep = Factory.Create<GetClientVerdictEndpoint>(
            ctx => ctx.Request.HttpContext.User = FakeTrainerPrincipal(_trainerId),
            db, _verdictService);

        await ep.HandleAsync(new GetClientVerdictRequest { ClientId = clientProfile.PublicId },
            TestContext.Current.CancellationToken);

        ep.Response.Verdict.Should().Be(ClientVerdict.NeedsAttention);
        ep.Response.WeightDirection.Should().Be(WeightDirection.Stable);
    }

    [Fact]
    public async Task GetVerdict_FrequencyBelowPrescribed_Returns200WithNeedsAttention()
    {
        var (db, clientProfile) = BuildLinkedClientSetup();

        _verdictService.ComputeAsync(
            Arg.Any<Guid>(), Arg.Any<long>(), Arg.Any<Guid>(),
            Arg.Any<decimal?>(), Arg.Any<CancellationToken>())
            .Returns(new ClientVerdictResult
            {
                Verdict = ClientVerdict.NeedsAttention,
                CompliancePercent = 90m,
                WeightDirection = WeightDirection.Towards,
                TrainingFrequencyActual = 2,
                TrainingFrequencyPrescribed = 3,
                LastActiveAt = DateTime.UtcNow.AddDays(-1)
            });

        var ep = Factory.Create<GetClientVerdictEndpoint>(
            ctx => ctx.Request.HttpContext.User = FakeTrainerPrincipal(_trainerId),
            db, _verdictService);

        await ep.HandleAsync(new GetClientVerdictRequest { ClientId = clientProfile.PublicId },
            TestContext.Current.CancellationToken);

        ep.Response.Verdict.Should().Be(ClientVerdict.NeedsAttention);
        ep.Response.TrainingFrequencyActual.Should().Be(2);
        ep.Response.TrainingFrequencyPrescribed.Should().Be(3);
    }

    // ── OffTrack variants ────────────────────────────────────────────────────

    [Fact]
    public async Task GetVerdict_ComplianceBelow60_Returns200WithOffTrack()
    {
        var (db, clientProfile) = BuildLinkedClientSetup();

        _verdictService.ComputeAsync(
            Arg.Any<Guid>(), Arg.Any<long>(), Arg.Any<Guid>(),
            Arg.Any<decimal?>(), Arg.Any<CancellationToken>())
            .Returns(new ClientVerdictResult
            {
                Verdict = ClientVerdict.OffTrack,
                CompliancePercent = 45m,
                WeightDirection = WeightDirection.Towards,
                TrainingFrequencyActual = 3,
                TrainingFrequencyPrescribed = 3,
                LastActiveAt = DateTime.UtcNow.AddDays(-1)
            });

        var ep = Factory.Create<GetClientVerdictEndpoint>(
            ctx => ctx.Request.HttpContext.User = FakeTrainerPrincipal(_trainerId),
            db, _verdictService);

        await ep.HandleAsync(new GetClientVerdictRequest { ClientId = clientProfile.PublicId },
            TestContext.Current.CancellationToken);

        ep.Response.Verdict.Should().Be(ClientVerdict.OffTrack);
        ep.Response.CompliancePercent.Should().Be(45m);
    }

    [Fact]
    public async Task GetVerdict_Inactivity14Days_Returns200WithOffTrack()
    {
        var (db, clientProfile) = BuildLinkedClientSetup();

        _verdictService.ComputeAsync(
            Arg.Any<Guid>(), Arg.Any<long>(), Arg.Any<Guid>(),
            Arg.Any<decimal?>(), Arg.Any<CancellationToken>())
            .Returns(new ClientVerdictResult
            {
                Verdict = ClientVerdict.OffTrack,
                CompliancePercent = null,
                WeightDirection = WeightDirection.Stable,
                LastActiveAt = DateTime.UtcNow.AddDays(-(ClientDashboardConstants.InactivityThresholdDays + 1))
            });

        var ep = Factory.Create<GetClientVerdictEndpoint>(
            ctx => ctx.Request.HttpContext.User = FakeTrainerPrincipal(_trainerId),
            db, _verdictService);

        await ep.HandleAsync(new GetClientVerdictRequest { ClientId = clientProfile.PublicId },
            TestContext.Current.CancellationToken);

        ep.Response.Verdict.Should().Be(ClientVerdict.OffTrack);
    }

    [Fact]
    public async Task GetVerdict_WeightAwayDeltaAbove1Kg_Returns200WithOffTrack()
    {
        var (db, clientProfile) = BuildLinkedClientSetup();

        _verdictService.ComputeAsync(
            Arg.Any<Guid>(), Arg.Any<long>(), Arg.Any<Guid>(),
            Arg.Any<decimal?>(), Arg.Any<CancellationToken>())
            .Returns(new ClientVerdictResult
            {
                Verdict = ClientVerdict.OffTrack,
                CompliancePercent = 88m,
                WeightDeltaToGoal = 1.5m,
                WeightDirection = WeightDirection.Away,
                TrainingFrequencyActual = 3,
                TrainingFrequencyPrescribed = 3,
                LastActiveAt = DateTime.UtcNow.AddDays(-1)
            });

        var ep = Factory.Create<GetClientVerdictEndpoint>(
            ctx => ctx.Request.HttpContext.User = FakeTrainerPrincipal(_trainerId),
            db, _verdictService);

        await ep.HandleAsync(new GetClientVerdictRequest { ClientId = clientProfile.PublicId },
            TestContext.Current.CancellationToken);

        ep.Response.Verdict.Should().Be(ClientVerdict.OffTrack);
        ep.Response.WeightDirection.Should().Be(WeightDirection.Away);
    }

    // ── Null-exclusion paths ────────────────────────────────────────────────

    [Fact]
    public async Task GetVerdict_NoActiveNutritionPlan_CompliancePercent_IsNull()
    {
        var (db, clientProfile) = BuildLinkedClientSetup();

        _verdictService.ComputeAsync(
            Arg.Any<Guid>(), Arg.Any<long>(), Arg.Any<Guid>(),
            Arg.Any<decimal?>(), Arg.Any<CancellationToken>())
            .Returns(new ClientVerdictResult
            {
                Verdict = ClientVerdict.OnTrack,
                CompliancePercent = null,
                WeightDirection = WeightDirection.Towards,
                TrainingFrequencyActual = 3,
                TrainingFrequencyPrescribed = 3,
                LastActiveAt = DateTime.UtcNow.AddDays(-1)
            });

        var ep = Factory.Create<GetClientVerdictEndpoint>(
            ctx => ctx.Request.HttpContext.User = FakeTrainerPrincipal(_trainerId),
            db, _verdictService);

        await ep.HandleAsync(new GetClientVerdictRequest { ClientId = clientProfile.PublicId },
            TestContext.Current.CancellationToken);

        ep.Response.CompliancePercent.Should().BeNull();
        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }

    [Fact]
    public async Task GetVerdict_NoActiveTrainingPlan_FrequencySignals_AreNull()
    {
        var (db, clientProfile) = BuildLinkedClientSetup();

        _verdictService.ComputeAsync(
            Arg.Any<Guid>(), Arg.Any<long>(), Arg.Any<Guid>(),
            Arg.Any<decimal?>(), Arg.Any<CancellationToken>())
            .Returns(new ClientVerdictResult
            {
                Verdict = ClientVerdict.OnTrack,
                CompliancePercent = 90m,
                WeightDirection = WeightDirection.Towards,
                TrainingFrequencyActual = null,
                TrainingFrequencyPrescribed = null,
                LastActiveAt = DateTime.UtcNow.AddDays(-1)
            });

        var ep = Factory.Create<GetClientVerdictEndpoint>(
            ctx => ctx.Request.HttpContext.User = FakeTrainerPrincipal(_trainerId),
            db, _verdictService);

        await ep.HandleAsync(new GetClientVerdictRequest { ClientId = clientProfile.PublicId },
            TestContext.Current.CancellationToken);

        ep.Response.TrainingFrequencyActual.Should().BeNull();
        ep.Response.TrainingFrequencyPrescribed.Should().BeNull();
        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }

    // ── Auth & ownership errors ──────────────────────────────────────────────

    [Fact]
    public async Task GetVerdict_NoClaims_Returns401()
    {
        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<GetClientVerdictEndpoint>(db, _verdictService);

        await ep.HandleAsync(new GetClientVerdictRequest { ClientId = Guid.NewGuid() },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }

    [Fact]
    public async Task GetVerdict_NotLinkedToClient_Returns403()
    {
        // Trainer has a profile but NO link to the client
        var trainerId = _trainerId;
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(trainerId).Build();
        var clientUser = EntityBuilder.User.Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(1).WithUser(clientUser).Build();

        // No link added to MockDbBuilder — trainer has no active link
        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(clientProfile)
            .Build();

        var ep = Factory.Create<GetClientVerdictEndpoint>(
            ctx => ctx.Request.HttpContext.User = FakeTrainerPrincipal(trainerId),
            db, _verdictService);

        await ep.HandleAsync(new GetClientVerdictRequest { ClientId = clientProfile.PublicId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(403);
    }

    [Fact]
    public async Task GetVerdict_NonexistentClient_Returns404()
    {
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerId).Build();
        var db = new MockDbBuilder().With(trainerProfile).Build();

        var ep = Factory.Create<GetClientVerdictEndpoint>(
            ctx => ctx.Request.HttpContext.User = FakeTrainerPrincipal(_trainerId),
            db, _verdictService);

        await ep.HandleAsync(new GetClientVerdictRequest { ClientId = Guid.NewGuid() },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private (IApplicationDbContext db, FitnessPlatform.Application.Domain.Entities.ClientProfile clientProfile)
        BuildLinkedClientSetup()
    {
        var trainerProfile = EntityBuilder.ProfessionalProfile.WithId(1).WithUserId(_trainerId).Build();
        var clientUser = EntityBuilder.User.WithEmail("client@test.com")
            .WithFirstName("Test").WithLastName("Client").Build();
        var clientProfile = EntityBuilder.ClientProfile.WithId(10).WithUser(clientUser).Build();
        var link = EntityBuilder.ClientProfessionalLink
            .WithId(42)
            .WithClientProfile(clientProfile)
            .WithProfessionalProfile(trainerProfile)
            .Build();

        var db = new MockDbBuilder()
            .With(trainerProfile)
            .With(clientProfile)
            .With(link)
            .Build();

        return (db, clientProfile);
    }

    private static System.Security.Claims.ClaimsPrincipal FakeTrainerPrincipal(Guid userId) =>
        new(new System.Security.Claims.ClaimsIdentity(
            EndpointTestHelpers.FakeUserClaims(userId, AppRoles.Trainer)));
}
