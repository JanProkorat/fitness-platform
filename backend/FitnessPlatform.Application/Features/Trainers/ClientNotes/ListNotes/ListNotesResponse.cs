namespace FitnessPlatform.Application.Features.Trainers.ClientNotes.ListNotes;

public class ListNotesResponse
{
    public List<NoteDto> Notes { get; set; } = [];
}

public class NoteDto
{
    public Guid NoteId { get; set; }
    public string Text { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
