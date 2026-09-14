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

        // Archive BEFORE deactivating the link, not after. The link lookup above requires
        // IsActive, so if the Mongo write failed after the link had already been committed as
        // inactive, the retry would 404 here and the plans would stay Active with nobody able to
        // reach them — exactly the half-state this archival exists to prevent, and unrepairable.
        //
        // This order is retryable instead: a failed Mongo write leaves the link active, so the
        // whole operation can simply be re-issued. It is not free of consequence though — if the
        // archival succeeds and the SaveChangesAsync below then fails, the client's plans are
        // Archived while the collaboration is still live, and every client-facing read filters on
        // Status == Active, so the client sees no plan until the request is retried. Retryable
        // beats unrepairable, which is why the order is this way round, but the failure is not
        // invisible to the client and should not be described as harmless.
        await ArchiveDepartingProfessionalsPlansAsync(link.ProfessionalProfile.UserId, userGuid, ct);

        link.IsActive = false;
        await db.SaveChangesAsync(ct);

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
    /// Archives the not-yet-terminal plans the departing professional authored for this client, in
    /// both domains. Scoped to that one professional's own plans — a client may hold plans from
    /// more than one professional, and ending one collaboration must not touch another's.
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
    /// <c>Draft</c> is included alongside <c>Active</c> for the same reason. A draft is never
    /// served to the client, so leaving it behind is not a disclosure — but it would be equally
    /// unreachable, and the document would accumulate with nobody able to delete it.
    /// </para>
    ///
    /// <para>
    /// The <c>Version</c> bump is load-bearing, not bookkeeping. The version-gated replace in
    /// <see cref="Domain.Services.PlanConcurrencyGuard"/> matches on <c>ExternalId + Version</c>,
    /// so an update that passed its authorization check just before this archival ran would
    /// otherwise still match and write the whole pre-archival document back — resurrecting the
    /// plan as Active. Bumping the version turns that racing replace into a 409 instead.
    /// </para>
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
                              & Builders<NutritionPlan>.Filter.In(
                                  p => p.Status,
                                  new[] { NutritionPlanStatus.Draft, NutritionPlanStatus.Active });

        var nutritionUpdate = Builders<NutritionPlan>.Update
            .Set(p => p.Status, NutritionPlanStatus.Archived)
            .Set(p => p.DateUpdated, now)
            .Inc(p => p.Version, 1);

        await mongo.NutritionPlans.UpdateManyAsync(nutritionFilter, nutritionUpdate, cancellationToken: ct);

        var trainingFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ClientId, clientUserId)
                             & Builders<TrainingPlan>.Filter.Eq(p => p.TrainerId, professionalUserId)
                             & Builders<TrainingPlan>.Filter.In(
                                 p => p.Status,
                                 new[] { TrainingPlanStatus.Draft, TrainingPlanStatus.Active });

        var trainingUpdate = Builders<TrainingPlan>.Update
            .Set(p => p.Status, TrainingPlanStatus.Archived)
            .Set(p => p.DateUpdated, now)
            .Inc(p => p.Version, 1);

        await mongo.TrainingPlans.UpdateManyAsync(trainingFilter, trainingUpdate, cancellationToken: ct);
    }
}
