namespace FitnessPlatform.Application.Features.Client.GetClientAppConfig;

/// <summary>
/// Server-side switches for the client mobile app, bound from the optional <c>ClientApp</c> configuration section
/// (env var form: <c>ClientApp__ShowPaymentsOnIos=false</c>). Both flags default to shown.
/// </summary>
public class ClientAppOptions
{
    /// <summary>Configuration section key.</summary>
    public const string SectionName = "ClientApp";

    /// <summary>Whether the iOS client app shows the payments UI.</summary>
    public bool ShowPaymentsOnIos { get; set; } = true;

    /// <summary>Whether the Android client app shows the payments UI.</summary>
    public bool ShowPaymentsOnAndroid { get; set; } = true;
}
