namespace FitnessPlatform.Application.Features.ClientTags.DeleteClientTag;

/// <summary>
/// Request for deleting a client tag. Bodyless — <c>TagId</c> is bound from the route.
/// </summary>
public class DeleteClientTagRequest
{
    /// <summary>
    /// Public identifier of the tag to delete, from the route.
    /// </summary>
    public Guid TagId { get; set; }
}
