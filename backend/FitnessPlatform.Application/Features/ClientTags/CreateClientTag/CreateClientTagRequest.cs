namespace FitnessPlatform.Application.Features.ClientTags.CreateClientTag;

public class CreateClientTagRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string ColorHex { get; set; } = string.Empty;
}
