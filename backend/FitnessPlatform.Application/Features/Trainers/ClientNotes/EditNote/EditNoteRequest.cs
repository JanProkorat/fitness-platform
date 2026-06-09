namespace FitnessPlatform.Application.Features.Trainers.ClientNotes.EditNote;

public class EditNoteRequest
{
    public Guid ClientId { get; set; }
    public Guid NoteId { get; set; }
    public string Text { get; set; } = string.Empty;
}
