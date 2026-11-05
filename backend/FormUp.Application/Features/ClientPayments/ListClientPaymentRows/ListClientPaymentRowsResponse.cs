using FormUp.Application.Features.ClientPayments.Shared;

namespace FormUp.Application.Features.ClientPayments.ListClientPaymentRows;

/// <summary>
/// The payments of one client, newest due date first.
/// </summary>
public class ListClientPaymentRowsResponse
{
    /// <summary>The payments, with overdue ones marked.</summary>
    public List<ClientPaymentRowDto> Payments { get; set; } = [];
}
