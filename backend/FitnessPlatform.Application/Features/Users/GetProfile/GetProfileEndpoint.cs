using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Users.GetProfile;

/// <summary>
/// Endpoint for retrieving the authenticated user's profile.
/// </summary>
/// <param name="userManager">ASP.NET Identity user manager.</param>
/// <param name="dbContext">Application database context.</param>
public class GetProfileEndpoint(UserManager<ApplicationUser> userManager, IApplicationDbContext dbContext)
    : EndpointWithoutRequest<GetProfileResponse>
{

    /// <inheritdoc />
    public override void Configure()
    {
        Get("/users/me");
        Summary(s =>
        {
            s.Summary = "Get current user profile";
            s.Description = "Returns the profile of the currently authenticated user.";
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

        var user = await userManager.FindByIdAsync(userId);

        if (user is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var roles = await userManager.GetRolesAsync(user);

        bool? isOnboardingComplete = null;
        var hasActiveLink = false;
        var hasPendingQuestionnaire = false;
        var linkedRoles = new List<string>();

        if (roles.Contains("Client"))
        {
            var clientProfile = await dbContext.ClientProfiles
                .FirstOrDefaultAsync(cp => cp.UserId == user.Id, ct);
            isOnboardingComplete = clientProfile?.IsOnboardingComplete ?? false;

            if (clientProfile is not null)
            {
                // Derive roles from the CanView* flags, NOT the single ProfessionalRole
                // enum column (#771). A professional can hold BOTH Trainer and
                // Nutritionist identity roles simultaneously; the ClientProfessionalLink
                // row is one-per-(client, professional) (unique DB constraint), so
                // ProfessionalRole alone can only ever report one of the two roles even
                // when the professional is entitled to both. CanViewTrainingPlans /
                // CanViewNutritionPlans are independently granted per role held (see
                // AcceptClientInviteEndpoint / AcceptClientRequestEndpoint /
                // AcceptInvitationEndpoint / CreateCollaborationEndpoint), so they are the
                // correct source for "which tabs should this client unlock".
                var activeLinks = await dbContext.ClientProfessionalLinks
                    .Where(l => l.ClientProfileId == clientProfile.Id && l.IsActive)
                    .Select(l => new { l.CanViewTrainingPlans, l.CanViewNutritionPlans })
                    .ToListAsync(ct);

                hasActiveLink = activeLinks.Count > 0;

                var roleSet = new HashSet<string>();
                foreach (var link in activeLinks)
                {
                    if (link.CanViewTrainingPlans) roleSet.Add(UserRole.Trainer.ToString());
                    if (link.CanViewNutritionPlans) roleSet.Add(UserRole.Nutritionist.ToString());
                }

                linkedRoles = roleSet.ToList();
            }

            hasPendingQuestionnaire = await dbContext.QuestionnaireResponses
                .AnyAsync(r => r.ClientId == user.Id
                    && (r.Status == QuestionnaireResponseStatus.Pending || r.Status == QuestionnaireResponseStatus.InProgress), ct);
        }

        await Send.OkAsync(new GetProfileResponse
        {
            UserId = user.Id,
            Email = user.Email!,
            FirstName = user.FirstName,
            LastName = user.LastName,
            PhoneNumber = user.PhoneNumber,
            Roles = roles.ToList(),
            DateCreated = user.DateCreated,
            IsOnboardingComplete = isOnboardingComplete,
            EmailConfirmed = user.EmailConfirmed,
            HasActiveLink = hasActiveLink,
            HasPendingQuestionnaire = hasPendingQuestionnaire,
            LinkedRoles = linkedRoles,
            TimeZone = user.TimeZone,
            AvatarBlobUrl = user.AvatarBlobUrl
        }, ct);
    }
}
