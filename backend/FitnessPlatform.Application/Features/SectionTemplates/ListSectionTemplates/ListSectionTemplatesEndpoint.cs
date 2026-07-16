using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.SectionTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.SectionTemplates.ListSectionTemplates;

/// <summary>
/// Lists the calling trainer's section templates with pagination, plus the public
/// workout template library (unpaginated).
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class ListSectionTemplatesEndpoint(IMongoContext mongo)
    : Endpoint<ListSectionTemplatesRequest, ListSectionTemplatesResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/training/section-templates");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "List section templates";
            s.Description = "Returns the calling trainer's section templates (paginated) and the public workout template library (unpaginated).";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(ListSectionTemplatesRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);
        var filter = Builders<SectionTemplate>.Filter.Eq(t => t.OwnerTrainerId, trainerId);

        var total = await mongo.SectionTemplates.CountDocumentsAsync(filter, cancellationToken: ct);

        HttpContext.Response.Headers["X-Total-Count"] = total.ToString();

        var skip = (req.Page - 1) * req.PageSize;
        using var cursor = await mongo.SectionTemplates.FindAsync(
            filter,
            new FindOptions<SectionTemplate>
            {
                Sort = Builders<SectionTemplate>.Sort.Ascending(t => t.CreatedAt),
                Skip = skip,
                Limit = req.PageSize
            },
            ct);

        var templates = await cursor.ToListAsync(ct);

        var publicFilter = Builders<WorkoutTemplate>.Filter.Eq(t => t.Visibility, WorkoutTemplateVisibility.Public);
        using var publicCursor = await mongo.WorkoutTemplates.FindAsync(publicFilter, cancellationToken: ct);
        var publicTemplates = await publicCursor.ToListAsync(ct);

        var response = new ListSectionTemplatesResponse
        {
            OwnTemplates = templates.Select(SectionTemplateResponse.FromDocument).ToList(),
            PublicWorkoutTemplates = publicTemplates.Select(PublicWorkoutTemplateResponse.FromDocument).ToList()
        };

        await Send.OkAsync(response, ct);
    }
}
