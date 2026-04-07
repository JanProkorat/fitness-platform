namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Type of notification sent to a user.
/// </summary>
public enum NotificationType
{
    /// <summary>Client achieved a personal record.</summary>
    PersonalRecord,

    /// <summary>A new training plan was published.</summary>
    PlanPublished,

    /// <summary>General system notification.</summary>
    General,

    /// <summary>A client submitted a questionnaire response.</summary>
    QuestionnaireSubmitted,

    /// <summary>A client request was received by a professional.</summary>
    ClientRequestReceived,

    /// <summary>A client request was accepted by a professional.</summary>
    ClientRequestAccepted,

    /// <summary>A client request was rejected by a professional.</summary>
    ClientRequestRejected,

    /// <summary>A questionnaire was assigned to a client.</summary>
    QuestionnaireAssigned,

    /// <summary>A professional sent an invitation to a client.</summary>
    InvitationReceived,

    /// <summary>A client's invite was accepted by a professional.</summary>
    InvitationAccepted,

    /// <summary>A client's invite was declined by a professional.</summary>
    InvitationDeclined,

    /// <summary>A pending invite was auto-cancelled because another professional of the same role was accepted.</summary>
    InvitationCancelled
}
