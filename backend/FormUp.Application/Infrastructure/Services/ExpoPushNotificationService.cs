using System.Net.Http.Json;
using System.Text.Json;
using FormUp.Application.Domain.Interfaces;
using FormUp.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FormUp.Application.Infrastructure.Services;

/// <summary>
/// Sends push notifications via the Expo Push API.
/// </summary>
public class ExpoPushNotificationService(
    IHttpClientFactory httpClientFactory,
    IApplicationDbContext db,
    ILogger<ExpoPushNotificationService> logger) : IPushNotificationService
{
    private const string ExpoPushUrl = "https://exp.host/--/api/v2/push/send";
    private const string DeviceNotRegisteredError = "DeviceNotRegistered";

    public async Task SendAsync(Guid userId, string title, string body, object? data = null, CancellationToken ct = default)
    {
        var tokens = await db.DevicePushTokens
            .AsNoTracking()
            .Where(t => t.UserId == userId)
            .Select(t => t.Token)
            .ToListAsync(ct);

        if (tokens.Count == 0) return;

        var client = httpClientFactory.CreateClient();

        var messages = tokens.Select(token => new
        {
            to = token,
            title,
            body,
            sound = "default",
            data = data ?? new { }
        }).ToList();

        try
        {
            var response = await client.PostAsJsonAsync(ExpoPushUrl, messages, ct);
            var responseBody = await response.Content.ReadAsStringAsync(ct);

            if (!response.IsSuccessStatusCode)
            {
                // The raw body is never logged: Expo error messages can echo the push token.
                logger.LogWarning(
                    "Expo push failed ({Status}) for user {UserId}, error codes: {ErrorCodes}",
                    response.StatusCode, userId, string.Join(",", ReadRequestErrorCodes(responseBody)));
                return;
            }

            var staleTokens = FindUnregisteredTokens(tokens, responseBody);

            if (staleTokens.Count > 0)
            {
                await PruneTokensAsync(userId, staleTokens, ct);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to send Expo push notification to user {UserId}", userId);
        }
    }

    /// <summary>
    /// Returns the tokens whose ticket reports <c>details.error == DeviceNotRegistered</c>. Expo returns
    /// <c>data</c> tickets in the order the messages were sent (one object for a single message).
    /// </summary>
    private static List<string> FindUnregisteredTokens(IReadOnlyList<string> tokens, string responseBody)
    {
        var stale = new List<string>();

        using var document = JsonDocument.Parse(responseBody);

        if (document.RootElement.ValueKind != JsonValueKind.Object
            || !document.RootElement.TryGetProperty("data", out var data))
        {
            return stale;
        }

        var tickets = data.ValueKind == JsonValueKind.Array
            ? data.EnumerateArray().ToList()
            : [data];

        for (var i = 0; i < tickets.Count && i < tokens.Count; i++)
        {
            var ticket = tickets[i];

            if (ticket.ValueKind == JsonValueKind.Object
                && ticket.TryGetProperty("details", out var details)
                && details.ValueKind == JsonValueKind.Object
                && details.TryGetProperty("error", out var error)
                && error.ValueKind == JsonValueKind.String
                && error.GetString() == DeviceNotRegisteredError)
            {
                stale.Add(tokens[i]);
            }
        }

        return stale;
    }

    private static List<string> ReadRequestErrorCodes(string responseBody)
    {
        var codes = new List<string>();

        try
        {
            using var document = JsonDocument.Parse(responseBody);

            if (document.RootElement.ValueKind == JsonValueKind.Object
                && document.RootElement.TryGetProperty("errors", out var errors)
                && errors.ValueKind == JsonValueKind.Array)
            {
                foreach (var error in errors.EnumerateArray())
                {
                    if (error.ValueKind == JsonValueKind.Object
                        && error.TryGetProperty("code", out var code)
                        && code.ValueKind == JsonValueKind.String)
                    {
                        codes.Add(code.GetString()!);
                    }
                }
            }
        }
        catch (JsonException)
        {
            // A non-JSON error body has no codes to report.
        }

        return codes;
    }

    private async Task PruneTokensAsync(Guid userId, List<string> staleTokens, CancellationToken ct)
    {
        var rows = await db.DevicePushTokens
            .Where(t => staleTokens.Contains(t.Token))
            .ToListAsync(ct);

        db.DevicePushTokens.RemoveRange(rows);
        await db.SaveChangesAsync(ct);

        logger.LogInformation(
            "Pruned {Count} push token(s) reported as {Error} for user {UserId}",
            rows.Count, DeviceNotRegisteredError, userId);
    }
}
