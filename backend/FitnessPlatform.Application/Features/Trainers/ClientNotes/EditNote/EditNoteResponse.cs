namespace FitnessPlatform.Application.Features.Trainers.ClientNotes.EditNote;

public class EditNoteResponse
{
    public Guid NoteId { get; set; }
    public string Text { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; }
}
