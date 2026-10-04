using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Trainers.GetPendingClients;

/// <summary>
/// Returns the merged Pending tab for the trainer clients list: the caller's own unaccepted
/// <c>PendingInvite</c> rows plus incoming <c>ClientRequest</c> rows with
/// <c>Status == Pending</c>, each carrying a <see cref="PendingRowKind"/> discriminator so the
/// client knows which action endpoint applies.
/// </summary>
/// <remarks>
/// Read-only and additive: this is a THIRD read over rows already served by
/// <c>GET /trainer/pending-invites</c> and <c>GET /trainer/client-requests</c>. Neither existing
/// endpoint is modified — row actions (cancel/accept/reject) still go through them, keyed by the
/// <see cref="PendingClientRow.PublicId"/> this endpoint returns.
/// <para>
/// Unpaginated, ordered by <c>SentAt</c> descending — matching the two source endpoints it
/// merges (see issue #1064's pinned ambiguity #1).
/// </para>
/// <para>
/// Returns 404 when the caller has no <see cref="Domain.Entities.ProfessionalProfile"/> row —
/// deliberately NOT the 200-empty shape <c>GetIncomingRequestsEndpoint</c> uses for that case, so
/// both tabs of one page behave alike.
/// </para>
/// </remarks>
/// <param name="db">Database context.</param>
public class GetPendingClientsEndpoint(IApplicationDbContext db) : EndpointWithoutRequest<GetPendingClientsResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/trainer/clients/pending");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Get pending clients";
            s.Description =
                "Returns the merged Pending tab: unaccepted invites plus incoming pending " +
                "requests, unpaginated, ordered by SentAt descending.";
            s.Responses[StatusCodes.Status200OK] = "Merged pending rows";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or invalid credentials";
            s.Responses[StatusCodes.Status404NotFound] = "Caller has no professional profile";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var professionalProfile = await db.ProfessionalProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(pp => pp.UserId == Guid.Parse(userId), ct);

        if (professionalProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var invites = await db.PendingInvites
            .AsNoTracking()
            .Where(pi => pi.ProfessionalProfileId == professionalProfile.Id && !pi.IsAccepted)
            .Select(pi => new PendingClientRow
            {
                Kind = PendingRowKind.Invite,
                PublicId = pi.PublicId,
                Email = pi.Email,
                Message = pi.Message,
                SentAt = pi.SentAt
            })
            .ToListAsync(ct);

        var requests = await db.ClientRequests
            .AsNoTracking()
            .Where(r => r.ProfessionalProfileId == professionalProfile.Id && r.Status == ClientRequestStatus.Pending)
            .Select(r => new PendingClientRow
            {
                Kind = PendingRowKind.Request,
                PublicId = r.PublicId,
                FirstName = r.ClientProfile.User.FirstName,
                LastName = r.ClientProfile.User.LastName,
                Email = r.ClientProfile.User.Email!,
                Message = r.Message,
                SentAt = r.SentAt
            })
            .ToListAsync(ct);

        var rows = invites
            .Concat(requests)
            .OrderByDescending(r => r.SentAt)
            .ToList();

        await Send.OkAsync(new GetPendingClientsResponse { Rows = rows }, ct);
    }
}
