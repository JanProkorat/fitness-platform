using FastEndpoints;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Auth.Logout;

/// <summary>
/// Endpoint for logging out by revoking a refresh token.
/// </summary>
/// <param name="db">Database context.</param>
public class LogoutEndpoint(IApplicationDbContext db) : Endpoint<LogoutRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/auth/logout");
        Summary(s =>
        {
            s.Summary = "Logout user";
            s.Description = "Revokes the specified refresh token, effectively logging the user out.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(LogoutRequest req, CancellationToken ct)
    {
        var token = await db.RefreshTokens
            .FirstOrDefaultAsync(rt => rt.Token == req.RefreshToken, ct);

        if (token is not null && token.IsActive)
        {
            token.RevokedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
        }

        await Send.NoContentAsync(ct);
    }
}
