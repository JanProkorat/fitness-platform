namespace FitnessPlatform.Application.Features.Trainers.ClientNotes.DeleteNote;

public class DeleteNoteRequest
{
    public Guid ClientId { get; set; }
    public Guid NoteId { get; set; }
}
