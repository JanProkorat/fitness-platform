using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Features.SectionTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.SectionTemplates.ListSectionTemplates;

/// <summary>
/// Lists the calling trainer's section templates with pagination.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class ListSectionTemplatesEndpoint(IMongoContext mongo)
    : Endpoint<ListSectionTemplatesRequest, List<SectionTemplateResponse>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/training/section-templates");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "List section templates";
            s.Description = "Returns the calling trainer's section templates, paginated.";
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
        await Send.OkAsync(templates.Select(SectionTemplateResponse.FromDocument).ToList(), ct);
    }
}
