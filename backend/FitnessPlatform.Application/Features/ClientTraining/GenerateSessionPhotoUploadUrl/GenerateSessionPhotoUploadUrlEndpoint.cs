using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientTraining.GenerateSessionPhotoUploadUrl;

/// <summary>
/// Generates a pre-signed URL for the caller to upload a training session diary photo directly to blob storage.
/// The photo lands under <c>diary/sessions/{sessionId}/{guid}.{ext}</c> — the <see cref="ImageUploadScope.Diary"/>
/// namespace — mirroring the meal diary photo upload URL pattern.
/// </summary>
/// <param name="imageUpload">Image upload service — validates content type and size, then issues the signed URL.</param>
/// <param name="mongo">MongoDB context for ownership verification.</param>
/// <param name="db">Relational database context for client profile lookup.</param>
public class GenerateSessionPhotoUploadUrlEndpoint(
    IImageUploadService imageUpload,
    IMongoContext mongo,
    IApplicationDbContext db)
    : Endpoint<GenerateSessionPhotoUploadUrlRequest, GenerateSessionPhotoUploadUrlResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/training/log/sessions/{SessionId}/photo-upload-url");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Generate training session photo upload URL";
            s.Description =
                "Returns a time-limited pre-signed URL for direct upload of a training session diary photo "
                + "to blob storage (diary/sessions/{sessionId}/{guid}.{ext}), together with the permanent "
                + "blob URL to pass to POST /client/training/log/sessions/{sessionId}/photos.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GenerateSessionPhotoUploadUrlRequest req, CancellationToken ct)
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

        // Resolve the client's Active training plan whose date window contains today — a client
        // may hold several sequential, non-overlapping Active plans (#780).
        var planFilter = Builders<TrainingPlan>.Filter.And(
            Builders<TrainingPlan>.Filter.Eq(p => p.ClientId, clientId),
            Builders<TrainingPlan>.Filter.Eq(p => p.Status, TrainingPlanStatus.Active));

        var planCursor = await mongo.TrainingPlans.FindAsync(planFilter, cancellationToken: ct);
        var activePlans = await planCursor.ToListAsync(ct);
        var plan = PlanWindowResolver.ResolveCurrentPlan(activePlans, p => p.StartDate, p => p.Weeks.Count, DateTime.UtcNow);

        if (plan is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Verify the SessionId belongs to the active plan
        var session = plan.Weeks
            .SelectMany(w => w.Days)
            .SelectMany(d => d.Sessions)
            .FirstOrDefault(s => s.SessionId == req.SessionId);

        if (session is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Build the sub-path: sessions/{sessionId}/{guid}.{ext} — prefix "diary/" is added by the service
        var extension = GetExtension(req.ContentType);
        var subPath = $"sessions/{req.SessionId}/{Guid.NewGuid()}.{extension}";

        var result = await imageUpload.GenerateUploadUrlAsync(
            ImageUploadScope.Diary,
            subPath,
            req.ContentType,
            req.SizeBytes,
            ct);

        await Send.OkAsync(new GenerateSessionPhotoUploadUrlResponse
        {
            UploadUrl = result.UploadUrl,
            BlobUrl = result.BlobUrl
        }, ct);
    }

    // Returns a file extension for known image content types.
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
