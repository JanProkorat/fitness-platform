namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Flags a client can select when responding to a weekly check-in reminder,
/// indicating events or circumstances that may affect the upcoming week's plan.
/// </summary>
public enum CheckInFlag
{
    /// <summary>Client will be traveling during the upcoming week.</summary>
    Traveling,

    /// <summary>Client has a notable event or celebration during the upcoming week.</summary>
    EventOrCelebration,

    /// <summary>Client is feeling sick or has low energy.</summary>
    SickOrLowEnergy,

    /// <summary>Client is dealing with an injury or pain.</summary>
    InjuryOrPain,

    /// <summary>Client has more time than usual available for training or nutrition adherence.</summary>
    MoreTimeAvailable,

    /// <summary>Client has less time than usual available.</summary>
    LessTimeAvailable
}
