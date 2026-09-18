namespace FitnessPlatform.Application.Features.ClientTags.UpdateClientTag;

public class UpdateClientTagRequest
{
    public Guid TagId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string ColorHex { get; set; } = string.Empty;
}
