using System.Security.Claims;
using System.Text.RegularExpressions;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Messaging.Broadcast;

/// <summary>
/// Broadcasts the same text message to several of the caller's clients at once, reusing the
/// existing conversation and SignalR machinery a single chat message already takes rather than
/// introducing a new messaging path.
/// </summary>
/// <param name="db">Relational database context — resolves recipient ids and names.</param>
/// <param name="linkAuthorizationService">Resolves the caller's active client links.</param>
/// <param name="conversationSeedService">
/// Shared get-or-create-conversation + append-message + broadcast "newmessage" seam.
/// </param>
public class BroadcastMessageEndpoint(
    IApplicationDbContext db,
    IClientLinkAuthorizationService linkAuthorizationService,
    IConversationSeedService conversationSeedService)
    : Endpoint<BroadcastMessageRequest, BroadcastMessageResponse>
{
    private static readonly Regex TemplatePlaceholderPattern =
        new("\\{\\{(firstName|fullName)\\}\\}", RegexOptions.Compiled);

    /// <inheritdoc />
    public override void Configure()
    {
        Post("/trainer/broadcast");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Broadcast a message to several clients";
            s.Description = "Sends the same text message to several of the caller's clients at " +
                             "once, substituting {{firstName}}/{{fullName}} per recipient. No push " +
                             "notification is sent.";
            s.Responses[StatusCodes.Status200OK] = "Message sent; SentCount is the distinct recipient count.";
            s.Responses[StatusCodes.Status400BadRequest] = "Empty/too-long text, or more than 50 recipients.";
            s.Responses[StatusCodes.Status404NotFound] = "One or more recipients are not a live client of the caller.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(BroadcastMessageRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var professionalUserId = Guid.Parse(userId);
        var distinctClientPublicIds = req.ClientPublicIds.Distinct().ToList();

        var clientProfiles = await db.ClientProfiles
            .AsNoTracking()
            .Where(clientProfile => distinctClientPublicIds.Contains(clientProfile.PublicId))
            .Select(clientProfile => new { clientProfile.PublicId, clientProfile.UserId })
            .ToListAsync(ct);

        if (clientProfiles.Count != distinctClientPublicIds.Count)
        {
            await this.SendProblemAsync(
                404, ErrorCodes.BroadcastRecipientNotLinked, "One or more recipients could not be found.", ct);
            return;
        }

        // Deliberately NOT checking LinkCapabilities.CanView* here — a chat message is not plan
        // data, and a link granting neither plan domain can still be messaged one-by-one today.
        var accessibleClientUserIds = (await linkAuthorizationService.GetAccessibleClientsAsync(professionalUserId, ct))
            .Select(client => client.ClientUserId)
            .ToHashSet();

        if (clientProfiles.Any(clientProfile => !accessibleClientUserIds.Contains(clientProfile.UserId)))
        {
            await this.SendProblemAsync(
                404,
                ErrorCodes.BroadcastRecipientNotLinked,
                "One or more recipients are not a live client of the caller.",
                ct);
            return;
        }

        var recipientUserIds = clientProfiles.Select(clientProfile => clientProfile.UserId).ToList();

        var professional = await db.Users.AsNoTracking()
            .Where(user => user.Id == professionalUserId)
            .Select(user => new { user.FirstName, user.LastName })
            .FirstAsync(ct);

        var senderName = FormatFullName(professional.FirstName, professional.LastName);

        var recipients = await db.Users.AsNoTracking()
            .Where(user => recipientUserIds.Contains(user.Id))
            .Select(user => new { user.Id, user.FirstName, user.LastName })
            .ToListAsync(ct);

        // No transaction, no per-recipient result list: every id above was authorized before the
        // first write, so a failure partway through this loop is infrastructure, not a bad
        // request. Earlier recipients keep their message and the caller gets a 500; a client
        // retry re-sends to those recipients again (no idempotency key by design).
        foreach (var recipient in recipients)
        {
            var personalizedText = SubstituteTemplate(
                req.Text.Trim(), recipient.FirstName, FormatFullName(recipient.FirstName, recipient.LastName));

            await conversationSeedService.GetOrSeedConversationAsync(
                professionalUserId,
                recipient.Id,
                professionalUserId,
                senderName,
                personalizedText,
                seedIntoExisting: true,
                ct);
        }

        await Send.OkAsync(new BroadcastMessageResponse { SentCount = recipients.Count }, ct);
    }

    private static string FormatFullName(string firstName, string lastName) =>
        string.Join(" ", new[] { firstName, lastName }.Where(part => !string.IsNullOrWhiteSpace(part)));

    private static string SubstituteTemplate(string text, string firstName, string fullName) =>
        TemplatePlaceholderPattern.Replace(text, match => match.Groups[1].Value switch
        {
            "firstName" => firstName,
            "fullName" => fullName,
            _ => match.Value,
        });
}
