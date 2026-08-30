using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.ClientPhotos.Common;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.ClientPhotos.GetTrainerClientPhotos;

/// <summary>
/// Returns a paginated, optionally month-grouped list of plan photos across ALL plans
/// for a specific client managed by the authenticated trainer or nutritionist.
/// </summary>
/// <remarks>
/// <para>
/// Authorization: the calling professional must have an active
/// <c>ClientProfessionalLink</c> to the client identified by <c>{ClientId}</c>.
/// A missing or inactive link results in a 404 (no information leakage about the
/// existence of the client record).
/// </para>
/// <para>
/// Pagination: controlled by <c>page</c> / <c>pageSize</c> query params.
/// The <c>X-Total-Count</c> header carries the total count of matching photos
/// (or month groups when <c>groupByMonth=true</c>).
/// </para>
/// </remarks>
/// <param name="db">Relational database context (PostgreSQL via EF Core).</param>
/// <param name="linkAuthorizationService">Resolves the caller's link capabilities to the
/// client identified by <c>{ClientId}</c>.</param>
/// <param name="blobStorage">Blob storage service — converts each stored BlobUrl into a
/// short-lived pre-signed read URL before the response leaves the process (F9).</param>
public class GetTrainerClientPhotosEndpoint(
    IApplicationDbContext db,
    IClientLinkAuthorizationService linkAuthorizationService,
    IBlobStorageService blobStorage)
    : Endpoint<GetTrainerClientPhotosRequest, GetTrainerClientPhotosResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/trainer/clients/{ClientId}/photos");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "List a client's photos (trainer view)";
            s.Description = "Returns a paginated list of plan photos across all plans for a specific client. " +
                            "Requires an active trainer-client relationship. " +
                            "Supports optional plan filter (PlanId), category filter, date range filter, and optional month grouping. " +
                            "Total count (photos or groups) is in the X-Total-Count response header.";
            s.Responses[404] = "Client not found or no active relationship with the caller";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetTrainerClientPhotosRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerUserId = Guid.Parse(userId);

        // Verify active trainer-client link, and read its capability flags rather than only its
        // existence — the caller supplies the category filter, so an existence check alone let a
        // training-only professional select precisely the nutrition-domain rows their link denies.
        var capabilities = await linkAuthorizationService.GetCapabilitiesByClientPublicIdAsync(
            trainerUserId, req.ClientId, ct);

        if (capabilities is null || capabilities.Value.GrantsNothing)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Resolve the client profile — needed to scope the PlanPhotos query by ClientProfileId.
        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.PublicId == req.ClientId, ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Build base query scoped to this client
        var query = db.PlanPhotos
            .AsNoTracking()
            .Where(p => p.ClientProfileId == clientProfile.Id);

        // Domain scoping, keyed on Category alone — deliberately NOT on PlanType.
        //
        // Category is the authoritative signal for what a photo hangs off: Food is a meal-log
        // attachment in a nutrition plan, Training is a session attachment. Body and free-form
        // photos are standalone and stay dual-readable in both directions, matching how the
        // timeline endpoint already classifies body measurements.
        //
        // PlanType cannot be used for this. SaveDayPhotosEndpoint writes EVERY day photo — Body and
        // FreeForm included — with PlanType = Nutrition and the plan's id, because day photos are
        // uploaded through a nutrition-plan screen. Keying on PlanType therefore hid a client's
        // body-progress photos from a training-only coach: fail-closed, but a real loss of
        // dual-readable content rather than a leak being closed.
        //
        // Applied to the BASE query, before the caller's own category and plan filters, so no
        // request field can widen it.
        if (!capabilities.Value.CanViewNutritionPlans)
        {
            query = query.Where(p => p.Category != PlanPhotoCategory.Food);
        }

        if (!capabilities.Value.CanViewTrainingPlans)
        {
            query = query.Where(p => p.Category != PlanPhotoCategory.Training);
        }

        // Optional plan filter
        if (req.PlanId.HasValue)
        {
            query = query.Where(p => p.PlanId == req.PlanId.Value);
        }

        // Optional category filter
        if (req.Category.HasValue)
        {
            query = query.Where(p => p.Category == req.Category.Value);
        }

        // Optional date range filter on TakenAt (inclusive)
        if (req.From.HasValue)
        {
            query = query.Where(p => p.TakenAt >= req.From.Value);
        }

        if (req.To.HasValue)
        {
            query = query.Where(p => p.TakenAt <= req.To.Value);
        }

        if (req.GroupByMonth)
        {
            // Fetch all matching photos ordered by TakenAt DESC for grouping.
            // GroupBy + pagination cannot be efficiently translated to SQL for
            // this shape, so we load a minimal projection and group in .NET.
            var allPhotos = await query
                .OrderByDescending(p => p.TakenAt)
                .Select(p => new ClientPhotoResponse
                {
                    Id = p.PublicId,
                    BlobUrl = p.BlobUrl,
                    Description = p.Description,
                    Category = p.Category,
                    PlanId = p.PlanId,
                    PlanType = p.PlanType,
                    MealLogId = p.MealLogId,
                    TakenAt = p.TakenAt,
                    UploadedByUserId = p.UploadedByUserId,
                    UploadedAt = p.DateCreated,
                    DiaryRequestId = p.DiaryRequestId,
                })
                .ToListAsync(ct);

            // Group by YYYY-MM, preserving descending order within each group
            var groups = allPhotos
                .GroupBy(p => p.TakenAt.ToString("yyyy-MM"))
                .OrderByDescending(g => g.Key)
                .Select(g => new MonthGroupResponse
                {
                    YearMonth = g.Key,
                    Photos = g.ToList()
                })
                .ToList();

            var totalGroups = groups.Count;

            var pagedGroups = groups
                .Skip((req.Page - 1) * req.PageSize)
                .Take(req.PageSize)
                .ToList();

            // Sign only the photos actually being returned (post-pagination), not the full
            // in-memory grouping set — a stored BlobUrl is no longer publicly fetchable (F9).
            await SignPhotoUrlsAsync(pagedGroups.SelectMany(g => g.Photos), ct);

            HttpContext.Response.Headers["X-Total-Count"] = totalGroups.ToString();

            await Send.OkAsync(new GetTrainerClientPhotosResponse
            {
                Groups = pagedGroups
            }, ct);
        }
        else
        {
            var totalCount = await query.CountAsync(ct);

            var photos = await query
                .OrderByDescending(p => p.TakenAt)
                .Skip((req.Page - 1) * req.PageSize)
                .Take(req.PageSize)
                .Select(p => new ClientPhotoResponse
                {
                    Id = p.PublicId,
                    BlobUrl = p.BlobUrl,
                    Description = p.Description,
                    Category = p.Category,
                    PlanId = p.PlanId,
                    PlanType = p.PlanType,
                    MealLogId = p.MealLogId,
                    TakenAt = p.TakenAt,
                    UploadedByUserId = p.UploadedByUserId,
                    UploadedAt = p.DateCreated,
                    DiaryRequestId = p.DiaryRequestId,
                })
                .ToListAsync(ct);

            // A stored BlobUrl is no longer publicly fetchable — mint a short-lived read URL
            // for each photo before it leaves the process (F9).
            await SignPhotoUrlsAsync(photos, ct);

            HttpContext.Response.Headers["X-Total-Count"] = totalCount.ToString();

            await Send.OkAsync(new GetTrainerClientPhotosResponse
            {
                Photos = photos
            }, ct);
        }
    }

    /// <summary>
    /// Populates each photo's <see cref="ClientPhotoResponse.DisplayUrl"/> with a short-lived
    /// pre-signed read URL. Must run on every response path before <c>Send.OkAsync</c> — the
    /// bucket no longer grants public read on the <c>plan-photos/</c> prefix these photos live
    /// under. <see cref="ClientPhotoResponse.BlobUrl"/> is left untouched — it stays the
    /// canonical, permanent identity value.
    /// </summary>
    private async Task SignPhotoUrlsAsync(IEnumerable<ClientPhotoResponse> photos, CancellationToken ct)
    {
        foreach (var photo in photos)
        {
            photo.DisplayUrl = await blobStorage.GenerateReadUrlAsync(photo.BlobUrl, ct) ?? string.Empty;
        }
    }
}
