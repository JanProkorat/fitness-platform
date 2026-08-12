using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.ClientPlans.GetPlanPhotos;

/// <summary>
/// Returns a paginated list of <see cref="PlanPhoto"/> records for the given plan.
/// Only the owning client can access their own photos.
/// Optional <c>category</c> query filter narrows results to Food, Body, or FreeForm.
/// </summary>
/// <param name="db">Relational database context.</param>
/// <param name="blobStorage">Blob storage service — converts each stored BlobUrl into a
/// short-lived pre-signed read URL before the response leaves the process (F9).</param>
public class GetPlanPhotosEndpoint(IApplicationDbContext db, IBlobStorageService blobStorage)
    : Endpoint<GetPlanPhotosRequest, List<PlanPhotoResponse>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/client/plans/{PlanId}/photos");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "List plan photos";
            s.Description =
                "Returns a paginated list of plan photos. "
                + "Optionally filter by category (Food / Body / FreeForm). "
                + "X-Total-Count header contains the total number of matching records.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetPlanPhotosRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var callerUserId = Guid.Parse(userId);

        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.UserId == callerUserId, ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Base query: photos for this client and plan
        var query = db.PlanPhotos
            .AsNoTracking()
            .Where(p => p.ClientProfileId == clientProfile.Id && p.PlanId == req.PlanId);

        if (req.Category.HasValue)
            query = query.Where(p => p.Category == req.Category.Value);

        var totalCount = await query.CountAsync(ct);

        HttpContext.Response.Headers["X-Total-Count"] = totalCount.ToString();

        var photos = await query
            .OrderByDescending(p => p.TakenAt)
            .Skip((req.Page - 1) * req.PageSize)
            .Take(req.PageSize)
            .Select(p => new PlanPhotoResponse
            {
                Id = p.PublicId,
                BlobUrl = p.BlobUrl,
                Category = p.Category,
                Description = p.Description,
                TakenAt = p.TakenAt,
                MealLogId = p.MealLogId,
                PlanId = p.PlanId,
                PlanType = p.PlanType,
                DateCreated = p.DateCreated,
                UploadedByUserId = p.UploadedByUserId,
                DiaryRequestId = p.DiaryRequestId
            })
            .ToListAsync(ct);

        // A stored BlobUrl is no longer publicly fetchable — mint a short-lived DisplayUrl for
        // each photo before it leaves the process (F9). BlobUrl itself stays the canonical,
        // permanent identity value — never overwrite it with the signed URL.
        foreach (var photo in photos)
        {
            photo.DisplayUrl = await blobStorage.GenerateReadUrlAsync(photo.BlobUrl, ct) ?? string.Empty;
        }

        await Send.OkAsync(photos, ct);
    }
}
