using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using Microsoft.Extensions.Options;

namespace FitnessPlatform.Application.Features.Client.GetClientAppConfig;

/// <summary>
/// Returns the server-side switches the client mobile app reads at start-up, such as whether to show payments.
/// </summary>
/// <param name="options">Live client app options.</param>
internal sealed class GetClientAppConfigEndpoint(IOptionsMonitor<ClientAppOptions> options)
    : EndpointWithoutRequest<GetClientAppConfigResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/client/app-config");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get the client app configuration";
            s.Description = "Returns the server-side switches for the client mobile app, one flag per platform. The response is not cacheable so a change applies on the next app launch.";
            s.Responses[StatusCodes.Status200OK] = "The client app switches";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        HttpContext.Response.Headers.CacheControl = "no-store";

        await Send.OkAsync(new GetClientAppConfigResponse
        {
            ShowPaymentsOnIos = options.CurrentValue.ShowPaymentsOnIos,
            ShowPaymentsOnAndroid = options.CurrentValue.ShowPaymentsOnAndroid,
        }, ct);
    }
}
