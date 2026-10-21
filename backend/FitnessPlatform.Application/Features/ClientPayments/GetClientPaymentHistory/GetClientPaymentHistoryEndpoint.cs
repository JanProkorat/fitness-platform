using System.Security.Claims;
using System.Text.Json;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.ClientPayments.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.ClientPayments.GetClientPaymentHistory;

/// <summary>
/// Returns the coach's change history for one client, read from the audit log by the client's payment assignment.
/// </summary>
/// <param name="db">Application database context.</param>
/// <param name="entitlementService">Resolves subscription entitlements.</param>
/// <param name="linkAuthorizationService">Resolves the caller's live link to the client.</param>
internal sealed class GetClientPaymentHistoryEndpoint(
    IApplicationDbContext db,
    EntitlementService entitlementService,
    IClientLinkAuthorizationService linkAuthorizationService)
    : Endpoint<GetClientPaymentHistoryRequest, GetClientPaymentHistoryResponse>
{
    private const int MaxEntries = 100;

    /// <inheritdoc />
    public override void Configure()
    {
        Get("/payments/clients/{ClientId}/history");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Get a client's payment change history";
            s.Description = "Lists the latest 100 changes the coach made to the client's terms and payments, newest first. Only the coach sees it.";
            s.Responses[StatusCodes.Status200OK] = "The change history";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status403Forbidden] = "The subscription does not include payments (PAYMENTS_NOT_ENTITLED)";
            s.Responses[StatusCodes.Status404NotFound] = "The caller has no professional profile or no live link to the client";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetClientPaymentHistoryRequest req, CancellationToken ct)
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

        var assignment = await ClientPaymentGuards.FindAssignmentAsync(db, context, ct);

        if (assignment is null)
        {
            await Send.OkAsync(new GetClientPaymentHistoryResponse(), ct);
            return;
        }

        var rows = await db.AuditLogs
            .AsNoTracking()
            .Where(a => a.EntityId == assignment.PublicId && a.EntityType == ClientPaymentAudit.EntityType)
            .OrderByDescending(a => a.DateCreated)
            .ThenByDescending(a => a.Id)
            .Take(MaxEntries)
            .ToListAsync(ct);

        await Send.OkAsync(
            new GetClientPaymentHistoryResponse { Entries = rows.Select(ToEntry).ToList() },
            ct);
    }

    private static ClientPaymentHistoryEntryDto ToEntry(AuditLog row)
    {
        var entry = new ClientPaymentHistoryEntryDto { Action = row.Action, OccurredAt = row.DateCreated };

        if (string.IsNullOrEmpty(row.NewValues))
        {
            return entry;
        }

        try
        {
            using var document = JsonDocument.Parse(row.NewValues);
            var root = document.RootElement;

            entry.PaymentId = Guid.TryParse(ReadString(root, "paymentId"), out var parsed) ? parsed : null;
            entry.Period = ReadString(root, "period");
            entry.Detail = ReadString(root, "detail");
            entry.Discount = ReadString(root, "discount");
            entry.Amount = root.TryGetProperty("amount", out var amount)
                && amount.ValueKind == JsonValueKind.Number
                && amount.TryGetDecimal(out var value)
                    ? value
                    : null;
        }
        catch (JsonException)
        {
            // An entry cut at the column limit is no longer valid JSON; show it without details.
        }

        return entry;
    }

    private static string? ReadString(JsonElement root, string name) =>
        root.TryGetProperty(name, out var element) && element.ValueKind == JsonValueKind.String
            ? element.GetString()
            : null;
}
