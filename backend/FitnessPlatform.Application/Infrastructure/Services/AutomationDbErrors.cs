using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Classifies database errors the automation worker expects and recovers from.
/// </summary>
internal static class AutomationDbErrors
{
    /// <summary>Whether the save failed on a unique index, the signal that another worker got there first.</summary>
    public static bool IsUniqueViolation(DbUpdateException exception) =>
        exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };
}
