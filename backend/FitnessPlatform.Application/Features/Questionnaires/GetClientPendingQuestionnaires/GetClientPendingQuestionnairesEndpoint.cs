using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Questionnaires.GetClientPendingQuestionnaires;

/// <summary>
/// Returns pending questionnaires AND pending photo-diary requests so the mobile
/// Today screen can render its top banner stack from one query.
///
/// Ordering convention (intentional):
///   1. <see cref="GetClientPendingQuestionnairesResponse.PendingDiaryRequests"/> — diary first,
///      sorted by <c>CreatedAt DESC</c> within the list.
///   2. <see cref="GetClientPendingQuestionnairesResponse.Items"/> — questionnaires second,
///      one per active professional link.
///
/// The mobile client renders the two arrays in order, producing: diary banner(s) → questionnaire banner(s).
/// </summary>
public class GetClientPendingQuestionnairesEndpoint(
    IApplicationDbContext db,
    UserManager<ApplicationUser> userManager)
    : EndpointWithoutRequest<GetClientPendingQuestionnairesResponse>
{
    public override void Configure()
    {
        Get("/client/questionnaires/pending");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get pending questionnaires and diary requests for the client";
            s.Description =
                "Returns pending photo-diary requests (diary first) and pending/in-progress questionnaires " +
                "across all active professional links. Single query — no additional round-trip required.";
        });
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        var emailClaim = User.FindFirstValue(AppClaims.Email);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }
        var userGuid = Guid.Parse(userId);

        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.UserId == userGuid, ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // ── 1. Pending diary requests ─────────────────────────────────────────

        // Collect link IDs and invite IDs for this client (same dual-source pattern as ListClientRequests)
        var clientLinkIds = await db.ClientProfessionalLinks
            .AsNoTracking()
            .Where(l => l.ClientProfileId == clientProfile.Id)
            .Select(l => (long?)l.Id)
            .ToListAsync(ct);

        var clientInviteIds = emailClaim is not null
            ? await db.PendingInvites
                .AsNoTracking()
                .Where(i => i.Email == emailClaim)
                .Select(i => (long?)i.Id)
                .ToListAsync(ct)
            : [];

        var pendingDiaryEntities = await db.PhotoDiaryRequests
            .AsNoTracking()
            .Include(r => r.Professional)
            .Include(r => r.Link)
            .Where(r =>
                r.Status == PhotoDiaryStatus.Pending &&
                (
                    (r.LinkId != null && clientLinkIds.Contains(r.LinkId)) ||
                    (r.PendingInviteId != null && clientInviteIds.Contains(r.PendingInviteId))
                ))
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(ct);

        var pendingDiaryItems = new List<PendingDiaryRequestItem>(pendingDiaryEntities.Count);

        foreach (var req in pendingDiaryEntities)
        {
            // Resolve professional role:
            //   - Link-based: use the link's stored ProfessionalRole (no extra DB hit).
            //   - Invite-based: look up Identity roles (UserManager is already injected).
            string? professionalRole = null;

            if (req.Link is not null)
            {
                professionalRole = req.Link.ProfessionalRole.ToString();
            }
            else
            {
                var roles = await userManager.GetRolesAsync(req.Professional);
                professionalRole = roles.Contains(AppRoles.Nutritionist)
                    ? AppRoles.Nutritionist
                    : roles.Contains(AppRoles.Trainer) ? AppRoles.Trainer : null;
            }

            pendingDiaryItems.Add(new PendingDiaryRequestItem
            {
                RequestPublicId = req.Id,
                ProfessionalName = $"{req.Professional.FirstName} {req.Professional.LastName}",
                ProfessionalRole = professionalRole,
                DurationDays = req.DurationDays,
                Status = "Pending",
                PlanId = req.PlanId,
                CreatedAt = req.CreatedAt,
            });
        }

        // ── 2. Pending questionnaires (existing logic, unchanged) ─────────────

        // Get all active professional links (with profile/user navigation)
        var links = await db.ClientProfessionalLinks
            .Include(l => l.ProfessionalProfile).ThenInclude(pp => pp.User)
            .Where(l => l.ClientProfileId == clientProfile.Id && l.IsActive)
            .ToListAsync(ct);

        var questionnaireItems = new List<PendingQuestionnaireItem>();

        foreach (var link in links)
        {
            // Skip links where the client already submitted a questionnaire response.
            var hasSubmitted = await db.QuestionnaireResponses
                .AsNoTracking()
                .AnyAsync(r =>
                    r.ClientId == userGuid
                    && r.Status == QuestionnaireResponseStatus.Submitted
                    && (r.LinkId == link.Id || r.ProfessionalId == link.ProfessionalProfile.UserId), ct);

            if (hasSubmitted) continue;

            // Check for an existing pending/in-progress response on this link
            var existingResponse = await db.QuestionnaireResponses
                .AsNoTracking()
                .FirstOrDefaultAsync(r =>
                    r.ClientId == userGuid
                    && r.LinkId == link.Id
                    && (r.Status == QuestionnaireResponseStatus.Pending || r.Status == QuestionnaireResponseStatus.InProgress), ct);

            // Resolve which questionnaire applies for this link
            Domain.Entities.Questionnaire? questionnaire = null;

            if (link.QuestionnaireId.HasValue)
            {
                questionnaire = await db.Questionnaires
                    .AsNoTracking()
                    .FirstOrDefaultAsync(q => q.Id == link.QuestionnaireId.Value && q.IsActive, ct);
            }

            questionnaire ??= await db.Questionnaires
                .AsNoTracking()
                .FirstOrDefaultAsync(q => q.ProfessionalId == link.ProfessionalProfile.UserId && q.IsDefault && q.IsActive, ct);

            if (questionnaire is null && existingResponse is null) continue;

            questionnaireItems.Add(new PendingQuestionnaireItem
            {
                LinkPublicId = link.PublicId,
                ProfessionalName = $"{link.ProfessionalProfile.User.FirstName} {link.ProfessionalProfile.User.LastName}",
                ProfessionalRole = link.ProfessionalRole.ToString(),
                QuestionnairePublicId = questionnaire?.PublicId,
                QuestionnaireTitle = questionnaire?.Title,
                QuestionCount = questionnaire?.Questions.Count ?? 0,
                ResponsePublicId = existingResponse?.PublicId,
                ResponseStatus = existingResponse?.Status.ToString(),
            });
        }

        // ── 3. Return: diary first, questionnaires second ─────────────────────

        await Send.OkAsync(new GetClientPendingQuestionnairesResponse
        {
            PendingDiaryRequests = pendingDiaryItems,
            Items = questionnaireItems,
        }, ct);
    }
}
