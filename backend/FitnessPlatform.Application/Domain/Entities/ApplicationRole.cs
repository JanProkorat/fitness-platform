using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Identity;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// Application role extending ASP.NET Identity with an optional description.
/// </summary>
public class ApplicationRole : IdentityRole<Guid>
{
    /// <summary>
    /// Human-readable description of the role's purpose.
    /// </summary>
    [MaxLength(200)]
    public string? Description { get; set; }
}
