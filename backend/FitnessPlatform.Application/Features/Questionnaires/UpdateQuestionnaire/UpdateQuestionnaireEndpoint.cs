using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Features.Questionnaires.Dtos;
using FitnessPlatform.Application.Features.Questionnaires.GetTrainerQuestionnaire;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Questionnaires.UpdateQuestionnaire;

public class UpdateQuestionnaireEndpoint(IApplicationDbContext db)
    : Endpoint<UpdateQuestionnaireRequest, GetTrainerQuestionnaireResponse>
{
    public override void Configure()
    {
        Put("/trainer/questionnaires/{PublicId}");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Update questionnaire";
            s.Description = "Updates a questionnaire template and its questions for the authenticated professional.";
        });
    }

    public override async Task HandleAsync(UpdateQuestionnaireRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }
        var userGuid = Guid.Parse(userId);

        var questionnaire = await db.Questionnaires
            .Include(q => q.Questions)
            .FirstOrDefaultAsync(q => q.PublicId == req.PublicId, ct);

        if (questionnaire is null || questionnaire.ProfessionalId != userGuid)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Update questionnaire fields
        questionnaire.Title = req.Title;
        questionnaire.Description = req.Description;
        questionnaire.IsActive = req.IsActive;

        // Handle IsDefault toggle
        if (req.IsDefault)
        {
            var others = await db.Questionnaires
                .Where(q => q.ProfessionalId == userGuid && q.Id != questionnaire.Id && q.IsDefault)
                .ToListAsync(ct);
            foreach (var other in others) other.IsDefault = false;
        }
        questionnaire.IsDefault = req.IsDefault;

        // Build lookup of existing questions by PublicId
        var existingByPublicId = questionnaire.Questions.ToDictionary(q => q.PublicId);

        // Track which existing questions are referenced in the request
        var referencedPublicIds = new HashSet<Guid>();

        foreach (var dto in req.Questions)
        {
            if (dto.PublicId.HasValue && existingByPublicId.TryGetValue(dto.PublicId.Value, out var existing))
            {
                // Update existing question
                referencedPublicIds.Add(dto.PublicId.Value);
                existing.OrderIndex = dto.OrderIndex;
                existing.Type = dto.Type;
                existing.Label = dto.Label;
                existing.HelperText = dto.HelperText;
                existing.IsRequired = dto.IsRequired;
                existing.IsHidden = dto.IsHidden;
                existing.Config = dto.Config;
                existing.MappedField = dto.MappedField;
            }
            else
            {
                // Create new question
                var newQuestion = new QuestionnaireQuestion
                {
                    PublicId = Guid.NewGuid(),
                    QuestionnaireId = questionnaire.Id,
                    OrderIndex = dto.OrderIndex,
                    Type = dto.Type,
                    Label = dto.Label,
                    HelperText = dto.HelperText,
                    IsRequired = dto.IsRequired,
                    IsHidden = dto.IsHidden,
                    Config = dto.Config,
                    MappedField = dto.MappedField,
                };
                questionnaire.Questions.Add(newQuestion);
            }
        }

        // Handle removed questions: hide if answers exist, delete otherwise
        var removedQuestions = questionnaire.Questions
            .Where(q => q.Id != 0 && !referencedPublicIds.Contains(q.PublicId))
            .ToList();

        foreach (var removed in removedQuestions)
        {
            var hasAnswers = await db.QuestionnaireAnswers
                .AnyAsync(a => a.QuestionId == removed.Id, ct);

            if (hasAnswers)
            {
                removed.IsHidden = true;
            }
            else
            {
                questionnaire.Questions.Remove(removed);
                db.QuestionnaireQuestions.Remove(removed);
            }
        }

        await db.SaveChangesAsync(ct);

        // Reload ordered questions for response
        var orderedQuestions = questionnaire.Questions
            .OrderBy(q => q.OrderIndex)
            .Select(q => new QuestionDto
            {
                PublicId = q.PublicId,
                OrderIndex = q.OrderIndex,
                Type = q.Type,
                Label = q.Label,
                HelperText = q.HelperText,
                IsRequired = q.IsRequired,
                IsHidden = q.IsHidden,
                Config = q.Config,
                MappedField = q.MappedField,
            })
            .ToList();

        await Send.OkAsync(new GetTrainerQuestionnaireResponse
        {
            PublicId = questionnaire.PublicId,
            Title = questionnaire.Title,
            Description = questionnaire.Description,
            IsActive = questionnaire.IsActive,
            IsDefault = questionnaire.IsDefault,
            Questions = orderedQuestions,
        }, ct);
    }
}
