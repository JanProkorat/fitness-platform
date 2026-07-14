using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Client.Invites.Accept;

/// <summary>
/// Client accepts a pending invite by its PublicId. Creates the client-professional link.
/// </summary>
public class AcceptClientInviteEndpoint(
    IApplicationDbContext db,
    UserManager<ApplicationUser> userManager,
    INotificationService notificationService,
    IRealtimeNotifier notifier,
    IAuditService audit,
    IConversationSeedService conversationSeedService)
    : Endpoint<AcceptClientInviteRequest>
{
    public override void Configure()
    {
        Post("/client/invites/{Id}/accept");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Accept a pending invite";
            s.Description = "Accepts a pending invitation from a professional, creating a client-professional link.";
        });
    }

    public override async Task HandleAsync(AcceptClientInviteRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }

        var userGuid = Guid.Parse(userId);

        var caller = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userGuid, ct);
        if (caller is null) { await Send.UnauthorizedAsync(ct); return; }

        // Use NormalizedEmail (uppercase, set by Identity) for reliable matching.
        // PendingInvite.Email stores the original casing from the trainer, so compare
        // using UPPER() on both sides. Folding this into the lookup itself (rather than
        // checking after) means a GUID that belongs to someone else's invite falls
        // through to the same 404 as an unknown/consumed invite — never a distinct 403
        // that would confirm the GUID exists.
        var normalizedEmail = caller.NormalizedEmail ?? caller.Email?.ToUpper() ?? string.Empty;

        var invite = await db.PendingInvites
            .Include(pi => pi.ProfessionalProfile)
            .FirstOrDefaultAsync(pi => pi.PublicId == req.Id && !pi.IsAccepted
                && pi.Email.ToUpper() == normalizedEmail, ct);

        if (invite is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Ensure or create client profile
        var clientProfile = await db.ClientProfiles
            .FirstOrDefaultAsync(cp => cp.UserId == userGuid, ct);

        if (clientProfile is null)
        {
            clientProfile = new ClientProfile { UserId = userGuid };
            db.ClientProfiles.Add(clientProfile);
            await db.SaveChangesAsync(ct);
        }

        // Check for existing link
        var existingLink = await db.ClientProfessionalLinks
            .AnyAsync(l => l.ClientProfileId == clientProfile.Id
                           && l.ProfessionalProfileId == invite.ProfessionalProfileId, ct);

        ClientProfessionalLink? newLink = null;
        ApplicationUser? professionalUser = null;

        if (!existingLink)
        {
            professionalUser = await userManager.FindByIdAsync(
                invite.ProfessionalProfile.UserId.ToString());
            var profRoles = professionalUser is not null
                ? await userManager.GetRolesAsync(professionalUser)
                : [];

            // Grant view access per role actually held — independent booleans, not a
            // single tie-broken role, so a professional holding BOTH Trainer and
            // Nutritionist roles gets both flags (#776). Previously neither flag was
            // set here at all, defaulting both to false regardless of role.
            var profIsTrainer = profRoles.Contains(AppRoles.Trainer);
            var profIsNutritionist = profRoles.Contains(AppRoles.Nutritionist);
            var profRole = profIsNutritionist ? UserRole.Nutritionist : UserRole.Trainer;

            newLink = new ClientProfessionalLink
            {
                ClientProfileId = clientProfile.Id,
                ProfessionalProfileId = invite.ProfessionalProfileId,
                ProfessionalRole = profRole,
                IsActive = true,
                CanViewNutritionPlans = profIsNutritionist,
                CanViewTrainingPlans = profIsTrainer,
                QuestionnaireId = invite.QuestionnaireId
            };
            db.ClientProfessionalLinks.Add(newLink);
        }

        invite.IsAccepted = true;

        // Also mark matching invitation tokens as used
        var matchingTokens = await db.InvitationTokens
            .Where(t => t.ProfessionalProfileId == invite.ProfessionalProfileId
                        && t.Email == invite.Email
                        && !t.IsUsed)
            .ToListAsync(ct);

        foreach (var token in matchingTokens)
            token.IsUsed = true;

        // Save link first so it gets a generated Id for the questionnaire response
        await db.SaveChangesAsync(ct);

        // If the invite included a questionnaire, create a pending response
        // so the web portal immediately shows the "waiting" state.
        if (newLink is not null && invite.QuestionnaireId.HasValue)
        {
            var questionnaireResponse = new QuestionnaireResponse
            {
                QuestionnaireId = invite.QuestionnaireId.Value,
                ClientId = userGuid,
                ProfessionalId = invite.ProfessionalProfile.UserId,
                LinkId = newLink.Id,
                Status = QuestionnaireResponseStatus.Pending,
            };
            db.QuestionnaireResponses.Add(questionnaireResponse);
            await db.SaveChangesAsync(ct);
        }

        // If the invite carried a personal message, surface it as the first message
        // in the client-professional conversation so it shows up on the client's
        // Messages screen (#768). Gated on newLink (a brand-new link) so re-processing
        // an already-accepted invite — which 404s above via the !pi.IsAccepted filter —
        // can never reach here twice, and gated on non-empty text so we don't create an
        // empty conversation shell for invites that had no message.
        if (newLink is not null && !string.IsNullOrWhiteSpace(invite.Message))
        {
            var professionalName = professionalUser is not null
                ? $"{professionalUser.FirstName} {professionalUser.LastName}"
                : "Professional";

            await conversationSeedService.GetOrSeedConversationAsync(
                invite.ProfessionalProfile.UserId, userGuid, invite.ProfessionalProfile.UserId,
                professionalName, invite.Message, seedIntoExisting: false, ct: ct);
        }

        // Notify the professional that their invite was accepted
        var clientName = $"{caller.FirstName} {caller.LastName}";

        await notificationService.CreateAsync(
            invite.ProfessionalProfile.UserId,
            NotificationType.ClientRequestAccepted,
            new Dictionary<string, string> { ["clientName"] = clientName },
            ct: ct);

        await notifier.NotifyAsync(
            invite.ProfessionalProfile.UserId,
            "inviteaccepted",
            new { clientName, inviteId = invite.PublicId },
            ct);

        await audit.LogAsync(userGuid, "AcceptInviteFromApp", nameof(ClientProfessionalLink),
            invite.ProfessionalProfile.PublicId,
            HttpContext.Connection.RemoteIpAddress?.ToString(), ct: ct);

        await Send.NoContentAsync(ct);
    }
}

public class AcceptClientInviteRequest
{
    public Guid Id { get; set; }
}
