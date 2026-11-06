namespace FormUp.Application.Features.Trainers.PendingInvites.CheckSlot;

/// <summary>
/// Which of the caller's professions already have another professional on the invitee.
/// </summary>
public class CheckPendingInviteSlotResponse
{
    /// <summary>True when the caller holds the Nutritionist role and another professional occupies the invitee's nutrition slot.</summary>
    public bool NutritionTaken { get; set; }

    /// <summary>True when the caller holds the Trainer role and another professional occupies the invitee's training slot.</summary>
    public bool TrainingTaken { get; set; }
}
