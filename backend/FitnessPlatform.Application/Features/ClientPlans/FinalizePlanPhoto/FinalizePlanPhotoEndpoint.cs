using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientPlans.FinalizePlanPhoto;

/// <summary>
/// Finalizes a plan photo upload by inserting a <see cref="PlanPhoto"/> row in PostgreSQL.
/// The caller must have already uploaded the image to blob storage using the pre-signed URL
/// from POST /client/plans/{planId}/photos/upload-url.
///
/// Ownership: looks up the plan in NutritionPlans first; falls back to TrainingPlans.
/// Returns 404 if neither exists for the given client.
/// </summary>
/// <param name="mongo">MongoDB context for plan lookup.</param>
/// <param name="db">Relational database context for profile lookup and photo insert.</param>
public class FinalizePlanPhotoEndpoint(
    IMongoContext mongo,
    IApplicationDbContext db)
    : Endpoint<FinalizePlanPhotoRequest, PlanPhotoResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/plans/{PlanId}/photos");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Finalize plan photo upload";
            s.Description =
                "Inserts a PlanPhoto row after the client has PUT the blob to the pre-signed URL. "
                + "The plan is looked up in NutritionPlans first; if not found, TrainingPlans. "
                + "Returns 404 if neither exists for this client. "
                + "Sets PlanType and LinkId automatically from the found plan.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(FinalizePlanPhotoRequest req, CancellationToken ct)
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

        var clientId = clientProfile.PublicId;

        // Resolve plan type and link: nutrition first, training fallback
        var (planType, linkId) = await ResolvePlanAsync(req.PlanId, clientId, ct);

        if (planType is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var now = DateTime.UtcNow;

        var photo = new PlanPhoto
        {
            PublicId = Guid.NewGuid(),
            ClientProfileId = clientProfile.Id,
            PlanId = req.PlanId,
            PlanType = planType,
            LinkId = linkId,
            Category = req.Category,
            BlobUrl = req.BlobUrl,
            Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim(),
            MealLogId = req.Category == PlanPhotoCategory.Food ? req.MealLogId : null,
            TakenAt = req.TakenAt ?? now,
            UploadedByUserId = callerUserId,
            DateCreated = now,
            DateUpdated = now
        };

        db.PlanPhotos.Add(photo);
        await db.SaveChangesAsync(ct);

        var response = MapToResponse(photo);
        HttpContext.Response.Headers.Location =
            $"/client/plans/{req.PlanId}/photos/{photo.PublicId}";
        await Send.ResponseAsync(response, StatusCodes.Status201Created, ct);
    }

    private async Task<(PlanPhotoType? planType, Guid? linkId)> ResolvePlanAsync(
        Guid planId, Guid clientId, CancellationToken ct)
    {
        // Try nutrition plan
        var nutritionFilter = Builders<NutritionPlan>.Filter.And(
            Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, planId),
            Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientId));

        var nutritionCursor = await mongo.NutritionPlans.FindAsync(nutritionFilter, cancellationToken: ct);
        var nutritionPlan = await nutritionCursor.FirstOrDefaultAsync(ct);

        if (nutritionPlan is not null)
            return (PlanPhotoType.Nutrition, nutritionPlan.ExternalId);

        // Fall back to training plan
        var trainingFilter = Builders<TrainingPlan>.Filter.And(
            Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, planId),
            Builders<TrainingPlan>.Filter.Eq(p => p.ClientId, clientId));

        var trainingCursor = await mongo.TrainingPlans.FindAsync(trainingFilter, cancellationToken: ct);
        var trainingPlan = await trainingCursor.FirstOrDefaultAsync(ct);

        if (trainingPlan is not null)
            return (PlanPhotoType.Training, trainingPlan.ExternalId);

        return (null, null);
    }

    private static PlanPhotoResponse MapToResponse(PlanPhoto photo) => new()
    {
        Id = photo.PublicId,
        BlobUrl = photo.BlobUrl,
        Category = photo.Category,
        Description = photo.Description,
        TakenAt = photo.TakenAt,
        MealLogId = photo.MealLogId,
        PlanId = photo.PlanId,
        PlanType = photo.PlanType,
        DateCreated = photo.DateCreated,
        UploadedByUserId = photo.UploadedByUserId
    };
}
