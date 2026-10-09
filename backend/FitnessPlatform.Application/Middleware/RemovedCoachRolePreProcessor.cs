using System.Collections.Concurrent;
using System.Reflection;
using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Authorization;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FluentValidation.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Middleware;

/// <summary>
/// Global pre-processor that makes a removed coach role read-only. Reads, non-coach and dual-discipline
/// endpoints exit without any database work; an unannotated single-discipline write fails closed as a refusal.
/// </summary>
public sealed class RemovedCoachRolePreProcessor : IGlobalPreProcessor
{
    /// <summary><see cref="HttpContext.Items"/> key set to true when the caller's role is removed but the write was let through.</summary>
    public const string RoleRemovedItemKey = "RemovedCoachRole.Removed";

    private static readonly string[] ReadMethods = ["GET", "HEAD", "OPTIONS"];

    private static readonly ConcurrentDictionary<Microsoft.AspNetCore.Http.Endpoint, GateRule> Rules = new();

    /// <inheritdoc />
    public async Task PreProcessAsync(IPreProcessorContext context, CancellationToken ct)
    {
        var http = context.HttpContext;
        var endpoint = http.GetEndpoint();

        if (endpoint is null)
        {
            return;
        }

        var rule = Rules.GetOrAdd(endpoint, Resolve);

        if (rule.Mode is null or RemovedCoachRoleMode.Exempt || !http.User.IsInRole(rule.Role))
        {
            return;
        }

        if (!Guid.TryParse(http.User.FindFirstValue(AppClaims.UserId), out var userId))
        {
            await RefuseAsync(http, ct);
            return;
        }

        var db = http.RequestServices.GetRequiredService<IApplicationDbContext>();
        var removal = await db.ProfessionalProfiles
            .AsNoTracking()
            .Where(profile => profile.UserId == userId)
            .Select(profile => new { profile.TrainerRoleRemovedAt, profile.NutritionistRoleRemovedAt })
            .FirstOrDefaultAsync(ct);

        var removed = rule.Role == AppRoles.Trainer
            ? removal?.TrainerRoleRemovedAt is not null
            : removal?.NutritionistRoleRemovedAt is not null;

        if (!removed)
        {
            return;
        }

        if (rule.Mode == RemovedCoachRoleMode.WhilePlanInProgress &&
            await IsPlanInProgressAsync(http, rule.Role, userId, ct))
        {
            http.Items[RoleRemovedItemKey] = true;
            return;
        }

        await RefuseAsync(http, ct);
    }

    private static async Task<bool> IsPlanInProgressAsync(HttpContext http, string role, Guid userId, CancellationToken ct)
    {
        if (!Guid.TryParse(http.GetRouteValue("PlanId")?.ToString(), out var planId))
        {
            return false;
        }

        var mongo = http.RequestServices.GetRequiredService<IMongoContext>();
        var today = DateOnly.FromDateTime(http.RequestServices.GetRequiredService<TimeProvider>().GetUtcNow().UtcDateTime);

        if (role == AppRoles.Trainer)
        {
            var plan = await mongo.TrainingPlans
                .Find(p => p.ExternalId == planId && p.TrainerId == userId)
                .Project(p => new { p.Status, p.StartDate, WeekCount = p.Weeks.Count })
                .FirstOrDefaultAsync(ct);

            return plan is not null &&
                   plan.Status == TrainingPlanStatus.Active &&
                   PlanWindowResolver.HasNotEnded(plan.StartDate, plan.WeekCount, today);
        }

        var nutritionPlan = await mongo.NutritionPlans
            .Find(p => p.ExternalId == planId && p.NutritionistId == userId)
            .Project(p => new { p.Status, p.StartDate, WeekCount = p.Weeks.Count })
            .FirstOrDefaultAsync(ct);

        return nutritionPlan is not null &&
               nutritionPlan.Status == NutritionPlanStatus.Active &&
               PlanWindowResolver.HasNotEnded(nutritionPlan.StartDate, nutritionPlan.WeekCount, today);
    }

    private static Task RefuseAsync(HttpContext http, CancellationToken ct) =>
        http.Response.SendErrorsAsync(
            [new ValidationFailure("", "This coach role was removed; the account is read-only for it.")
            {
                ErrorCode = ErrorCodes.CoachRoleRemoved,
            }],
            StatusCodes.Status403Forbidden,
            cancellation: ct);

    private static GateRule Resolve(Microsoft.AspNetCore.Http.Endpoint endpoint)
    {
        var methods = endpoint.Metadata.GetMetadata<IHttpMethodMetadata>()?.HttpMethods ?? [];

        if (methods.All(method => ReadMethods.Contains(method, StringComparer.OrdinalIgnoreCase)))
        {
            return GateRule.Open;
        }

        var roles = endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>()
            .SelectMany(data => (data.Roles ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            .Distinct()
            .ToList();

        if (roles.Count != 1 || roles[0] is not (AppRoles.Trainer or AppRoles.Nutritionist))
        {
            return GateRule.Open;
        }

        var attribute = endpoint.Metadata.GetMetadata<EndpointDefinition>()?.EndpointType
            .GetCustomAttribute<RemovedCoachRoleAttribute>();

        return new GateRule(roles[0], attribute?.Mode ?? RemovedCoachRoleMode.Refuse);
    }

    private sealed record GateRule(string Role, RemovedCoachRoleMode? Mode)
    {
        public static GateRule Open { get; } = new(string.Empty, null);
    }
}
