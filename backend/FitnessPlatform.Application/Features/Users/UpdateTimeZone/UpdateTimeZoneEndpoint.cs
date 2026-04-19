using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Extensions;
using Microsoft.AspNetCore.Identity;

namespace FitnessPlatform.Application.Features.Users.UpdateTimeZone;

/// <summary>
/// Endpoint for updating the authenticated user's IANA time zone.
/// </summary>
/// <param name="userManager">ASP.NET Identity user manager.</param>
public class UpdateTimeZoneEndpoint(UserManager<ApplicationUser> userManager)
    : Endpoint<UpdateTimeZoneRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("/users/me/timezone");
        Summary(s =>
        {
            s.Summary = "Update current user time zone";
            s.Description = "Updates the IANA time zone for the currently authenticated user.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateTimeZoneRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        // Validate the IANA time zone identifier cross-platform (.NET 10 with ICU).
        if (!IsValidIanaTimeZone(req.TimeZone))
        {
            this.ThrowErrorWithCode(ErrorCodes.InvalidTimeZone, $"'{req.TimeZone}' is not a valid IANA time zone identifier.");
        }

        var user = await userManager.FindByIdAsync(userId);

        if (user is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        user.TimeZone = req.TimeZone;
        user.DateUpdated = DateTime.UtcNow;

        await userManager.UpdateAsync(user);

        await Send.OkAsync(new { TimeZone = user.TimeZone }, ct);
    }

    private static bool IsValidIanaTimeZone(string timeZoneId)
    {
        try
        {
            TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
            return true;
        }
        catch (TimeZoneNotFoundException)
        {
            return false;
        }
        catch (InvalidTimeZoneException)
        {
            return false;
        }
    }
}
