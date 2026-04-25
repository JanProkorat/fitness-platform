using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientPlans.GeneratePlanPhotoUploadUrl;

/// <summary>
/// Generates a pre-signed URL for the client to upload a plan photo directly to blob storage.
/// The photo lands under <c>plan-photos/{planId}/{guid}.{ext}</c> — the
/// <see cref="ImageUploadScope.PlanPhoto"/> namespace.
/// The client must own an active nutrition or training plan with the given <c>planId</c>.
/// </summary>
/// <param name="imageUpload">Image upload service — validates content type and size, then issues the signed URL.</param>
/// <param name="mongo">MongoDB context for plan ownership verification.</param>
/// <param name="db">Relational database context for client profile lookup.</param>
public class GeneratePlanPhotoUploadUrlEndpoint(
    IImageUploadService imageUpload,
    IMongoContext mongo,
    IApplicationDbContext db)
    : Endpoint<GeneratePlanPhotoUploadUrlRequest, GeneratePlanPhotoUploadUrlResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/plans/{PlanId}/photos/upload-url");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Generate plan photo upload URL";
            s.Description =
                "Returns a time-limited pre-signed URL for direct upload of a plan photo "
                + "to blob storage (plan-photos/{planId}/{guid}.{ext}), together with the "
                + "permanent blob URL to pass to POST /client/plans/{planId}/photos.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GeneratePlanPhotoUploadUrlRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.UserId == Guid.Parse(userId), ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var clientId = clientProfile.PublicId;

        // Verify ownership: try nutrition plan first, then training plan.
        var planExists = await PlanExistsForClientAsync(req.PlanId, clientId, ct);

        if (!planExists)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var extension = GetExtension(req.ContentType);
        var subPath = $"{req.PlanId}/{Guid.NewGuid()}.{extension}";

        var result = await imageUpload.GenerateUploadUrlAsync(
            ImageUploadScope.PlanPhoto,
            subPath,
            req.ContentType,
            req.SizeBytes,
            ct);

        await Send.OkAsync(new GeneratePlanPhotoUploadUrlResponse
        {
            UploadUrl = result.UploadUrl,
            BlobUrl = result.BlobUrl
        }, ct);
    }

    private async Task<bool> PlanExistsForClientAsync(Guid planId, Guid clientId, CancellationToken ct)
    {
        // Try active nutrition plan first
        var nutritionFilter = Builders<NutritionPlan>.Filter.And(
            Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, planId),
            Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientId));

        var nutritionCursor = await mongo.NutritionPlans.FindAsync(nutritionFilter, cancellationToken: ct);
        if (await nutritionCursor.AnyAsync(ct))
            return true;

        // Fall back to training plan
        var trainingFilter = Builders<TrainingPlan>.Filter.And(
            Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, planId),
            Builders<TrainingPlan>.Filter.Eq(p => p.ClientId, clientId));

        var trainingCursor = await mongo.TrainingPlans.FindAsync(trainingFilter, cancellationToken: ct);
        return await trainingCursor.AnyAsync(ct);
    }

    private static string GetExtension(string contentType) => contentType.ToLowerInvariant() switch
    {
        "image/jpeg" => "jpg",
        "image/png"  => "png",
        "image/webp" => "webp",
        "image/heic" => "heic",
        _            => "bin",
    };
}
