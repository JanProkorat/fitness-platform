namespace FitnessPlatform.Application.Features.Client.GetClientAppConfig;

/// <summary>
/// Server-controlled switches the client mobile app reads at start-up.
/// </summary>
public class GetClientAppConfigResponse
{
    /// <summary>Whether the iOS app shows the payments UI.</summary>
    public bool ShowPaymentsOnIos { get; set; }

    /// <summary>Whether the Android app shows the payments UI.</summary>
    public bool ShowPaymentsOnAndroid { get; set; }
}
