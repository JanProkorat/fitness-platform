using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Client.Collaborations.End;

/// <summary>
/// Deactivates a client-professional link and retires the plans that professional authored for
/// this client. This is permanent.
/// </summary>
/// <param name="db">Relational context — owns the link being deactivated.</param>
/// <param name="notifier">Realtime notifier used to tell the professional the link ended.</param>
/// <param name="notificationService">Persisted-notification service.</param>
/// <param name="mongo">MongoDB context — the departing professional's plans live here.</param>
public class EndCollaborationEndpoint(
    IApplicationDbContext db,
    IRealtimeNotifier notifier,
    INotificationService notificationService,
    IMongoContext mongo) : EndpointWithoutRequest
{
    public override void Configure()
    {
        Delete("/client/collaborations/{PublicId}");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "End a collaboration";
            s.Description = "Permanently deactivates a client-professional link.";
        });
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }

        var userGuid = Guid.Parse(userId);
        var publicId = Route<Guid>("PublicId");

        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.UserId == userGuid, ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var link = await db.ClientProfessionalLinks
            .Include(l => l.ProfessionalProfile)
                .ThenInclude(pp => pp.User)
            .FirstOrDefaultAsync(l => l.PublicId == publicId
                                   && l.ClientProfileId == clientProfile.Id
                                   && l.IsActive, ct);

        if (link is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        link.IsActive = false;
        await db.SaveChangesAsync(ct);

        await ArchiveDepartingProfessionalsPlansAsync(link.ProfessionalProfile.UserId, userGuid, ct);

        // Notify the professional
        var clientUser = await db.Users.FirstAsync(u => u.Id == userGuid, ct);
        var clientName = $"{clientUser.FirstName} {clientUser.LastName}";
        var profName = $"{link.ProfessionalProfile.User.FirstName} {link.ProfessionalProfile.User.LastName}";

        await notificationService.CreateAsync(
            link.ProfessionalProfile.UserId,
            NotificationType.General,
            new Dictionary<string, string> { ["clientName"] = clientName },
            ct: ct);

        await notifier.NotifyAsync(link.ProfessionalProfile.UserId, "collaborationended", new
        {
            LinkPublicId = link.PublicId,
            ClientName = clientName
        }, ct);

        await Send.NoContentAsync(ct);
    }

    /// <summary>
    /// Archives the Active plans the departing professional authored for this client, in both
    /// domains. Scoped to that one professional's own plans — a client may hold plans from more
    /// than one professional, and ending one collaboration must not touch another's.
    /// </summary>
    /// <remarks>
    /// Without this, deactivating the link leaves those plans Active and unreachable: the
    /// professional can no longer Complete or Delete them (the plan routes now gate on the live
    /// link), and the client-facing resolver selects among a client's Active plans by latest
    /// StartDate with no author predicate — so the departed professional's plan could outrank the
    /// replacement's on the client's Today screen. Retiring them here is what makes ending a
    /// collaboration a complete operation rather than a half-state.
    ///
    /// <para>
    /// Deliberately not reversible: re-linking the same professional does not un-archive. That
    /// matches how the publish-week supersede path already treats an archived plan.
    /// </para>
    /// </remarks>
    /// <param name="professionalUserId">The departing professional's ApplicationUser.Id.</param>
    /// <param name="clientUserId">The client's ApplicationUser.Id — the key plan documents carry.</param>
    /// <param name="ct">Cancellation token.</param>
    private async Task ArchiveDepartingProfessionalsPlansAsync(
        Guid professionalUserId, Guid clientUserId, CancellationToken ct)
    {
        var now = DateTime.UtcNow;

        var nutritionFilter = Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientUserId)
                              & Builders<NutritionPlan>.Filter.Eq(p => p.NutritionistId, professionalUserId)
                              & Builders<NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active);

        var nutritionUpdate = Builders<NutritionPlan>.Update
            .Set(p => p.Status, NutritionPlanStatus.Archived)
            .Set(p => p.DateUpdated, now);

        await mongo.NutritionPlans.UpdateManyAsync(nutritionFilter, nutritionUpdate, cancellationToken: ct);

        var trainingFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ClientId, clientUserId)
                             & Builders<TrainingPlan>.Filter.Eq(p => p.TrainerId, professionalUserId)
                             & Builders<TrainingPlan>.Filter.Eq(p => p.Status, TrainingPlanStatus.Active);

        var trainingUpdate = Builders<TrainingPlan>.Update
            .Set(p => p.Status, TrainingPlanStatus.Archived)
            .Set(p => p.DateUpdated, now);

        await mongo.TrainingPlans.UpdateManyAsync(trainingFilter, trainingUpdate, cancellationToken: ct);
    }
}
