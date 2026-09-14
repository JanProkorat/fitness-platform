using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Features.SessionTemplates.GetSessionTemplate;
using FitnessPlatform.Application.Features.SessionTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.AspNetCore.Http;

namespace FitnessPlatform.Application.Features.SessionTemplates.CreateSessionTemplate;

/// <summary>
/// Creates a new reusable session template owned by the calling trainer.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="timeProvider">Injected system clock.</param>
internal sealed class CreateSessionTemplateEndpoint(IMongoContext mongo, TimeProvider timeProvider)
    : Endpoint<CreateSessionTemplateRequest, SessionTemplateDetailResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/training/session-templates");
        Roles(AppRoles.Trainer);
        DontCatchExceptions();
        Description(b => b.WithName(nameof(CreateSessionTemplateEndpoint)));
        Summary(s =>
        {
            s.Summary = "Create session template";
            s.Description = "Creates a new reusable session template (workouts + standalone exercises) owned by the calling trainer.";
            s.Responses[StatusCodes.Status201Created] = "Session template created";
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid request body";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or invalid credentials";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreateSessionTemplateRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);

        var template = new SessionTemplate
        {
            ExternalId = Guid.NewGuid(),
            OwnerId = trainerId,
            Name = req.Name,
            LocalizedNames = req.LocalizedNames,
            Description = req.Description,
            Difficulty = req.Difficulty,
            EstimatedDurationMinutes = req.EstimatedDurationMinutes,
            Format = req.Format,
            FormatConfig = req.FormatConfig,
            Workouts = req.Workouts,
            StandaloneExercises = req.StandaloneExercises,
            Visibility = req.Visibility,
            DateCreated = timeProvider.GetUtcNow().UtcDateTime,
            Version = 1
        };

        await mongo.SessionTemplates.InsertOneAsync(template, cancellationToken: ct);

        await Send.CreatedAtAsync<GetSessionTemplateEndpoint>(
            new { TemplateId = template.ExternalId },
            SessionTemplateDetailResponse.FromDocument(template, trainerId),
            cancellation: ct);
    }
}
