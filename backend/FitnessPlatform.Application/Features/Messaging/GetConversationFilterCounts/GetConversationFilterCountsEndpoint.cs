using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.Messaging.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Messaging.GetConversationFilterCounts;

/// <summary>
/// Returns the inbox filter dropdown's six chip counts for the authenticated professional.
/// </summary>
/// <remarks>
/// Computed over the same live-roster population and the same
/// <see cref="ClientRosterFilterClassifier"/> facts <c>GetConversationsEndpoint</c>'s
/// <c>filter</c> param uses (<see cref="ConversationRosterLoader"/>) — a chip's count and its
/// membership can never disagree. Trainer/Nutritionist only; a Client caller has no roster to
/// classify.
/// </remarks>
/// <param name="db">Database context.</param>
/// <param name="mongo">MongoDB context — plan-window lookups for the EndingSoon chip.</param>
/// <param name="timeProvider">Clock abstraction — lets tests pin "now" deterministically.</param>
public class GetConversationFilterCountsEndpoint(
    IApplicationDbContext db,
    IMongoContext mongo,
    TimeProvider timeProvider) : EndpointWithoutRequest<GetConversationFilterCountsResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/conversations/filter-counts");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Get conversation filter chip counts";
            s.Description = "Returns the six inbox filter chip counts over the caller's live " +
                             "client roster (live links only, archived links excluded). " +
                             "Independent of the archived display toggle.";
            s.Responses[StatusCodes.Status200OK] = "The six chip counts.";
            s.Responses[StatusCodes.Status401Unauthorized] = "No caller claim on the request.";
            s.Responses[StatusCodes.Status404NotFound] = "Caller has no ProfessionalProfile.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var userGuid = Guid.Parse(userId);

        var professionalProfile = await db.ProfessionalProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(pp => pp.UserId == userGuid, ct);

        if (professionalProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var now = timeProvider.GetUtcNow().UtcDateTime;
        var roster = await ConversationRosterLoader.LoadAsync(db, mongo, professionalProfile.Id, userGuid, now, ct);

        var counts = ClientRosterFilterClassifier.ComputeCounts(
            roster,
            r => r.UnreadMessageCount > 0,
            r => r.ConversationMessageCount == 0,
            r => r.HasNewCheckIn,
            r => r.HasMissingCheckIn,
            r => r.IsEndingSoon);

        await Send.OkAsync(new GetConversationFilterCountsResponse
        {
            All = counts.All,
            UnreadMessages = counts.UnreadMessages,
            NoMessages = counts.NoMessages,
            NewCheckIns = counts.NewCheckIns,
            MissingCheckIns = counts.MissingCheckIns,
            EndingSoon = counts.EndingSoon,
        }, ct);
    }
}
