using System.Net;
using System.Net.Http.Json;
using FormUp.Application.Domain.Entities;
using FormUp.Application.Domain.Enums;
using FormUp.Application.Features.Trainers.PendingInvites.CheckSlot;
using FormUp.Application.Infrastructure.Data;
using FormUp.Tests.Builders;
using FormUp.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace FormUp.Tests.Endpoints.Trainers;

/// <summary>
/// Coverage of GET /trainer/pending-invites/slot-check: per-profession occupancy for the caller's
/// own active professions, with no signal for unknown emails, coach accounts or other professions.
/// </summary>
[Collection(TestCollection.Name)]
public class CheckPendingInviteSlotEndpointTests(FitnessApiFactory factory)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static async Task<CheckPendingInviteSlotResponse> CheckAsync(Actor caller, string email)
    {
        var response = await caller.Http.GetAsync(
            $"/trainer/pending-invites/slot-check?email={Uri.EscapeDataString(email)}", Ct);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        return (await response.Content.ReadFromJsonAsync<CheckPendingInviteSlotResponse>(Ct))!;
    }

    private async Task<Actor> OccupyAsync(
        Actor client, UserRole role, bool nutrition, bool training, bool active = true)
    {
        var other = await TestActors.Professional(factory, role).CreateAsync(Ct);
        var link = TestActors.Link(factory, other, client)
            .AsRole(role)
            .CanViewNutritionPlans(nutrition)
            .CanViewTrainingPlans(training);

        if (!active)
        {
            link.Inactive();
        }

        await link.CreateAsync(Ct);
        return other;
    }

    [Fact]
    public async Task Check_TrainingSlotHeldByAnotherTrainer_ReportsTrainingTakenOnly()
    {
        var caller = await TestActors.Trainer(factory).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        await OccupyAsync(client, UserRole.Trainer, nutrition: false, training: true);

        var result = await CheckAsync(caller, client.Email);

        result.TrainingTaken.Should().BeTrue();
        result.NutritionTaken.Should().BeFalse();
    }

    [Fact]
    public async Task Check_NutritionSlotTakenButCallerIsTrainerOnly_ReportsNothing()
    {
        var caller = await TestActors.Trainer(factory).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        await OccupyAsync(client, UserRole.Nutritionist, nutrition: true, training: false);

        var result = await CheckAsync(caller, client.Email);

        result.NutritionTaken.Should().BeFalse("the caller does not hold the Nutritionist role");
        result.TrainingTaken.Should().BeFalse();
    }

    [Fact]
    public async Task Check_UnknownEmail_ReportsNothing()
    {
        var caller = await TestActors.Trainer(factory).CreateAsync(Ct);

        var result = await CheckAsync(caller, $"nobody-{Guid.NewGuid():N}@slot-check.test");

        result.Should().BeEquivalentTo(new CheckPendingInviteSlotResponse());
    }

    [Fact]
    public async Task Check_ClientWithFreeSlots_ReportsNothing()
    {
        var caller = await TestActors.Trainer(factory).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);

        var result = await CheckAsync(caller, client.Email);

        result.Should().BeEquivalentTo(new CheckPendingInviteSlotResponse());
    }

    [Fact]
    public async Task Check_SlotHeldByCallersOwnLink_ReportsNothing()
    {
        var caller = await TestActors.Trainer(factory).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        await TestActors.Link(factory, caller, client).CanViewNutritionPlans(false).CreateAsync(Ct);

        var result = await CheckAsync(caller, client.Email);

        result.TrainingTaken.Should().BeFalse("a coach's own link never blocks them");
    }

    [Fact]
    public async Task Check_OtherProfessionalsLinkInactive_ReportsNothing()
    {
        var caller = await TestActors.Trainer(factory).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        await OccupyAsync(client, UserRole.Trainer, nutrition: false, training: true, active: false);

        var result = await CheckAsync(caller, client.Email);

        result.TrainingTaken.Should().BeFalse();
    }

    [Fact]
    public async Task Check_InviteeIsCoachAccountWithTakenSlot_ReportsNothing()
    {
        var caller = await TestActors.Trainer(factory).CreateAsync(Ct);
        var coachWhoIsAlsoClient = await TestActors.Professional(factory, UserRole.Trainer, UserRole.Client)
            .CreateAsync(Ct);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var clientProfile = new ClientProfile { UserId = coachWhoIsAlsoClient.UserId };
            db.ClientProfiles.Add(clientProfile);
            await db.SaveChangesAsync(Ct);

            var otherTrainer = await TestActors.Trainer(factory).CreateAsync(Ct);
            await TestActors.Link(factory, otherTrainer.ProfileId, clientProfile.Id)
                .CanViewNutritionPlans(false)
                .CreateAsync(Ct);
        }

        var result = await CheckAsync(caller, coachWhoIsAlsoClient.Email);

        result.Should().BeEquivalentTo(new CheckPendingInviteSlotResponse(),
            "a coach account must never be distinguishable from an unknown email");
    }

    [Fact]
    public async Task Check_DualRoleCallerBothSlotsTaken_ReportsBoth()
    {
        var caller = await TestActors.Professional(factory, UserRole.Trainer, UserRole.Nutritionist)
            .CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        await OccupyAsync(client, UserRole.Trainer, nutrition: true, training: true);

        var result = await CheckAsync(caller, client.Email);

        result.NutritionTaken.Should().BeTrue();
        result.TrainingTaken.Should().BeTrue();
    }

    [Fact]
    public async Task Check_CallersNutritionRoleRemoved_ReportsOnlyActiveProfession()
    {
        var caller = await TestActors.Professional(factory, UserRole.Trainer, UserRole.Nutritionist)
            .WithRemovedCoachRoles(UserRole.Nutritionist)
            .CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        await OccupyAsync(client, UserRole.Trainer, nutrition: true, training: true);

        var result = await CheckAsync(caller, client.Email);

        result.TrainingTaken.Should().BeTrue();
        result.NutritionTaken.Should().BeFalse("only active roles count");
    }

    [Fact]
    public async Task Check_MalformedEmail_Returns400()
    {
        var caller = await TestActors.Trainer(factory).CreateAsync(Ct);

        var response = await caller.Http.GetAsync("/trainer/pending-invites/slot-check?email=not-an-email", Ct);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
