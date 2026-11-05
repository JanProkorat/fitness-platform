using System.Security.Claims;
using FastEndpoints;
using FormUp.Application.Domain.Constants;
using FormUp.Application.Domain.Enums;
using FormUp.Application.Domain.Services;
using FormUp.Application.Infrastructure.Data;
using FormUp.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;

namespace FormUp.Application.Features.Trainers.GetPendingClients;

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
/// <param name="mongo">MongoDB context.</param>
/// <param name="timeProvider">Clock.</param>
public class GetPendingClientsEndpoint(IApplicationDbContext db, IMongoContext mongo, TimeProvider timeProvider) : EndpointWithoutRequest<GetPendingClientsResponse>
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

        var now = timeProvider.GetUtcNow().UtcDateTime;

        var storedInvites = await db.PendingInvites
            .AsNoTracking()
            .Where(pi => pi.ProfessionalProfileId == professionalProfile.Id && pi.Status == PendingInviteStatus.Pending)
            .Select(pi => new PendingClientRow
            {
                Kind = PendingRowKind.Invite,
                PublicId = pi.PublicId,
                Email = pi.Email,
                Message = pi.Message,
                SentAt = pi.SentAt,
                Package = pi.CoachPackage == null
                    ? null
                    : new PendingRowPackageDto
                    {
                        PublicId = pi.CoachPackage.PublicId,
                        Name = pi.CoachPackage.Name,
                        Billing = pi.CoachPackage.Billing,
                        IntervalWeeks = pi.CoachPackage.IntervalWeeks,
                        Price = pi.CoachPackage.Price,
                        Currency = pi.CoachPackage.Currency,
                    },
            })
            .ToListAsync(ct);

        // One row per email: a re-invite supersedes its expired predecessor (#1541). A lone
        // expired invite stays listed, flagged Expired, so the coach can still cancel it.
        var invites = PendingInviteStatusResolver.OnePerEmail(storedInvites, i => i.Email, i => i.SentAt, now);
        foreach (var invite in invites)
        {
            invite.Status = PendingInviteStatusResolver.Resolve(PendingInviteStatus.Pending, invite.SentAt, now);
        }

        var requestRows = await db.ClientRequests
            .AsNoTracking()
            .Where(r => r.ProfessionalProfileId == professionalProfile.Id
                && (r.Status == ClientRequestStatus.Pending || r.Status == ClientRequestStatus.PackageProposed))
            .Select(r => new
            {
                Row = new PendingClientRow
                {
                    Kind = PendingRowKind.Request,
                    PublicId = r.PublicId,
                    FirstName = r.ClientProfile.User.FirstName,
                    LastName = r.ClientProfile.User.LastName,
                    Email = r.ClientProfile.User.Email!,
                    Message = r.Message,
                    SentAt = r.SentAt,
                    ShareHistory = r.ShareHistory,
                    Package = r.CoachPackage == null
                        ? null
                        : new PendingRowPackageDto
                        {
                            PublicId = r.CoachPackage.PublicId,
                            Name = r.CoachPackage.Name,
                            Billing = r.CoachPackage.Billing,
                            IntervalWeeks = r.CoachPackage.IntervalWeeks,
                            Price = r.CoachPackage.Price,
                            Currency = r.CoachPackage.Currency,
                        },
                    Proposal = r.Status == ClientRequestStatus.PackageProposed && r.ProposedPackage != null
                        ? new PendingRowProposalDto
                        {
                            ProposedAt = r.ProposedAt ?? r.SentAt,
                            Package = new PendingRowPackageDto
                            {
                                PublicId = r.ProposedPackage.PublicId,
                                Name = r.ProposedPackage.Name,
                                Billing = r.ProposedPackage.Billing,
                                IntervalWeeks = r.ProposedPackage.IntervalWeeks,
                                Price = r.ProposedPackage.Price,
                                Currency = r.ProposedPackage.Currency,
                            },
                            Discount = r.ProposedDiscount == null
                                ? null
                                : new PendingRowDiscountDto
                                {
                                    PublicId = r.ProposedDiscount.PublicId,
                                    Name = r.ProposedDiscount.Name,
                                    Type = r.ProposedDiscount.Type,
                                    Value = r.ProposedDiscount.Value,
                                    Currency = r.ProposedDiscount.Currency,
                                },
                        }
                        : null,
                },
                r.ClientProfileId,
                ClientUserId = r.ClientProfile.UserId,
            })
            .ToListAsync(ct);

        // History counts only for clients who agreed to share, fetched once for the whole list.
        var counts = await ClientHistoryCounts.LoadAsync(
            db,
            mongo,
            requestRows.Where(r => r.Row.ShareHistory).Select(r => (r.ClientProfileId, r.ClientUserId)).ToList(),
            ct);

        var requests = requestRows.Select(r =>
        {
            if (r.Row.ShareHistory && counts.TryGetValue(r.ClientProfileId, out var history))
            {
                r.Row.History = new PendingRowHistoryDto
                {
                    PlanCount = history.PlanCount,
                    MeasurementCount = history.MeasurementCount,
                    PhotoCount = history.PhotoCount,
                };
            }

            return r.Row;
        }).ToList();

        var rows = invites
            .Concat(requests)
            .OrderByDescending(r => r.SentAt)
            .ToList();

        await Send.OkAsync(new GetPendingClientsResponse { Rows = rows }, ct);
    }
}
