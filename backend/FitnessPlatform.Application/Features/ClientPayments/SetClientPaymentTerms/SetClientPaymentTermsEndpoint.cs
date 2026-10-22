using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Authorization;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.ClientPayments.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.ClientPayments.SetClientPaymentTerms;

/// <summary>
/// Sets the package, and the discount or custom price, a client pays under. The terms apply to billing
/// periods that start after the change; a period that already started keeps the old ones.
/// </summary>
/// <param name="db">Application database context.</param>
/// <param name="entitlementService">Resolves subscription entitlements.</param>
/// <param name="linkAuthorizationService">Resolves the caller's live link to the client.</param>
/// <param name="audit">Audit logging service.</param>
/// <param name="timeProvider">Clock.</param>
[RemovedCoachRole(RemovedCoachRoleMode.Refuse)]
internal sealed class SetClientPaymentTermsEndpoint(
    IApplicationDbContext db,
    EntitlementService entitlementService,
    IClientLinkAuthorizationService linkAuthorizationService,
    IAuditService audit,
    TimeProvider timeProvider)
    : Endpoint<SetClientPaymentTermsRequest, SetClientPaymentTermsResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("/payments/clients/{ClientId}/terms");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Set a client's package and price";
            s.Description = "Sets the package and the discount or custom price the client pays under. Applies from the next billing period; setting identical terms changes nothing.";
            s.Responses[StatusCodes.Status200OK] = "The terms in force";
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid body: both a discount and a custom price, an amount out of range (PAYMENT_AMOUNT_INVALID), a first period in the past (PAYMENT_START_DATE_INVALID) or a fixed discount in another currency than the package (CURRENCY_MISMATCH)";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status403Forbidden] = "The subscription does not include payments (PAYMENTS_NOT_ENTITLED), or the coach role was removed";
            s.Responses[StatusCodes.Status404NotFound] = "No live link to the client, or the package or discount is unknown or belongs to another coach";
            s.Responses[StatusCodes.Status409Conflict] = "The package is archived (PACKAGE_ARCHIVED), the discount is archived (DISCOUNT_ARCHIVED) or does not apply to the package (DISCOUNT_PACKAGE_INVALID), or the coach has no client number left (PAYMENT_CLIENT_NUMBER_EXHAUSTED)";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SetClientPaymentTermsRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(AppClaims.UserId), out var userId))
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var context = await this.LoadCoachClientContextOrRespondAsync(
            db, entitlementService, linkAuthorizationService, userId, req.ClientId, ct);

        if (context is null)
        {
            return;
        }

        var package = await db.CoachPackages
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.PublicId == req.PackageId && p.ProfessionalProfileId == context.ProfessionalProfileId, ct);

        if (package is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (package.ArchivedAt is not null)
        {
            await this.SendProblemAsync(StatusCodes.Status409Conflict, ErrorCodes.PackageArchived, "The package is archived.", ct);
            return;
        }

        var discount = await LoadDiscountOrRespondAsync(req, package, context.ProfessionalProfileId, ct);

        if (req.DiscountId is not null && discount is null)
        {
            return;
        }

        var now = timeProvider.GetUtcNow().UtcDateTime;
        var today = ClientPaymentSchedule.Today(now);

        if (req.FirstPeriodStart is { } firstStart && firstStart < today)
        {
            this.ThrowErrorWithCode(ErrorCodes.PaymentStartDateInvalid, "The first period cannot start in the past.");
            return;
        }

        var assignment = await StoreTermsAsync(req, context, package, discount, userId, now, today, ct);

        if (assignment is null)
        {
            return;
        }

        var settings = await db.CoachPaymentSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.ProfessionalProfileId == context.ProfessionalProfileId, ct);

        await ClientPaymentSchedule.MaterializeAsync(
            db, assignment, settings?.VariableSymbolFormat ?? VariableSymbolFormat.YearMonthClientNumber, now, ct);

        await Send.OkAsync(await BuildResponseAsync(assignment, ct), ct);
    }

    /// <summary>
    /// Loads the requested discount and checks it may be used with the package. Answers 404 for an unknown
    /// or foreign discount and 409 for an archived one or one that does not cover the package; returns null
    /// in those cases and when no discount was asked for.
    /// </summary>
    private async Task<CoachDiscount?> LoadDiscountOrRespondAsync(
        SetClientPaymentTermsRequest req, CoachPackage package, long professionalProfileId, CancellationToken ct)
    {
        if (req.DiscountId is not { } discountId)
        {
            return null;
        }

        var discount = await db.CoachDiscounts
            .AsNoTracking()
            .Include(d => d.Packages)
            .FirstOrDefaultAsync(d => d.PublicId == discountId && d.ProfessionalProfileId == professionalProfileId, ct);

        if (discount is null)
        {
            await Send.NotFoundAsync(ct);
            return null;
        }

        if (discount.ArchivedAt is not null)
        {
            await this.SendProblemAsync(StatusCodes.Status409Conflict, ErrorCodes.DiscountArchived, "The discount is archived.", ct);
            return null;
        }

        if (!CoachDiscountRules.CoversPackage(discount, package))
        {
            await this.SendProblemAsync(
                StatusCodes.Status409Conflict,
                ErrorCodes.DiscountPackageInvalid,
                "The discount does not apply to the package.",
                ct);
            return null;
        }

        if (discount.Type == DiscountType.FixedAmount && discount.Currency != package.Currency)
        {
            await this.SendProblemAsync(
                StatusCodes.Status400BadRequest,
                ErrorCodes.CurrencyMismatch,
                "A fixed discount can only be used with a package in its own currency.",
                ct);
            return null;
        }

        return discount;
    }

    /// <summary>
    /// Stores the terms (and the assignment, on first use) in one transaction under the coach lock. Returns the
    /// assignment, or null after answering 409 when the coach has no client number left.
    /// </summary>
    private async Task<ClientPaymentAssignment?> StoreTermsAsync(
        SetClientPaymentTermsRequest req,
        CoachClientContext context,
        CoachPackage package,
        CoachDiscount? discount,
        Guid userId,
        DateTime now,
        DateOnly today,
        CancellationToken ct)
    {
        await using var transaction = await db.BeginTransactionAsync(ct);
        await db.LockProfessionalProfileAsync(context.ProfessionalProfileId, ct);

        var assignment = await ClientPaymentGuards.GetOrCreateAssignmentAsync(db, context, ct);

        if (assignment is null)
        {
            await this.SendProblemAsync(
                StatusCodes.Status409Conflict,
                ErrorCodes.PaymentClientNumberExhausted,
                "The coach has used every client number.",
                ct);
            return null;
        }

        var latest = await db.ClientPaymentTerms
            .Where(t => t.ClientPaymentAssignmentId == assignment.Id)
            .OrderByDescending(t => t.EffectiveFromUtc)
            .ThenByDescending(t => t.Id)
            .FirstOrDefaultAsync(ct);

        var unchanged = latest is not null
            && latest.CoachPackageId == package.Id
            && latest.CoachDiscountId == discount?.Id
            && latest.CustomPrice == req.CustomPrice;

        if (!unchanged)
        {
            var hasPeriods = await db.ClientPayments
                .AnyAsync(p => p.ClientPaymentAssignmentId == assignment.Id && p.PeriodStart != null, ct);

            // The first terms start the schedule on the chosen day. Later terms apply from now, so a period that
            // has started keeps its price; terms still waiting for a future start are replaced in place.
            var effectiveFrom = hasPeriods && latest is not null
                ? (latest.EffectiveFromUtc > now ? latest.EffectiveFromUtc : now)
                : ClientPaymentSchedule.StartOfDayUtc(req.FirstPeriodStart ?? today);

            db.ClientPaymentTerms.Add(new ClientPaymentTerms
            {
                ClientPaymentAssignmentId = assignment.Id,
                CoachPackageId = package.Id,
                CoachDiscountId = discount?.Id,
                CustomPrice = req.CustomPrice,
                EffectiveFromUtc = effectiveFrom
            });
            await db.SaveChangesAsync(ct);

            // Upcoming periods that start under the new terms were made from the old ones; drop them (their
            // variable symbols go with them) and let the schedule create them again. Requested, paid and
            // waived rows are locked and stay.
            // A change of discount or custom price keeps the periods: their amounts follow the terms anyway.
            var staleIds = latest is not null && latest.CoachPackageId == package.Id
                ? new List<long>()
                : (await db.ClientPayments
                    .Where(p => p.ClientPaymentAssignmentId == assignment.Id
                        && p.Status == ClientPaymentStatus.Upcoming
                        && p.PeriodStart != null)
                    .Select(p => new { p.Id, PeriodStart = p.PeriodStart!.Value })
                    .ToListAsync(ct))
                .Where(p => ClientPaymentSchedule.StartOfDayUtc(p.PeriodStart) >= effectiveFrom)
                .Select(p => p.Id)
                .ToList();

            if (staleIds.Count > 0)
            {
                await db.ClientPayments.Where(p => staleIds.Contains(p.Id)).ExecuteDeleteAsync(ct);
            }

            await ClientPaymentAudit.LogAsync(
                audit,
                userId,
                ClientPaymentAudit.SetTerms,
                assignment.PublicId,
                HttpContext.Connection.RemoteIpAddress?.ToString(),
                new
                {
                    detail = package.Name,
                    discount = discount?.Name,
                    amount = req.CustomPrice,
                    removed = staleIds.Count
                },
                ct);
        }

        await transaction.CommitAsync(ct);

        return assignment;
    }

    private async Task<SetClientPaymentTermsResponse> BuildResponseAsync(ClientPaymentAssignment assignment, CancellationToken ct)
    {
        var terms = await ClientPaymentSchedule.LoadTermsAsync(db, assignment.Id, ct);
        var latest = terms[^1];
        var payments = await db.ClientPayments
            .AsNoTracking()
            .Where(p => p.ClientPaymentAssignmentId == assignment.Id && p.PeriodStart != null)
            .OrderBy(p => p.PeriodStart)
            .ToListAsync(ct);
        var starts = payments.Select(p => p.PeriodStart!.Value).ToList();
        var first = payments.FirstOrDefault(p => ClientPaymentSchedule.StartOfDayUtc(p.PeriodStart!.Value) >= latest.EffectiveFromUtc);

        return new SetClientPaymentTermsResponse
        {
            PackageId = latest.CoachPackage.PublicId,
            DiscountId = latest.CoachDiscount?.PublicId,
            CustomPrice = latest.CustomPrice,
            Currency = latest.CoachPackage.Currency,
            EffectiveFromUtc = latest.EffectiveFromUtc,
            AppliesFromPeriodStart = first?.PeriodStart,
            Amount = first is null ? null : ClientPaymentSchedule.FiguresOf(first, terms, starts).Amount
        };
    }
}
