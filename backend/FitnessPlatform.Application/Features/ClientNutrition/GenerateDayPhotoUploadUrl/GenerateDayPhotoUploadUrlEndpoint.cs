using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientNutrition.GenerateDayPhotoUploadUrl;

/// <summary>
/// Generates a pre-signed URL for the caller to upload a plan-level day diary photo directly
/// to blob storage. The photo lands under <c>plan-photos/{planId}/{guid}.{ext}</c> — the
/// <see cref="ImageUploadScope.PlanPhoto"/> namespace.
/// </summary>
/// <param name="imageUpload">Image upload service — validates content type and size, then issues the signed URL.</param>
/// <param name="mongo">MongoDB context for ownership verification.</param>
/// <param name="db">Relational database context for client profile lookup.</param>
public class GenerateDayPhotoUploadUrlEndpoint(
    IImageUploadService imageUpload,
    IMongoContext mongo,
    IApplicationDbContext db)
    : Endpoint<GenerateDayPhotoUploadUrlRequest, GenerateDayPhotoUploadUrlResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/nutrition/log/day/photo-upload-url");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Generate plan-level day photo upload URL";
            s.Description =
                "Returns a time-limited pre-signed URL for direct upload of a plan-level day diary photo "
                + "to blob storage (plan-photos/{planId}/{guid}.{ext}), together with the permanent "
                + "blob URL to pass to POST /client/nutrition/log/day/photos.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GenerateDayPhotoUploadUrlRequest req, CancellationToken ct)
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

        // Verify the client has an Active nutrition plan whose date window contains today
        // (authorization gate) — a client may hold several sequential, non-overlapping Active
        // plans (#780).
        var planFilter = Builders<NutritionPlan>.Filter.And(
            Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientId),
            Builders<NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active));

        var planCursor = await mongo.NutritionPlans.FindAsync(planFilter, cancellationToken: ct);
        var activePlans = await planCursor.ToListAsync(ct);
        var todayLocalUtc = await db.ResolveClientLocalDateUtcAsync(clientId, ct);
        var plan = PlanWindowResolver.ResolveCurrentPlan(activePlans, p => p.StartDate, p => p.Weeks.Count, todayLocalUtc);

        if (plan is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Build the sub-path: {planId}/{guid}.{ext} — prefix "plan-photos/" is added by the service
        var extension = GetExtension(req.ContentType);
        var subPath = $"{plan.ExternalId}/{Guid.NewGuid()}.{extension}";

        var result = await imageUpload.GenerateUploadUrlAsync(
            ImageUploadScope.PlanPhoto,
            subPath,
            req.ContentType,
            req.SizeBytes,
            ct);

        await Send.OkAsync(new GenerateDayPhotoUploadUrlResponse
        {
            UploadUrl = result.UploadUrl,
            BlobUrl = result.BlobUrl
        }, ct);
    }

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
