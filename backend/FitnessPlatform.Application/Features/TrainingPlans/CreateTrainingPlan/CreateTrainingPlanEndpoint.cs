using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.TrainingPlans.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;

namespace FitnessPlatform.Application.Features.TrainingPlans.CreateTrainingPlan;

/// <summary>
/// Creates a new training plan for a client in Draft status.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="authHelper">Validates trainer-client relationship.</param>
public class CreateTrainingPlanEndpoint(IMongoContext mongo, ProfessionalAuthHelper authHelper)
    : Endpoint<CreateTrainingPlanRequest, TrainingPlanSummaryDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/training/plans");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Create a training plan";
            s.Description = "Creates a new training plan in Draft status for a client.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreateTrainingPlanRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);

        var hasLink = await authHelper.HasActiveLinkAsync(trainerId, req.ClientId, ct);

        if (!hasLink)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var now = DateTime.UtcNow;

        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = req.ClientId,
            TrainerId = trainerId,
            Name = req.Name,
            Description = req.Description?.Trim(),
            Status = TrainingPlanStatus.Draft,
            Weeks = Enumerable.Range(1, req.WeekCount).Select(w => new TrainingWeek
            {
                WeekNumber = w,
                Status = WeekStatus.Draft,
                Sessions = []
            }).ToList(),
            Version = 1,
            DateCreated = now,
            StartDate = req.StartDate.HasValue ? DateTime.SpecifyKind(req.StartDate.Value.Date, DateTimeKind.Utc) : null
        };

        await mongo.TrainingPlans.InsertOneAsync(plan, cancellationToken: ct);

        var response = TrainingPlanSummaryDto.FromDocument(plan);
        await HttpContext.Response.SendAsync(response, 201, cancellation: ct);
    }
}
