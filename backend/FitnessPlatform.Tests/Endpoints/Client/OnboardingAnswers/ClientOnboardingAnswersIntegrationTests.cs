using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Client.OnboardingAnswers.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.Client.OnboardingAnswers;

/// <summary>
/// Integration tests for <c>GET</c> and <c>PATCH /client/onboarding/answers</c>.
/// </summary>
[Collection(TestCollection.Name)]
public class ClientOnboardingAnswersIntegrationTests(FitnessApiFactory factory)
{
    private const string Route = "/client/onboarding/answers";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private async Task SeedOnboardingAsync(Actor client)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var onboarding = EntityBuilder.ClientOnboardingData
            .WithGeneratedId()
            .WithClientProfileId(client.ProfileId)
            .WithDislikes("mushrooms")
            .Build();
        onboarding.Allergies = "lactose,nuts";
        onboarding.TargetWeightKg = 75m;
        db.ClientOnboardingData.Add(onboarding);
        await db.SaveChangesAsync(Ct);

        var targets = EntityBuilder.ClientNutritionTargets
            .WithGeneratedId()
            .WithClientOnboardingDataId(onboarding.Id)
            .Build();
        db.ClientNutritionTargets.Add(targets);
        await db.SaveChangesAsync(Ct);
    }

    private async Task<List<Notification>> NotificationsForAsync(Guid recipientUserId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        return await db.Notifications.AsNoTracking()
            .Where(n => n.RecipientUserId == recipientUserId && n.Type == NotificationType.OnboardingAnswersUpdated)
            .ToListAsync(Ct);
    }

    [Fact]
    public async Task Get_ReturnsStoredAnswers()
    {
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        await SeedOnboardingAsync(client);

        var response = await client.Http.GetAsync(Route, Ct);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<ClientOnboardingAnswersResponse>(cancellationToken: Ct);
        body!.PrimaryGoal.Should().Be("GainMuscle");
        body.TargetWeightKg.Should().Be(75m);
        body.DesiredTrainingFrequency.Should().Be("FourPerWeek");
        body.GymAccess.Should().Be("Yes");
        body.Injuries.Should().Equal("none");
        body.DietaryStyle.Should().Be("Standard");
        body.Allergies.Should().Equal("lactose", "nuts");
        body.Dislikes.Should().Equal("mushrooms");
    }

    [Fact]
    public async Task Patch_NoOnboardingData_Returns409WithCode_AndInvalidBodyReturns400()
    {
        var client = await TestActors.Client(factory).CreateAsync(Ct);

        var conflict = await client.Http.PatchAsJsonAsync(Route, new { gymAccess = "No" }, Ct);
        var invalid = await client.Http.PatchAsJsonAsync(Route, new { primaryGoal = "99" }, Ct);

        conflict.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await conflict.Content.ReadAsStringAsync(Ct)).Should().Contain("ONBOARDING_NOT_COMPLETED");
        invalid.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Patch_ChangesOnlySentFields_AndLeavesDateOfBirthAndTargetsUntouched()
    {
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        await SeedOnboardingAsync(client);

        var response = await client.Http.PatchAsJsonAsync(
            Route, new { primaryGoal = "LoseFat", dislikes = new[] { "olives" } }, Ct);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var data = await db.ClientOnboardingData.AsNoTracking()
            .Include(od => od.NutritionTargets)
            .SingleAsync(od => od.ClientProfileId == client.ProfileId, Ct);

        data.PrimaryGoal.Should().Be(PrimaryGoal.LoseFat);
        data.Dislikes.Should().Equal("olives");
        data.Allergies.Should().Be("lactose,nuts");
        data.TargetWeightKg.Should().Be(75m);
        data.GymAccess.Should().Be(GymAccess.Yes);
        data.DateOfBirth.Should().Be(DateTime.SpecifyKind(new DateTime(2000, 1, 1), DateTimeKind.Utc));
        data.NutritionTargets!.DerivedNutritionGoal.Should().Be(NutritionGoal.Bulk);
        data.NutritionTargets.AdjustedKcal.Should().Be(2750);

        var audit = await db.AuditLogs.AsNoTracking()
            .SingleAsync(a => a.UserId == client.UserId && a.Action == "UpdateClientOnboardingAnswers", Ct);
        audit.NewValues.Should().Contain("primaryGoal").And.Contain("dislikes").And.NotContain("olives");
    }

    [Fact]
    public async Task Patch_Change_NotifiesEachLinkedCoachOnceInOwnLanguage_AndNoChangeNotifiesNobody()
    {
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        await SeedOnboardingAsync(client);
        var dualRoleCoach = await TestActors.Trainer(factory).CreateAsync(Ct);
        var nutritionist = await TestActors.Nutritionist(factory).CreateAsync(Ct);
        var unlinkedCoach = await TestActors.Trainer(factory).CreateAsync(Ct);
        await TestActors.Link(factory, dualRoleCoach, client).CreateAsync(Ct);
        await TestActors.Link(factory, nutritionist, client).AsRole(UserRole.Nutritionist).CreateAsync(Ct);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await db.Users.Where(u => u.Id == dualRoleCoach.UserId)
                .ExecuteUpdateAsync(set => set.SetProperty(u => u.Language, "cs"), Ct);
        }

        var changed = await client.Http.PatchAsJsonAsync(Route, new { gymAccess = "No", targetWeightKg = 70 }, Ct);
        var unchanged = await client.Http.PatchAsJsonAsync(Route, new { gymAccess = "No", targetWeightKg = 70 }, Ct);

        changed.StatusCode.Should().Be(HttpStatusCode.OK);
        unchanged.StatusCode.Should().Be(HttpStatusCode.OK);

        var received = await NotificationsForAsync(dualRoleCoach.UserId);
        received.Should().ContainSingle();
        received[0].Body.Should().Contain("přístup do posilovny").And.Contain("cílová váha");
        using var data = JsonDocument.Parse(received[0].Data!);
        data.RootElement.GetProperty("changedFields").GetString().Should().Be("targetWeightKg,gymAccess");
        data.RootElement.GetProperty("clientId").GetString().Should().Be(client.PublicId.ToString());

        var englishBody = (await NotificationsForAsync(nutritionist.UserId)).Should().ContainSingle().Subject.Body;
        englishBody.Should().Contain("gym access").And.Contain("target weight");

        (await NotificationsForAsync(unlinkedCoach.UserId)).Should().BeEmpty();
    }
}
