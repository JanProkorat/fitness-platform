using System.Security.Claims;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Middleware;

/// <summary>
/// Opportunistically captures the caller's UI locale from the <c>Accept-Language</c>
/// header on authenticated requests and persists it to <see cref="Domain.Entities.ApplicationUser.Language"/>
/// so notification content can be localized for the recipient later, independent of
/// whoever is making the triggering request (#788).
///
/// Both the web portal (<c>web/src/lib/api.ts</c>) and the mobile app
/// (<c>mobile/src/api/client.ts</c>) already send <c>Accept-Language</c> set to the
/// current UI locale on every authenticated request — this middleware is the only
/// place that durably records it.
///
/// Read-then-write-if-changed: we do NOT write on every request. A DB write only
/// happens when the normalized header value differs from the currently stored
/// <c>Language</c>, keeping the common case (unchanged locale) to a single read.
/// </summary>
/// <param name="next">The next middleware in the pipeline.</param>
/// <param name="logger">Logger for the best-effort locale-capture block.</param>
public class LocaleCaptureMiddleware(RequestDelegate next, ILogger<LocaleCaptureMiddleware> logger)
{
    private static readonly HashSet<string> SupportedLanguages = ["cs", "en", "de"];

    /// <summary>
    /// Invokes the middleware. <paramref name="db"/> is resolved per-request from the
    /// scoped container (conventional ASP.NET Core middleware is instantiated once as a
    /// singleton, so scoped dependencies must come in via method injection here rather
    /// than the constructor).
    /// </summary>
    public async Task InvokeAsync(HttpContext context, IApplicationDbContext db)
    {
        var language = TryNormalize(context.Request.Headers.AcceptLanguage.FirstOrDefault());

        if (language is not null && context.User.Identity?.IsAuthenticated == true)
        {
            var userIdClaim = context.User.FindFirstValue(AppClaims.UserId);
            if (userIdClaim is not null && Guid.TryParse(userIdClaim, out var userId))
            {
                // Best-effort only — a transient DB failure (deadlock/timeout/connection
                // blip) capturing this nice-to-have locale must never fault a request
                // that would otherwise have succeeded (pass-1 review finding, #788).
                try
                {
                    var currentLanguage = await db.Users
                        .AsNoTracking()
                        .Where(u => u.Id == userId)
                        .Select(u => u.Language)
                        .FirstOrDefaultAsync(context.RequestAborted);

                    if (currentLanguage != language)
                    {
                        await db.Users
                            .Where(u => u.Id == userId)
                            .ExecuteUpdateAsync(
                                s => s.SetProperty(u => u.Language, language),
                                context.RequestAborted);
                    }
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    logger.LogWarning(ex,
                        "LocaleCaptureMiddleware: failed to capture/update locale for user {UserId}; " +
                        "continuing the request unaffected.", userId);
                }
            }
        }

        await next(context);
    }

    /// <summary>
    /// Parses the primary subtag off an <c>Accept-Language</c> header value (e.g.
    /// "cs-CZ,cs;q=0.9,en;q=0.8" → "cs") and validates it against the three supported
    /// locales. Returns null for missing/unsupported headers so the caller leaves the
    /// stored value untouched rather than overwriting it with a guess.
    /// </summary>
    private static string? TryNormalize(string? acceptLanguageHeader)
    {
        var primarySubtag = acceptLanguageHeader
            ?.Split(',').FirstOrDefault()
            ?.Split(';').FirstOrDefault()
            ?.Split('-').FirstOrDefault()
            ?.Trim().ToLowerInvariant();

        return primarySubtag is not null && SupportedLanguages.Contains(primarySubtag)
            ? primarySubtag
            : null;
    }
}
