using FastEndpoints;

namespace FitnessPlatform.Application.Features.WeeklyCheckIns.GetOverrides;

/// <summary>
/// Request model for GET /trainer/weekly-check-ins/overrides.
/// No query parameters — returns all overrides for the authenticated trainer's clients.
/// </summary>
[HideFromDocs]
public class GetOverridesRequest { }
