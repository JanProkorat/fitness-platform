using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.ClientPlans.GetPlanPhotos;

/// <summary>
/// Returns a paginated list of <see cref="PlanPhoto"/> records for the given plan.
/// Only the owning client can access their own photos.
/// Optional <c>category</c> query filter narrows results to Food, Body, or FreeForm.
/// </summary>
/// <param name="db">Relational database context.</param>
public class GetPlanPhotosEndpoint(IApplicationDbContext db)
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

        await Send.OkAsync(photos, ct);
    }
}
