namespace FitnessPlatform.Application.Domain.Common;

/// <summary>
/// Interface for entities that are identified outside the application via a public GUID.
/// </summary>
public interface IPublicEntity
{
    /// <summary>
    /// Public-facing unique identifier used in APIs and external communication.
    /// </summary>
    Guid PublicId { get; set; }
}
