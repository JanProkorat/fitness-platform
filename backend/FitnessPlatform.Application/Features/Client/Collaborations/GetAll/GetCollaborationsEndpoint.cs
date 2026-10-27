using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Client.Collaborations.GetAll;

/// <summary>
/// Returns the client's active professional collaborations.
/// </summary>
public class GetCollaborationsEndpoint(IApplicationDbContext db, TimeProvider timeProvider) : EndpointWithoutRequest<GetCollaborationsResponse>
{
    public override void Configure()
    {
        Get("/client/collaborations");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get active collaborations";
            s.Description = "Returns all active professional links for the authenticated client, each with the first payment of its current terms and the effective weekly check-in days.";
            s.Responses[StatusCodes.Status200OK] = "The client's active collaborations";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
        });
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }

        var userGuid = Guid.Parse(userId);

        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.UserId == userGuid, ct);

        if (clientProfile is null)
        {
            await Send.OkAsync(new GetCollaborationsResponse(), ct);
            return;
        }

        var links = await db.ClientProfessionalLinks
            .AsNoTracking()
            .Where(l => l.ClientProfileId == clientProfile.Id && l.IsActive)
            .Include(l => l.ProfessionalProfile)
                .ThenInclude(pp => pp.User)
            .Select(l => new CollaborationDto
            {
                PublicId = l.PublicId,
                ProfessionalPublicId = l.ProfessionalProfile.PublicId,
                ProfessionalName = l.ProfessionalProfile.User.FirstName + " " + l.ProfessionalProfile.User.LastName,
                ProfessionalCity = l.ProfessionalProfile.City,
                Role = l.ProfessionalRole.ToString(),
                CoveredType = CoachRoleStatus.ScopeFromGrant(l.CanViewNutritionPlans, l.CanViewTrainingPlans),
                Since = l.DateCreated,
                // Same fallback as SearchProfessionals / GetPublicProfile:
                // surface the personal user avatar when the pro-profile one
                // hasn't been set (most trainers upload only one photo today).
                AvatarBlobUrl = l.ProfessionalProfile.AvatarBlobUrl ?? l.ProfessionalProfile.User.AvatarBlobUrl
            })
            .OrderBy(l => l.Role)
            .ToListAsync(ct);

        await AttachFirstPaymentsAsync(links, clientProfile.Id, ct);
        await AttachCheckInsAsync(links, clientProfile.Id, userGuid, ct);

        await Send.OkAsync(new GetCollaborationsResponse { Collaborations = links }, ct);
    }

    /// <summary>
    /// Sets each collaboration's first payment from the current terms of the client's assignment with that coach.
    /// </summary>
    private async Task AttachFirstPaymentsAsync(List<CollaborationDto> collaborations, long clientProfileId, CancellationToken ct)
    {
        var assignments = await db.ClientPaymentAssignments
            .AsNoTracking()
            .Where(a => a.ClientProfileId == clientProfileId)
            .Select(a => new { a.Id, ProfessionalPublicId = a.ProfessionalProfile.PublicId })
            .ToListAsync(ct);

        var today = ClientPaymentSchedule.Today(timeProvider.GetUtcNow().UtcDateTime);

        foreach (var assignment in assignments)
        {
            var collaboration = collaborations.FirstOrDefault(c => c.ProfessionalPublicId == assignment.ProfessionalPublicId);

            if (collaboration is null)
            {
                continue;
            }

            var terms = await ClientPaymentSchedule.LoadTermsAsync(db, assignment.Id, ct);
            var current = terms.OrderByDescending(t => t.EffectiveFromUtc).ThenByDescending(t => t.Id).FirstOrDefault();

            if (current is null || current.EndsAtUtc is not null)
            {
                continue;
            }

            var payments = await db.ClientPayments
                .AsNoTracking()
                .Where(p => p.ClientPaymentAssignmentId == assignment.Id
                    && p.Kind == ClientPaymentKind.Recurring
                    && p.PeriodStart != null
                    && !p.IsKeptAfterEnd)
                .ToListAsync(ct);

            // Only periods since the latest end of the collaboration count: a returning client starts again.
            // A period on the very day of the end belongs to the new collaboration only if its row was created after the end.
            var latestEnd = terms.Where(t => t.EndsAtUtc is not null).Select(t => t.EndsAtUtc!.Value).DefaultIfEmpty().Max();
            var endDay = latestEnd == default ? DateOnly.MinValue : ClientPaymentSchedule.Today(latestEnd);
            var first = payments
                .Where(p => latestEnd == default
                    || ClientPaymentSchedule.StartOfDayUtc(p.PeriodStart!.Value) >= latestEnd
                    || (p.PeriodStart >= endDay && p.DateCreated >= latestEnd))
                .OrderBy(p => p.PeriodStart)
                .FirstOrDefault();

            if (first is null)
            {
                continue;
            }

            var figures = ClientPaymentSchedule.FiguresOf(first, terms, ClientPaymentSchedule.RecurringStartsOf(payments));

            collaboration.FirstPayment = new CollaborationFirstPaymentDto
            {
                PackageName = figures.PackageName,
                Amount = figures.Amount,
                Currency = first.Currency,
                Status = ClientPaymentSchedule.DerivedStatus(first.Status, first.DueDate, today),
                DueDate = first.DueDate,
                PaymentId = first.Status is ClientPaymentStatus.Requested or ClientPaymentStatus.Paid ? first.PublicId : null
            };
        }
    }

    /// <summary>
    /// Sets each collaboration's check-in days the way <c>WeeklyCheckInScheduler</c> resolves them, limited to the
    /// professions the link lets the client see.
    /// </summary>
    private async Task AttachCheckInsAsync(List<CollaborationDto> collaborations, long clientProfileId, Guid clientUserId, CancellationToken ct)
    {
        var links = await db.ClientProfessionalLinks
            .AsNoTracking()
            .Where(l => l.ClientProfileId == clientProfileId && l.IsActive)
            .Select(l => new
            {
                l.PublicId,
                ProfessionalUserId = l.ProfessionalProfile.UserId,
                l.CanViewTrainingPlans,
                l.CanViewNutritionPlans
            })
            .ToListAsync(ct);

        var professionalUserIds = links.Select(l => l.ProfessionalUserId).ToList();

        var settings = await db.WeeklyCheckInSettings
            .AsNoTracking()
            .Where(s => s.Enabled && professionalUserIds.Contains(s.UserId))
            .ToListAsync(ct);

        var overrides = await db.WeeklyCheckInClientOverrides
            .AsNoTracking()
            .Where(o => o.ClientUserId == clientUserId && professionalUserIds.Contains(o.ProfessionalUserId))
            .ToListAsync(ct);

        foreach (var link in links)
        {
            var collaboration = collaborations.First(c => c.PublicId == link.PublicId);

            foreach (var setting in settings.Where(s => s.UserId == link.ProfessionalUserId).OrderBy(s => s.Profession))
            {
                var visible = setting.Profession == Profession.Training ? link.CanViewTrainingPlans : link.CanViewNutritionPlans;
                var clientOverride = overrides.FirstOrDefault(o =>
                    o.ProfessionalUserId == link.ProfessionalUserId && o.Profession == setting.Profession);

                if (!visible || clientOverride?.Enabled == false)
                {
                    continue;
                }

                collaboration.CheckIns.Add(new CollaborationCheckInDto
                {
                    Profession = setting.Profession,
                    DayOfWeek = clientOverride?.DayOfWeek ?? setting.DayOfWeek
                });
            }
        }
    }
}

public class GetCollaborationsResponse
{
    public List<CollaborationDto> Collaborations { get; set; } = [];
}

public class CollaborationDto
{
    public Guid PublicId { get; set; }
    public Guid ProfessionalPublicId { get; set; }
    public string ProfessionalName { get; set; } = string.Empty;
    public string? ProfessionalCity { get; set; }
    public string Role { get; set; } = string.Empty;

    /// <summary>Collaboration type the link covers, or null when it grants no plan view.</summary>
    public LinkCapabilityScope? CoveredType { get; set; }

    public DateTime Since { get; set; }
    /// <summary>
    /// Professional's avatar URL. Falls back to the underlying user's
    /// personal avatar when the professional-profile-specific one isn't set.
    /// Null when neither is uploaded.
    /// </summary>
    public string? AvatarBlobUrl { get; set; }

    /// <summary>
    /// First payment of the collaboration's current terms; null when the client has no terms with this professional.
    /// </summary>
    public CollaborationFirstPaymentDto? FirstPayment { get; set; }

    /// <summary>
    /// Weekdays the professional's weekly check-ins reach this client; empty when none is scheduled.
    /// </summary>
    public List<CollaborationCheckInDto> CheckIns { get; set; } = [];
}
