namespace FitnessPlatform.Application.Features.Trainers.ClientNotes.ListNotes;

public class ListNotesRequest
{
    public Guid ClientId { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}
