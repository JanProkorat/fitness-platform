using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.ClientNutrition.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientNutrition.GenerateMealPhotoUploadUrl;

/// <summary>
/// Generates a pre-signed URL for the caller to upload a meal diary photo directly to blob storage.
/// The photo lands under <c>diary/{mealId}/{guid}.{ext}</c> — the <see cref="ImageUploadScope.Diary"/>
/// namespace — instead of the generic avatar namespace.
/// </summary>
/// <param name="imageUpload">Image upload service — validates content type and size, then issues the signed URL.</param>
/// <param name="mongo">MongoDB context for ownership verification.</param>
/// <param name="db">Relational database context for client profile lookup.</param>
/// <param name="timeProvider">Clock abstraction (#955) — lets tests pin the "now" instant deterministically.</param>
public class GenerateMealPhotoUploadUrlEndpoint(
    IImageUploadService imageUpload,
    IMongoContext mongo,
    IApplicationDbContext db,
    TimeProvider timeProvider)
    : Endpoint<GenerateMealPhotoUploadUrlRequest, GenerateMealPhotoUploadUrlResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/nutrition/log/meals/{MealId}/photo-upload-url");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Generate meal diary photo upload URL";
            s.Description =
                "Returns a time-limited pre-signed URL for direct upload of a meal diary photo "
                + "to blob storage (diary/{mealId}/{guid}.{ext}), together with the permanent "
                + "blob URL to pass to POST /client/nutrition/log/meals/{mealId}/photos. "
                + "An optional date targets a past day (or today) of the active plan; omitted means the client-local today.";
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid request, or the date is in the future (MEAL_LOG_DATE_IN_FUTURE)";
            s.Responses[StatusCodes.Status404NotFound] = "No active plan covers the date, or the meal is not on that day";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GenerateMealPhotoUploadUrlRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        // Resolve the caller's client profile
        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.UserId == Guid.Parse(userId), ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Canonical client id on Mongo docs is ApplicationUser.Id (#840).
        var clientId = clientProfile.UserId;

        // Resolve the client's Active nutrition plan whose date window contains today — a client
        // may hold several sequential, non-overlapping Active plans (#780).
        var planFilter = Builders<NutritionPlan>.Filter.And(
            Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientId),
            Builders<NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active));

        var planCursor = await mongo.NutritionPlans.FindAsync(planFilter, cancellationToken: ct);
        var activePlans = await planCursor.ToListAsync(ct);
        var timeZone = await db.ResolveClientTimeZoneAsync(clientId, ct);
        var localToday = ClientLocalDateResolver.ResolveLocalDate(timeProvider.GetUtcNow().UtcDateTime, timeZone);

        if (req.Date > localToday)
        {
            await this.SendProblemAsync(400, ErrorCodes.MealLogDateInFuture,
                "Meal photos cannot be added to a future day.", ct);
            return;
        }

        // Without a date the legacy best-effort plan resolution applies; with one the plan
        // window must contain the date.
        var targetDate = req.Date ?? localToday;
        var targetDayUtc = targetDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var plan = req.Date is null
            ? PlanWindowResolver.ResolveCurrentPlan(activePlans, p => p.StartDate, p => p.Weeks.Count, targetDayUtc)
            : PlanWindowResolver.ResolveCurrentPlanStrict(activePlans, p => p.StartDate, p => p.Weeks.Count, targetDate);

        if (plan is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Verify the mealId belongs to the plan — to that date's plan day when a date was given.
        var meal = req.Date is null
            ? plan.Weeks
                .SelectMany(w => w.Days)
                .SelectMany(d => d.Meals)
                .FirstOrDefault(m => m.MealId == req.MealId)
            : NutritionPlanDayResolver.FindMeal(plan, targetDayUtc, req.MealId);

        if (meal is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Build the sub-path: {mealId}/{guid}.{ext} — prefix "diary/" is added by the service
        var extension = GetExtension(req.ContentType);
        var subPath = $"{req.MealId}/{Guid.NewGuid()}.{extension}";

        var result = await imageUpload.GenerateUploadUrlAsync(
            ImageUploadScope.Diary,
            subPath,
            req.ContentType,
            req.SizeBytes,
            ct);

        await Send.OkAsync(new GenerateMealPhotoUploadUrlResponse
        {
            UploadUrl = result.UploadUrl,
            BlobUrl = result.BlobUrl
        }, ct);
    }

    // Returns a file extension for known image content types.
    // The IImageUploadService whitelist now includes heic/heif as well, so all
    // five branches map to a real subPath. The "_ => bin" fallback only fires
    // for content types both the validator and the service reject — defensive.
    private static string GetExtension(string contentType) => contentType.ToLowerInvariant() switch
    {
        "image/jpeg" => "jpg",
        "image/png"  => "png",
        "image/webp" => "webp",
        "image/heic" => "heic",
        "image/heif" => "heif",
        _            => "bin",
    };
}
