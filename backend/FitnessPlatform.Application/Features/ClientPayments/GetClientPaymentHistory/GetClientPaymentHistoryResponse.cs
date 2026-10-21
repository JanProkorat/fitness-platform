namespace FitnessPlatform.Application.Features.ClientPayments.GetClientPaymentHistory;

/// <summary>
/// The coach's change history for one client, newest first.
/// </summary>
public class GetClientPaymentHistoryResponse
{
    /// <summary>The recorded changes, at most the latest 100.</summary>
    public List<ClientPaymentHistoryEntryDto> Entries { get; set; } = [];
}

/// <summary>
/// One change the coach made.
/// </summary>
public class ClientPaymentHistoryEntryDto
{
    /// <summary>
    /// What was done: SetClientPaymentTerms, AddClientOneOffPayment, MarkClientPaymentPaid,
    /// WaiveClientPayment or RequestClientPayment.
    /// </summary>
    public string Action { get; set; } = string.Empty;

    /// <summary>When it happened (UTC).</summary>
    public DateTime OccurredAt { get; set; }

    /// <summary>Public id of the payment concerned, when the action concerns one.</summary>
    public Guid? PaymentId { get; set; }

    /// <summary>The period the payment covers as "yyyy-MM", or the title of a one-off payment.</summary>
    public string? Period { get; set; }

    /// <summary>The package name for a terms change, or the reason for a waived payment.</summary>
    public string? Detail { get; set; }

    /// <summary>The discount name for a terms change.</summary>
    public string? Discount { get; set; }

    /// <summary>The amount involved, when the action has one.</summary>
    public decimal? Amount { get; set; }
}
