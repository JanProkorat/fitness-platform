using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Trainers.CreateCollaboration;

/// <summary>
/// Endpoint for inviting another professional (trainer or nutritionist) to co-manage a client.
/// The requesting trainer must already have an active link to the client that grants at
/// least one CanView* capability — the new collaborator link can never carry a capability
/// the caller's own link does not hold.
/// </summary>
/// <param name="db">Database context.</param>
/// <param name="userManager">ASP.NET Identity user manager for role lookups.</param>
public class CreateCollaborationEndpoint(IApplicationDbContext db, UserManager<ApplicationUser> userManager)
    : Endpoint<CreateCollaborationRequest, CreateCollaborationResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/trainer/collaborations");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Create collaboration";
            s.Description =
                "Invites another professional (trainer or nutritionist) to co-manage one of the requesting trainer's clients.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreateCollaborationRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        // Find the requesting trainer's profile
        var professionalProfile = await db.ProfessionalProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(tp => tp.UserId == Guid.Parse(userId), ct);

        if (professionalProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Find the client by PublicId
        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.PublicId == req.ClientPublicId, ct);

        if (clientProfile is null)
        {
            ThrowError("Client not found.");
            return;
        }

        // Verify the requesting trainer has an active link to this client
        var callerLink = await db.ClientProfessionalLinks
            .AsNoTracking()
            .FirstOrDefaultAsync(ctl =>
                ctl.ProfessionalProfileId == professionalProfile.Id &&
                ctl.ClientProfileId == clientProfile.Id &&
                ctl.IsActive, ct);

        if (callerLink is null)
        {
            ThrowError("You do not have an active relationship with this client.");
            return;
        }

        // A caller cannot delegate a capability their own link does not grant — an
        // active link with neither CanView* flag set has nothing to delegate. Reject
        // (400), don't silently mint a powerless link: a caller with no capability at
        // all requesting a collaboration is a caller error, not something to downgrade
        // to a no-op link.
        if (!callerLink.CanViewNutritionPlans && !callerLink.CanViewTrainingPlans)
        {
            this.ThrowErrorWithCode(
                ErrorCodes.RequestedScopeExceedsHeldRoles,
                "Requested scope exceeds the caller's held roles.");
            return;
        }

        // Find the collaborator's ProfessionalProfile by PublicId
        var collaboratorProfile = await db.ProfessionalProfiles
            .Include(tp => tp.User)
            .FirstOrDefaultAsync(tp => tp.PublicId == req.CollaboratorPublicId, ct);

        if (collaboratorProfile is null)
        {
            ThrowError("Collaborator not found.");
            return;
        }

        // Check if the collaborator already has a link to this client
        var collaboratorAlreadyLinked = await db.ClientProfessionalLinks
            .AsNoTracking()
            .AnyAsync(ctl =>
                ctl.ProfessionalProfileId == collaboratorProfile.Id &&
                ctl.ClientProfileId == clientProfile.Id, ct);

        if (collaboratorAlreadyLinked)
        {
            ThrowError("This collaborator already has a link to the specified client.");
            return;
        }

        // Determine the collaborator's role — grant view access per role actually
        // held (independent booleans), not a single tie-broken role, so a
        // collaborator holding BOTH Trainer and Nutritionist roles gets both
        // flags (#776). Previously neither CanView* flag was set here at all.
        var collaboratorRoles = await userManager.GetRolesAsync(collaboratorProfile.User);
        var collaboratorIsTrainer = collaboratorRoles.Contains(AppRoles.Trainer);
        var collaboratorIsNutritionist = collaboratorRoles.Contains(AppRoles.Nutritionist);
        var collaboratorRole = collaboratorIsNutritionist ? UserRole.Nutritionist : UserRole.Trainer;

        // A caller-requested scope narrows the collaborator's CanView* flags below the
        // full set implied by the roles the collaborator actually holds — it must never
        // widen them. Reject (400), don't clamp: a request for a domain the collaborator
        // doesn't hold is a caller error, not something to silently downgrade.
        if (req.RequestedScope == LinkCapabilityScope.NutritionOnly && !collaboratorIsNutritionist)
        {
            this.ThrowErrorWithCode(
                ErrorCodes.RequestedScopeExceedsHeldRoles,
                "Requested scope exceeds the collaborator's held roles.");
            return;
        }

        if (req.RequestedScope == LinkCapabilityScope.TrainingOnly && !collaboratorIsTrainer)
        {
            this.ThrowErrorWithCode(
                ErrorCodes.RequestedScopeExceedsHeldRoles,
                "Requested scope exceeds the collaborator's held roles.");
            return;
        }

        // Clamp to the intersection of what the collaborator's held roles/requested
        // scope would imply AND what the caller's own link actually grants. A caller
        // cannot delegate a capability they do not hold themselves — without this,
        // any professional with an active but narrowly-scoped link could mint a
        // collaborator link carrying a capability their own link denies.
        var canViewNutritionPlans = (req.RequestedScope switch
        {
            LinkCapabilityScope.NutritionOnly => true,
            LinkCapabilityScope.TrainingOnly => false,
            _ => collaboratorIsNutritionist
        }) && callerLink.CanViewNutritionPlans;

        var canViewTrainingPlans = (req.RequestedScope switch
        {
            LinkCapabilityScope.TrainingOnly => true,
            LinkCapabilityScope.NutritionOnly => false,
            _ => collaboratorIsTrainer
        }) && callerLink.CanViewTrainingPlans;

        // A both-flags-false link is a state the rest of the system already treats as
        // invalid — every gated read endpoint returns 403 for a link carrying neither
        // capability (#916), and this combination is otherwise unreachable in
        // production. Reject (400) rather than persist: a row the readers refuse to
        // honour is a worse outcome than a clear rejection — it would put a
        // professional in the client's collaborations list who can see nothing, and
        // report success for an operation that achieved nothing. The earlier
        // caller-capability guard above stays too — it's cheaper and gives a clearer
        // failure for the "caller holds nothing at all" case; this one catches the
        // narrower "caller and collaborator hold disjoint capabilities" case.
        if (!canViewNutritionPlans && !canViewTrainingPlans)
        {
            this.ThrowErrorWithCode(
                ErrorCodes.RequestedScopeExceedsHeldRoles,
                "Requested scope exceeds the caller's held roles.");
            return;
        }

        // A client may hold at most one active coach per profession (#980). This is
        // the most direct violator this guard closes — CreateCollaboration previously
        // minted a link to a DIFFERENT professional with no profession check at all;
        // the guard ladder above only ever checked the CALLER's own capabilities.
        //
        // Both the caller AND the collaborator are excluded from the collision check:
        // the collaborator's flags are clamped to what the caller's own link already
        // grants (see above), so the caller's link necessarily already carries every
        // flag this collaboration could grant. Only a genuinely unrelated THIRD
        // professional (onboarded via one of the other three link-creation paths)
        // should block a collaboration.
        if (await ProfessionSlotGuard.IsSlotTakenByAnotherProfessionalAsync(
                db.ClientProfessionalLinks, clientProfile.Id,
                [professionalProfile.Id, collaboratorProfile.Id],
                canViewNutritionPlans, canViewTrainingPlans, ct))
        {
            this.ThrowErrorWithCode(
                ErrorCodes.ProfessionAlreadyOccupied,
                "The client already has an active professional occupying this profession slot.");
            return;
        }

        // Create the new ClientProfessionalLink
        var link = new ClientProfessionalLink
        {
            ClientProfileId = clientProfile.Id,
            ProfessionalProfileId = collaboratorProfile.Id,
            ProfessionalRole = collaboratorRole,
            IsActive = true,
            CanViewNutritionPlans = canViewNutritionPlans,
            CanViewTrainingPlans = canViewTrainingPlans
        };

        db.ClientProfessionalLinks.Add(link);
        await db.SaveChangesAsync(ct);

        await Send.ResponseAsync(new CreateCollaborationResponse
        {
            Message = "Collaboration created successfully."
        }, 201, ct);
    }
}
