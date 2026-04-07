using System.Net.Http.Json;
using System.Text.Json;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Sends push notifications via the Expo Push API.
/// </summary>
public class ExpoPushNotificationService(
    IHttpClientFactory httpClientFactory,
    IApplicationDbContext db,
    ILogger<ExpoPushNotificationService> logger) : IPushNotificationService
{
    private const string ExpoPushUrl = "https://exp.host/--/api/v2/push/send";

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

            if (!response.IsSuccessStatusCode)
            {
                var responseBody = await response.Content.ReadAsStringAsync(ct);
                logger.LogWarning("Expo push failed ({Status}): {Body}", response.StatusCode, responseBody);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to send Expo push notification to user {UserId}", userId);
        }
    }
}
