using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.NutritionPlans.GetPlan;

/// <summary>
/// Retrieves a single nutrition plan with full detail (weeks, days, meals, foods).
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">PostgreSQL context — resolves the client's PublicId for the response.</param>
/// <param name="authHelper">Link capability helper — authorship identifies the plan, the caller's
/// live link to its client decides access.</param>
public class GetPlanEndpoint(IMongoContext mongo, IApplicationDbContext db, ProfessionalAuthHelper authHelper)
    : Endpoint<GetPlanRequest, GetPlanResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/nutrition/plans/{PlanId}");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Get a nutrition plan";
            s.Description = "Returns the full nutrition plan with all weeks, days, meals, and foods.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetPlanRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var nutritionistId = Guid.Parse(userId);

        var plan = await this.LoadOwnedNutritionPlanIfAllowedAsync(mongo, authHelper, req.PlanId, nutritionistId, ct);

        if (plan is null)
        {
            return;
        }

        // plan.ClientId is the internal ApplicationUser.Id storage key (#840); the response's
        // ClientId must stay the client-facing ClientProfile.PublicId (pre-#840 contract) since
        // web/mobile feed it into /trainer/clients/{clientId}/... routes.
        var clientPublicId = await db.ResolveClientPublicIdAsync(plan.ClientId, ct);
        var response = GetPlanResponse.FromDocument(plan, clientPublicId);

        // ── MealLog fold-in ──────────────────────────────────────────────────────
        // Query MealLogs by PlanId only. Authorship AND the caller's live nutrition link to the
        // plan's client are both validated above, so there is no IDOR risk here.
        //
        // A meal is considered eaten iff MealLog.EatenAt != null.
        // MealLog.EatenAt == null means the log is a photo-only or note-only stub
        // and is NOT treated as eaten (disambiguation rule per issue #329).
        var logFilter = Builders<MealLog>.Filter.Eq(l => l.PlanId, req.PlanId);
        var logCursor = await mongo.MealLogs.FindAsync(logFilter, cancellationToken: ct);
        var mealLogs = await logCursor.ToListAsync(ct);

        response.MealLogs = mealLogs
            .Select(l => new MealEatenStatusDto
            {
                MealId = l.MealId,
                LogDate = DateOnly.FromDateTime(l.LogDate),
                IsEaten = l.EatenAt.HasValue,
                EatenAt = l.EatenAt
            })
            .ToList();

        await Send.OkAsync(response, ct);
    }
}
