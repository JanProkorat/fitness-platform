using System.Security.Cryptography;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Issues and sends email-verification tokens. Shared by <c>RegisterEndpoint</c>,
/// <c>ResendVerificationEndpoint</c>, and <c>AnonymousResendVerificationEndpoint</c>
/// (#679) so the invalidate → mint → persist → increment → send path is not
/// duplicated across call sites.
/// </summary>
/// <param name="db">Database context.</param>
/// <param name="emailService">Email sending service.</param>
public class EmailVerificationTokenService(IApplicationDbContext db, IEmailService emailService) : IEmailVerificationTokenService
{
    /// <inheritdoc />
    public async Task IssueAndSendAsync(ApplicationUser user, string language, CancellationToken ct, bool countTowardLifetimeCap = true)
    {
        // Invalidate previous unused tokens
        var previousTokens = await db.EmailVerificationTokens
            .Where(t => t.UserId == user.Id && t.UsedAt == null)
            .ToListAsync(ct);

        foreach (var t in previousTokens)
        {
            t.UsedAt = DateTime.UtcNow;
        }

        // Create new token
        var tokenValue = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var verificationToken = new EmailVerificationToken
        {
            UserId = user.Id,
            Token = tokenValue,
            ExpiresAt = DateTime.UtcNow.AddHours(24)
        };

        db.EmailVerificationTokens.Add(verificationToken);

        // Only advance the lifetime cap for the registration + authenticated-resend call
        // sites. The anonymous resend endpoint (#679 security follow-up) passes
        // countTowardLifetimeCap: false — see the interface doc comment for why: letting
        // anonymous sends climb this counter would let anyone lock a victim out of the
        // authenticated resend path permanently.
        if (countTowardLifetimeCap)
        {
            user.VerificationEmailsSent++;
        }

        await db.SaveChangesAsync(ct);

        // Send AFTER the DB write commits: the token row (and the incremented counter)
        // must exist even if the send itself fails, so a caller can catch a send
        // failure without leaving the token store inconsistent.
        await emailService.SendEmailVerificationAsync(user.Email!, tokenValue, language, ct);
    }
}
