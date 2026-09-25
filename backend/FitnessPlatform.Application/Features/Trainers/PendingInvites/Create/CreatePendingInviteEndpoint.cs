using System.Security.Claims;
using System.Security.Cryptography;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Trainers.PendingInvites.Create;

/// <summary>
/// Endpoint for creating a pending client invitation.
/// Creates both a PendingInvite record and an InvitationToken, then sends the invitation email.
/// Also creates an in-app notification and sends a real-time event if the client already has an
/// account. If that account belongs to a CLIENT and its email is already verified, immediately
/// seeds the professional-client conversation with an Invited cooperation event — see the
/// maintainer ruling in <see cref="HandleAsync"/>. For an unverified or nonexistent client
/// account, the identical rows are written later, once the email is verified, by
/// <c>VerifyEmailEndpoint</c> via <see cref="IPendingInviteConversationSeeder"/>.
/// </summary>
public class CreatePendingInviteEndpoint(
    IApplicationDbContext db,
    IBackgroundEmailQueue emailQueue,
    INotificationService notificationService,
    IRealtimeNotifier notifier,
    IConversationSeedService conversationSeedService,
    UserManager<ApplicationUser> userManager,
    ILogger<CreatePendingInviteEndpoint> logger) : Endpoint<CreatePendingInviteRequest, CreatePendingInviteResponse>
{
    /// <summary>
    /// Maximum number of outstanding (unaccepted) pending invites a single professional may
    /// hold at once. Bounds the standing fan-out an abusive account can build up even when
    /// paced below the <see cref="AppPolicies.PendingInviteRateLimit"/> window — 200 comfortably
    /// exceeds any real professional's prospective-client roster (claude-security F8).
    /// </summary>
    private const int MaxOutstandingInvitesPerProfessional = 200;

    /// <inheritdoc />
    public override void Configure()
    {
        Post("/trainer/pending-invites");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist, AppRoles.Admin);
        Options(x => x.RequireRateLimiting(AppPolicies.PendingInviteRateLimit));
        Summary(s =>
        {
            s.Summary = "Create a pending invitation";
            s.Description = "Creates a pending invitation for a client, sends an invitation email with a one-time token valid for 7 days.";
            s.Responses[StatusCodes.Status400BadRequest] =
                "Requested scope exceeds the caller's held roles, or the invitee email belongs to a coaching professional account.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreatePendingInviteRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var professionalProfile = await db.ProfessionalProfiles
            .FirstOrDefaultAsync(tp => tp.UserId == Guid.Parse(userId), ct);

        if (professionalProfile is null)
        {
            ThrowError("Professional profile not found. Please complete your profile setup first.");
            return;
        }

        // A requested scope narrows the eventual link's CanView* flags below the full
        // set implied by the inviting professional's held roles — it must never widen
        // them. Reject (400), don't clamp: a request for a domain the professional
        // doesn't hold is a caller error, not something to silently downgrade.
        if (req.RequestedScope == LinkCapabilityScope.NutritionOnly && !User.IsInRole(AppRoles.Nutritionist))
        {
            this.ThrowErrorWithCode(
                ErrorCodes.RequestedScopeExceedsHeldRoles,
                "Requested scope exceeds the caller's held roles.");
            return;
        }

        if (req.RequestedScope == LinkCapabilityScope.TrainingOnly && !User.IsInRole(AppRoles.Trainer))
        {
            this.ThrowErrorWithCode(
                ErrorCodes.RequestedScopeExceedsHeldRoles,
                "Requested scope exceeds the caller's held roles.");
            return;
        }

        // Reject inviting an email that belongs to an account holding a coaching professional
        // role (Trainer or Nutritionist) — even if that same account also holds Client (dual
        // role). This is a caller input-shape error, not a business-state conflict, so it runs
        // before any of the invite's own persisted-state checks (duplicate/cap/slot below) and
        // before any save.
        var normalizedInviteeEmailForRoleCheck = req.Email.ToUpper();
        var inviteeUserForRoleCheck = await db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.NormalizedEmail == normalizedInviteeEmailForRoleCheck, ct);

        if (inviteeUserForRoleCheck is not null)
        {
            var inviteeRoles = await userManager.GetRolesAsync(inviteeUserForRoleCheck);

            if (inviteeRoles.Contains(AppRoles.Trainer) || inviteeRoles.Contains(AppRoles.Nutritionist))
            {
                this.ThrowErrorWithCode(
                    ErrorCodes.InviteeIsProfessional,
                    "This email belongs to a coaching professional and cannot be invited as a client.");
                return;
            }
        }

        // Reject a duplicate pending invite for the same professional and email — repeatedly
        // re-inviting the same target is the abuse shape, not a legitimate workflow need (a
        // professional who wants to resend can delete the existing invite first).
        var reqEmailLowerForDuplicateCheck = req.Email.ToLower();
        var hasDuplicate = await db.PendingInvites
            .AsNoTracking()
            .AnyAsync(pi => pi.ProfessionalProfileId == professionalProfile.Id
                         && pi.Email.ToLower() == reqEmailLowerForDuplicateCheck
                         && !pi.IsAccepted, ct);

        if (hasDuplicate)
        {
            await this.SendProblemAsync(409, ErrorCodes.DuplicatePendingInvite,
                "An unaccepted invite already exists for this email.", ct);
            return;
        }

        // Cap outstanding (unaccepted) invites per professional — bounds the standing fan-out
        // an abusive account can build up even when paced below the rate-limit window.
        var outstandingCount = await db.PendingInvites
            .AsNoTracking()
            .CountAsync(pi => pi.ProfessionalProfileId == professionalProfile.Id && !pi.IsAccepted, ct);

        if (outstandingCount >= MaxOutstandingInvitesPerProfessional)
        {
            await this.SendProblemAsync(429, ErrorCodes.TooManyPendingInvites,
                "Maximum number of outstanding pending invites reached.", ct);
            return;
        }

        // Refuse to invite a client who already has an active coach in the profession this
        // invite would grant. The authoritative check stays at accept time — that one runs
        // inside the row lock (#1009) and is what actually protects the invariant, since the
        // client's links can change between invite and accept. This one exists so the inviting
        // professional finds out now rather than the client discovering it as a 400 days later
        // on a link they were never able to form.
        //
        // Note this necessarily tells the inviting professional that the address they typed
        // belongs to an account whose slot is taken. That is a deliberate trade-off for the
        // earlier feedback, and it is narrow: only for an email they already knew, and it
        // reveals that the slot is occupied, never by whom.
        //
        // Skipped entirely when the invitee has no account yet — the common case for a
        // prospective client, and there is no ClientProfile or link to check.
        var normalizedInviteeEmail = req.Email.ToUpper();
        var inviteeClientProfileId = await db.Users
            .AsNoTracking()
            .Where(u => u.NormalizedEmail == normalizedInviteeEmail)
            .Join(db.ClientProfiles.AsNoTracking(),
                u => u.Id,
                cp => cp.UserId,
                (_, cp) => cp.Id)
            .FirstOrDefaultAsync(ct);

        if (inviteeClientProfileId != 0)
        {
            // Same derivation the accept paths use: the professional's held roles narrowed by
            // the scope they requested. Kept in step with AcceptClientInviteEndpoint — if that
            // derivation changes, this must change with it or the two verdicts diverge.
            var wantsNutritionPlans = req.RequestedScope switch
            {
                LinkCapabilityScope.NutritionOnly => true,
                LinkCapabilityScope.TrainingOnly => false,
                _ => User.IsInRole(AppRoles.Nutritionist)
            };

            var wantsTrainingPlans = req.RequestedScope switch
            {
                LinkCapabilityScope.TrainingOnly => true,
                LinkCapabilityScope.NutritionOnly => false,
                _ => User.IsInRole(AppRoles.Trainer)
            };

            if (await ProfessionSlotGuard.IsSlotTakenByAnotherProfessionalAsync(
                    db.ClientProfessionalLinks, inviteeClientProfileId, professionalProfile.Id,
                    wantsNutritionPlans, wantsTrainingPlans, ct))
            {
                this.ThrowErrorWithCode(
                    ErrorCodes.ProfessionAlreadyOccupied,
                    "The client already has an active professional occupying this profession slot.");
                return;
            }
        }

        // Resolve optional questionnaire
        long? questionnaireId = null;
        if (req.QuestionnairePublicId.HasValue)
        {
            var questionnaire = await db.Questionnaires
                .FirstOrDefaultAsync(q => q.PublicId == req.QuestionnairePublicId.Value
                    && q.ProfessionalId == Guid.Parse(userId), ct);
            questionnaireId = questionnaire?.Id;
        }

        // Create the PendingInvite record
        var pendingInvite = new PendingInvite
        {
            ProfessionalProfileId = professionalProfile.Id,
            Email = req.Email,
            Message = req.Message,
            SentAt = DateTime.UtcNow,
            QuestionnaireId = questionnaireId,
            RequestedScope = req.RequestedScope
        };

        db.PendingInvites.Add(pendingInvite);

        // Create the InvitationToken so the accept flow still works. Stamped with the
        // same requested scope so AcceptInvitationEndpoint (token-based accept) honors
        // the identical choice as AcceptClientInviteEndpoint (in-app accept via the
        // PendingInvite id) — whichever path the client uses to accept.
        var tokenValue = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));

        var invitation = new InvitationToken
        {
            ProfessionalProfileId = professionalProfile.Id,
            Email = req.Email,
            Token = tokenValue,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            RequestedScope = req.RequestedScope
        };

        db.InvitationTokens.Add(invitation);
        await db.SaveChangesAsync(ct);

        // Send invitation email
        var trainerUser = await db.Users.FirstAsync(u => u.Id == professionalProfile.UserId, ct);
        var trainerName = $"{trainerUser.FirstName} {trainerUser.LastName}";

        var language = HttpContext.Request.Headers.AcceptLanguage.FirstOrDefault() ?? "en";

        // Enqueue the send fire-and-forget (#1109): an SMTP failure in the background worker
        // must never turn a successful invite creation into a 500, or skip the notification,
        // realtime event, and #1100 chat seed below. TryEnqueue is non-blocking; a full or
        // completed queue drops the send and logs rather than falling back to a synchronous
        // send that would reintroduce exactly the failure mode this closes.
        if (!emailQueue.TryEnqueue(new InvitationEmailWorkItem(req.Email, trainerName, tokenValue, language, req.Message)))
        {
            logger.LogWarning(
                "Background email queue full; dropped invitation email enqueue for {Email}.",
                req.Email);
        }

        // If the invited client already has an account, create an in-app notification + real-time event
        var reqEmailLower = req.Email.ToLower();
        var existingUser = await db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Email!.ToLower() == reqEmailLower, ct);

        if (existingUser is not null)
        {
            // MAINTAINER RULING 2026-09-23 (closed, do not reopen): F8 is reversed. This branch
            // used to defer the conversation seed to acceptance — claude-security's original F8
            // finding was that seeding it here let any professional account drop attacker-written
            // prose straight into an arbitrary stranger's message stream, addressed only by
            // guessing their email. The maintainer's call: for a VERIFIED account, seed the
            // conversation and write the Invited event (plus the message beneath it, if any)
            // immediately below, instead of waiting for accept.
            //
            // Accepted risk: an authenticated professional who already knows a registered,
            // verified email address can write an entry into that account's own message thread
            // before the invitee has agreed to anything. This is bounded, not open-ended — by
            // AppPolicies.PendingInviteRateLimit and by MaxOutstandingInvitesPerProfessional
            // (200) above, both of which cap the fan-out a single abusive account can build.
            // An unverified or nonexistent account gets no thread here — VerifyEmailEndpoint
            // seeds the identical rows once the account is verified (R4).
            //
            // The notification and realtime event below stay: their payload is composed here
            // from the professional's own profile and the invite id, the invitee needs some
            // signal that an invite arrived, and the message they carry is the same text
            // GetPendingInviteEndpoint already returns for the invite itself.
            await notificationService.CreateAsync(
                existingUser.Id,
                NotificationType.InvitationReceived,
                new Dictionary<string, string>
                {
                    ["trainerName"] = trainerName,
                    ["inviteId"] = pendingInvite.PublicId.ToString(),
                },
                ct: ct);

            var senderRole = User.IsInRole(AppRoles.Nutritionist) ? "Nutritionist" : "Trainer";

            await notifier.NotifyAsync(
                existingUser.Id,
                "invitationreceived",
                new
                {
                    id = pendingInvite.PublicId,
                    trainerId = professionalProfile.PublicId,
                    trainerName,
                    trainerRole = senderRole,
                    trainerCity = professionalProfile.City ?? string.Empty,
                    message = pendingInvite.Message
                },
                ct);

            // Verified CLIENT accounts only (R4), never a self-invite — an unverified
            // invitee gets no thread until VerifyEmailEndpoint seeds the identical rows,
            // and a verified peer professional or the caller's own email gets no thread
            // at all (#1108 review: EmailConfirmed alone let a professional seed a
            // conversation into a peer's or their own message stream).
            if (existingUser.EmailConfirmed
                && inviteeClientProfileId != 0
                && existingUser.Id != professionalProfile.UserId)
            {
                await conversationSeedService.AppendCooperationEventAsync(
                    professionalProfile.UserId,
                    existingUser.Id,
                    professionalProfile.UserId,
                    ChatEventType.Invited,
                    pendingInvite.PublicId,
                    pendingInvite.Message,
                    createConversationIfMissing: true,
                    ct);
            }
        }

        logger.LogInformation(
            "Pending invitation created from professional {ProfessionalId} to {Email}",
            professionalProfile.PublicId, req.Email);

        await Send.ResponseAsync(new CreatePendingInviteResponse
        {
            Id = pendingInvite.Id,
            PublicId = pendingInvite.PublicId,
            Email = pendingInvite.Email,
            SentAt = pendingInvite.SentAt,
            QuestionnairePublicId = req.QuestionnairePublicId
        }, cancellation: ct);
    }
}
