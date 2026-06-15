namespace FitnessPlatform.Application.Features.Trainers.ClientNotes.CreateNote;

public class CreateNoteRequest
{
    public Guid ClientId { get; set; }
    public string Text { get; set; } = string.Empty;
}
