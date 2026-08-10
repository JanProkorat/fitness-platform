using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Bson;
using MongoDB.Driver;

namespace FitnessPlatform.Tests.Endpoints.Authorization;

/// <summary>
/// Security regression tests for the plan-addressed routes, which authorized on the plan
/// document's author field (<c>NutritionistId</c> / <c>TrainerId</c>) alone. Authorship is
/// permanent; the <see cref="ClientProfessionalLink"/> is not, so deactivating the link left a
/// former professional with full read and write access for as long as the plan stayed Active.
///
/// <para>
/// Three shapes are covered per domain: a revoked link is denied on a read AND on a write; a
/// single-capability link cannot reach the other domain's plan routes; and a currently-linked
/// professional is unaffected. The last one is what stops the fix from degenerating into
/// "deny everything".
/// </para>
///
/// <para>
/// Also covers the publish-week sibling archival, whose filter matched every overlapping Active
/// plan for the client with no author predicate — so publishing archived a different
/// professional's live plan.
/// </para>
/// </summary>
[Collection(TestCollection.Name)]
public class PlanLinkRevocationTests(FitnessApiFactory factory)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private static string UniqueEmail(string tag) => $"{Guid.NewGuid():N}@plan-link-{tag}.com";

    // ── fixture helpers (mirrors CrossDomainPlanAccessTests) ─────────────────

    private async Task<(HttpClient Http, long ProfessionalProfileId, Guid ProfessionalUserId)> RegisterProfessionalAsync(
        string tag, params string[] roles)
    {
        var client = factory.CreateClient();
        var email = UniqueEmail(tag);
        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Test", "Pro", roles);
        var (token, _) = await TestHelpers.LoginAsync(client, email, "TestPass1!");
        TestHelpers.SetBearerToken(client, token);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.FirstAsync(u => u.Email == email, TestContext.Current.CancellationToken);
        var profile = await db.ProfessionalProfiles.FirstAsync(
            p => p.UserId == user.Id, TestContext.Current.CancellationToken);

        return (client, profile.Id, user.Id);
    }

    private async Task<(Guid ClientPublicId, long ClientProfileId, Guid ClientUserId)> RegisterClientAsync(string tag)
    {
        var client = factory.CreateClient();
        var email = UniqueEmail(tag);
        await TestHelpers.RegisterAsync(client, email, "TestPass1!", "Test", "Client", "Client");
        await TestHelpers.LoginAsync(client, email, "TestPass1!");

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.FirstAsync(u => u.Email == email, TestContext.Current.CancellationToken);
        var profile = await db.ClientProfiles.FirstAsync(
            cp => cp.UserId == user.Id, TestContext.Current.CancellationToken);

        return (profile.PublicId, profile.Id, user.Id);
    }

    private async Task<Guid> LinkAsync(
        long professionalProfileId,
        long clientProfileId,
        bool canViewNutritionPlans = true,
        bool canViewTrainingPlans = true,
        bool isActive = true)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var link = new ClientProfessionalLink
        {
            PublicId = Guid.NewGuid(),
            ProfessionalProfileId = professionalProfileId,
            ClientProfileId = clientProfileId,
            ProfessionalRole = UserRole.Trainer,
            IsActive = isActive,
            CanViewNutritionPlans = canViewNutritionPlans,
            CanViewTrainingPlans = canViewTrainingPlans,
            DateCreated = DateTime.UtcNow
        };
        db.ClientProfessionalLinks.Add(link);

        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        return link.PublicId;
    }

    /// <summary>
    /// Flips an existing link to inactive — the exact state <c>EndCollaborationEndpoint</c>
    /// leaves behind. It touches nothing else: the plan keeps Status=Active and its original
    /// author id, which is what made authorship-only authorization exploitable.
    /// </summary>
    private async Task DeactivateLinkAsync(Guid linkPublicId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var link = await db.ClientProfessionalLinks.FirstAsync(
            l => l.PublicId == linkPublicId, TestContext.Current.CancellationToken);
        link.IsActive = false;

        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task<Guid> SeedNutritionPlanAsync(
        Guid clientUserId,
        Guid nutritionistUserId,
        NutritionPlanStatus status = NutritionPlanStatus.Active,
        DateTime? startDate = null,
        int weekCount = 4,
        WeekStatus weekStatus = WeekStatus.Draft)
    {
        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();

        var externalId = Guid.NewGuid();

        await mongo.NutritionPlans.InsertOneAsync(new NutritionPlan
        {
            Id = ObjectId.GenerateNewId(),
            ExternalId = externalId,
            ClientId = clientUserId,
            NutritionistId = nutritionistUserId,
            Name = "Plan-link nutrition plan",
            Status = status,
            StartDate = startDate,
            Weeks = Enumerable.Range(1, weekCount)
                .Select(w => new PlanWeek { WeekNumber = w, Status = weekStatus, Days = [] })
                .ToList(),
            Version = 1,
            DateCreated = DateTime.UtcNow,
        }, cancellationToken: TestContext.Current.CancellationToken);

        return externalId;
    }

    private async Task<Guid> SeedTrainingPlanAsync(
        Guid clientUserId,
        Guid trainerUserId,
        TrainingPlanStatus status = TrainingPlanStatus.Active)
    {
        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();

        var externalId = Guid.NewGuid();

        await mongo.TrainingPlans.InsertOneAsync(new TrainingPlan
        {
            Id = ObjectId.GenerateNewId(),
            ExternalId = externalId,
            ClientId = clientUserId,
            TrainerId = trainerUserId,
            Name = "Plan-link training plan",
            Status = status,
            StartDate = DateTime.UtcNow.Date,
            Weeks = [],
            Version = 1,
            DateCreated = DateTime.UtcNow,
        }, cancellationToken: TestContext.Current.CancellationToken);

        return externalId;
    }

    private async Task<NutritionPlanStatus> ReadNutritionPlanStatusAsync(Guid planExternalId)
    {
        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();

        var plan = await mongo.NutritionPlans
            .Find(Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, planExternalId))
            .FirstAsync(TestContext.Current.CancellationToken);

        return plan.Status;
    }

    // ── nutrition: revoked link denied on read and on write ──────────────────

    [Fact]
    public async Task RevokedLink_GetNutritionPlan_Returns404()
    {
        var (professional, professionalProfileId, professionalUserId) = await RegisterProfessionalAsync(
            "revoked-nut-read", "Nutritionist");
        var (_, clientProfileId, clientUserId) = await RegisterClientAsync("revoked-nut-read");
        var linkPublicId = await LinkAsync(professionalProfileId, clientProfileId);

        var planId = await SeedNutritionPlanAsync(clientUserId, professionalUserId);

        var beforeRevocation = await professional.GetAsync($"/nutrition/plans/{planId}");
        beforeRevocation.StatusCode.Should().Be(
            HttpStatusCode.OK, "the professional is still linked at this point");

        await DeactivateLinkAsync(linkPublicId);

        var afterRevocation = await professional.GetAsync($"/nutrition/plans/{planId}");
        afterRevocation.StatusCode.Should().Be(
            HttpStatusCode.NotFound,
            "ending the collaboration must end read access even though plan.NutritionistId still names the caller");
    }

    [Fact]
    public async Task RevokedLink_CompleteNutritionPlan_Returns404_AndDoesNotMutate()
    {
        var (professional, professionalProfileId, professionalUserId) = await RegisterProfessionalAsync(
            "revoked-nut-write", "Nutritionist");
        var (_, clientProfileId, clientUserId) = await RegisterClientAsync("revoked-nut-write");
        var linkPublicId = await LinkAsync(professionalProfileId, clientProfileId);

        var planId = await SeedNutritionPlanAsync(clientUserId, professionalUserId);
        await DeactivateLinkAsync(linkPublicId);

        var response = await professional.PostAsJsonAsync(
            $"/nutrition/plans/{planId}/complete", new { Version = 1 });

        response.StatusCode.Should().Be(
            HttpStatusCode.NotFound, "ending the collaboration must end write access too");

        var status = await ReadNutritionPlanStatusAsync(planId);
        status.Should().Be(
            NutritionPlanStatus.Active, "the denied write must not have reached the document");
    }

    [Fact]
    public async Task RevokedLink_DeleteNutritionPlan_Returns404_AndDoesNotArchive()
    {
        var (professional, professionalProfileId, professionalUserId) = await RegisterProfessionalAsync(
            "revoked-nut-delete", "Nutritionist");
        var (_, clientProfileId, clientUserId) = await RegisterClientAsync("revoked-nut-delete");
        var linkPublicId = await LinkAsync(professionalProfileId, clientProfileId);

        var planId = await SeedNutritionPlanAsync(clientUserId, professionalUserId);
        await DeactivateLinkAsync(linkPublicId);

        var response = await professional.DeleteAsync($"/nutrition/plans/{planId}");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);

        var status = await ReadNutritionPlanStatusAsync(planId);
        status.Should().Be(NutritionPlanStatus.Active, "the denied delete must not have archived the plan");
    }

    [Fact]
    public async Task RevokedLink_ListNutritionPlans_OmitsThePlan()
    {
        var (professional, professionalProfileId, professionalUserId) = await RegisterProfessionalAsync(
            "revoked-nut-list", "Nutritionist");
        var (_, clientProfileId, clientUserId) = await RegisterClientAsync("revoked-nut-list");
        var linkPublicId = await LinkAsync(professionalProfileId, clientProfileId);

        var planId = await SeedNutritionPlanAsync(clientUserId, professionalUserId);

        var before = await professional.GetAsync("/nutrition/plans?page=1&pageSize=100");
        var beforeBody = await before.Content.ReadFromJsonAsync<PlanListResponse>(
            JsonOptions, TestContext.Current.CancellationToken);
        beforeBody!.Plans.Should().Contain(p => p.PlanId == planId);

        await DeactivateLinkAsync(linkPublicId);

        var after = await professional.GetAsync("/nutrition/plans?page=1&pageSize=100");
        var afterBody = await after.Content.ReadFromJsonAsync<PlanListResponse>(
            JsonOptions, TestContext.Current.CancellationToken);

        afterBody!.Plans.Should().NotContain(
            p => p.PlanId == planId,
            "the list route re-served the ex-client's plan id on demand, which is how an attacker rediscovers it");
    }

    // ── training: revoked link denied on read and on write ───────────────────

    [Fact]
    public async Task RevokedLink_GetTrainingPlan_Returns404()
    {
        var (professional, professionalProfileId, professionalUserId) = await RegisterProfessionalAsync(
            "revoked-trn-read", "Trainer");
        var (_, clientProfileId, clientUserId) = await RegisterClientAsync("revoked-trn-read");
        var linkPublicId = await LinkAsync(professionalProfileId, clientProfileId);

        var planId = await SeedTrainingPlanAsync(clientUserId, professionalUserId);

        var beforeRevocation = await professional.GetAsync($"/training/plans/{planId}");
        beforeRevocation.StatusCode.Should().Be(HttpStatusCode.OK, "the trainer is still linked at this point");

        await DeactivateLinkAsync(linkPublicId);

        var afterRevocation = await professional.GetAsync($"/training/plans/{planId}");
        afterRevocation.StatusCode.Should().Be(
            HttpStatusCode.NotFound,
            "ending the collaboration must end read access even though plan.TrainerId still names the caller");
    }

    [Fact]
    public async Task RevokedLink_CompleteTrainingPlan_Returns404()
    {
        var (professional, professionalProfileId, professionalUserId) = await RegisterProfessionalAsync(
            "revoked-trn-write", "Trainer");
        var (_, clientProfileId, clientUserId) = await RegisterClientAsync("revoked-trn-write");
        var linkPublicId = await LinkAsync(professionalProfileId, clientProfileId);

        var planId = await SeedTrainingPlanAsync(clientUserId, professionalUserId);
        await DeactivateLinkAsync(linkPublicId);

        var response = await professional.PostAsJsonAsync(
            $"/training/plans/{planId}/complete", new { Version = 1 });

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task RevokedLink_UnlockTrainingSession_Returns404()
    {
        var (professional, professionalProfileId, professionalUserId) = await RegisterProfessionalAsync(
            "revoked-trn-unlock", "Trainer");
        var (_, clientProfileId, clientUserId) = await RegisterClientAsync("revoked-trn-unlock");
        var linkPublicId = await LinkAsync(professionalProfileId, clientProfileId);

        var planId = await SeedTrainingPlanAsync(clientUserId, professionalUserId);
        await DeactivateLinkAsync(linkPublicId);

        var response = await professional.PostAsJsonAsync(
            $"/training/plans/{planId}/sessions/{Guid.NewGuid()}/unlock", new { });

        response.StatusCode.Should().Be(
            HttpStatusCode.NotFound,
            "the plan-level guard must deny before the session-existence guard is even consulted");
    }

    [Fact]
    public async Task RevokedLink_ListTrainingPlans_OmitsThePlan()
    {
        var (professional, professionalProfileId, professionalUserId) = await RegisterProfessionalAsync(
            "revoked-trn-list", "Trainer");
        var (_, clientProfileId, clientUserId) = await RegisterClientAsync("revoked-trn-list");
        var linkPublicId = await LinkAsync(professionalProfileId, clientProfileId);

        var planId = await SeedTrainingPlanAsync(clientUserId, professionalUserId);

        var before = await professional.GetAsync("/training/plans?page=1&pageSize=100");
        var beforeBody = await before.Content.ReadFromJsonAsync<PlanListResponse>(
            JsonOptions, TestContext.Current.CancellationToken);
        beforeBody!.Plans.Should().Contain(p => p.PlanId == planId);

        await DeactivateLinkAsync(linkPublicId);

        var after = await professional.GetAsync("/training/plans?page=1&pageSize=100");
        var afterBody = await after.Content.ReadFromJsonAsync<PlanListResponse>(
            JsonOptions, TestContext.Current.CancellationToken);

        afterBody!.Plans.Should().NotContain(p => p.PlanId == planId);
    }

    // ── per-domain: one capability flag never reaches the other domain ───────

    [Fact]
    public async Task NutritionOnlyLink_CannotReachTrainingPlanRoute()
    {
        var (professional, professionalProfileId, professionalUserId) = await RegisterProfessionalAsync(
            "nut-only-cross", "Trainer", "Nutritionist");
        var (_, clientProfileId, clientUserId) = await RegisterClientAsync("nut-only-cross");
        await LinkAsync(professionalProfileId, clientProfileId,
            canViewNutritionPlans: true, canViewTrainingPlans: false);

        var nutritionPlanId = await SeedNutritionPlanAsync(clientUserId, professionalUserId);
        var trainingPlanId = await SeedTrainingPlanAsync(clientUserId, professionalUserId);

        var nutritionResponse = await professional.GetAsync($"/nutrition/plans/{nutritionPlanId}");
        nutritionResponse.StatusCode.Should().Be(
            HttpStatusCode.OK, "the link grants the nutrition capability");

        var trainingResponse = await professional.GetAsync($"/training/plans/{trainingPlanId}");
        trainingResponse.StatusCode.Should().Be(
            HttpStatusCode.NotFound,
            "authoring a training plan does not survive a link that never granted training access");
    }

    [Fact]
    public async Task TrainingOnlyLink_CannotReachNutritionPlanRoute()
    {
        var (professional, professionalProfileId, professionalUserId) = await RegisterProfessionalAsync(
            "trn-only-cross", "Trainer", "Nutritionist");
        var (_, clientProfileId, clientUserId) = await RegisterClientAsync("trn-only-cross");
        await LinkAsync(professionalProfileId, clientProfileId,
            canViewNutritionPlans: false, canViewTrainingPlans: true);

        var nutritionPlanId = await SeedNutritionPlanAsync(clientUserId, professionalUserId);
        var trainingPlanId = await SeedTrainingPlanAsync(clientUserId, professionalUserId);

        var trainingResponse = await professional.GetAsync($"/training/plans/{trainingPlanId}");
        trainingResponse.StatusCode.Should().Be(
            HttpStatusCode.OK, "the link grants the training capability");

        var nutritionResponse = await professional.GetAsync($"/nutrition/plans/{nutritionPlanId}");
        nutritionResponse.StatusCode.Should().Be(
            HttpStatusCode.NotFound,
            "authoring a nutrition plan does not survive a link that never granted nutrition access");
    }

    // ── positive control: a live link is unaffected ──────────────────────────

    [Fact]
    public async Task ActiveLink_CompleteNutritionPlan_Succeeds()
    {
        var (professional, professionalProfileId, professionalUserId) = await RegisterProfessionalAsync(
            "active-nut-write", "Nutritionist");
        var (_, clientProfileId, clientUserId) = await RegisterClientAsync("active-nut-write");
        await LinkAsync(professionalProfileId, clientProfileId);

        var planId = await SeedNutritionPlanAsync(clientUserId, professionalUserId);

        var response = await professional.PostAsJsonAsync(
            $"/nutrition/plans/{planId}/complete", new { Version = 1 });

        response.StatusCode.Should().Be(
            HttpStatusCode.OK, "a currently-linked nutritionist must still be able to complete their plan");

        var status = await ReadNutritionPlanStatusAsync(planId);
        status.Should().Be(NutritionPlanStatus.Completed);
    }

    [Fact]
    public async Task ActiveLink_GetTrainingPlan_Succeeds()
    {
        var (professional, professionalProfileId, professionalUserId) = await RegisterProfessionalAsync(
            "active-trn-read", "Trainer");
        var (_, clientProfileId, clientUserId) = await RegisterClientAsync("active-trn-read");
        await LinkAsync(professionalProfileId, clientProfileId);

        var planId = await SeedTrainingPlanAsync(clientUserId, professionalUserId);

        var response = await professional.GetAsync($"/training/plans/{planId}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // ── publish-week sibling archival must be owner-scoped ───────────────────

    [Fact]
    public async Task PublishWeek_DoesNotArchiveAnotherProfessionalsOverlappingPlan()
    {
        var (publisher, publisherProfileId, publisherUserId) = await RegisterProfessionalAsync(
            "archive-publisher", "Nutritionist");
        var (_, incumbentProfileId, incumbentUserId) = await RegisterProfessionalAsync(
            "archive-incumbent", "Nutritionist");
        var (_, clientProfileId, clientUserId) = await RegisterClientAsync("archive");

        await LinkAsync(publisherProfileId, clientProfileId);
        await LinkAsync(incumbentProfileId, clientProfileId);

        var today = DateTime.SpecifyKind(DateTime.UtcNow.Date, DateTimeKind.Utc);

        // The incumbent's live plan: same client, same date window, different author.
        var incumbentPlanId = await SeedNutritionPlanAsync(
            clientUserId, incumbentUserId,
            NutritionPlanStatus.Active, today, weekCount: 4, weekStatus: WeekStatus.Published);

        // The publisher's own overlapping plan, plus a second one to prove the archival still
        // fires for plans the publisher DOES own.
        var publisherOwnSupersededId = await SeedNutritionPlanAsync(
            clientUserId, publisherUserId,
            NutritionPlanStatus.Active, today, weekCount: 4, weekStatus: WeekStatus.Published);
        var publisherPlanId = await SeedNutritionPlanAsync(
            clientUserId, publisherUserId,
            NutritionPlanStatus.Draft, today, weekCount: 4);

        var response = await publisher.PostAsJsonAsync(
            $"/nutrition/plans/{publisherPlanId}/weeks/1/publish", new { Version = 1 });

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var incumbentStatus = await ReadNutritionPlanStatusAsync(incumbentPlanId);
        incumbentStatus.Should().Be(
            NutritionPlanStatus.Active,
            "the sibling archival had no author predicate, so publishing destroyed the other professional's live plan");

        var ownSupersededStatus = await ReadNutritionPlanStatusAsync(publisherOwnSupersededId);
        ownSupersededStatus.Should().Be(
            NutritionPlanStatus.Archived,
            "the publisher's own overlapping Active plan must still be superseded");
    }

    // ── local response DTOs ──────────────────────────────────────────────────

    private record PlanListResponse(List<PlanListItem> Plans, long TotalCount);

    private record PlanListItem(Guid PlanId, string Name, string Status);
}
