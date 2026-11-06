namespace FormUp.Application.Features.Client.PushToken.RemovePushTokenAnonymous;

/// <summary>
/// Request for removing a push token by value.
/// </summary>
public class RemovePushTokenAnonymousRequest
{
    /// <summary>The Expo push token to remove, sent in the JSON body.</summary>
    public string Token { get; set; } = string.Empty;
}
