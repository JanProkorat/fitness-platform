using System.Text.Json;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Writes the audit entries of the client payment actions. Every entry is filed under the client's payment
/// assignment, so one lookup by that id returns the whole change history. Entries never hold the IBAN
/// or the client's name.
/// </summary>
internal static class ClientPaymentAudit
{
    /// <summary>Action name of setting a client's terms.</summary>
    public const string SetTerms = "SetClientPaymentTerms";

    /// <summary>Action name of ending a client's terms when the collaboration ends.</summary>
    public const string EndTerms = "EndClientPaymentTerms";

    /// <summary>Action name of adding a one-off payment.</summary>
    public const string AddOneOff = "AddClientOneOffPayment";

    /// <summary>Action name of marking a payment paid.</summary>
    public const string MarkPaid = "MarkClientPaymentPaid";

    /// <summary>Action name of waiving a payment.</summary>
    public const string Waive = "WaiveClientPayment";

    /// <summary>Action name of requesting a payment.</summary>
    public const string Request = "RequestClientPayment";

    /// <summary>The entity type every payment audit entry is filed under.</summary>
    public static readonly string EntityType = nameof(ClientPaymentAssignment);

    private const int MaxValuesLength = 500;

    /// <summary>
    /// Records one action against the assignment.
    /// </summary>
    /// <param name="audit">Audit logging service.</param>
    /// <param name="userId">The coach who acted.</param>
    /// <param name="action">One of the action names on this class.</param>
    /// <param name="assignmentPublicId">The assignment the entry is filed under.</param>
    /// <param name="ipAddress">The caller's IP address.</param>
    /// <param name="values">What the action did, serialized as JSON; kept within the column's 500 characters.</param>
    /// <param name="ct">Cancellation token.</param>
    public static Task LogAsync(
        IAuditService audit,
        Guid userId,
        string action,
        Guid assignmentPublicId,
        string? ipAddress,
        object values,
        CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(values);

        if (json.Length > MaxValuesLength)
        {
            json = json[..MaxValuesLength];
        }

        return audit.LogAsync(userId, action, EntityType, assignmentPublicId, ipAddress, null, json, ct);
    }
}
