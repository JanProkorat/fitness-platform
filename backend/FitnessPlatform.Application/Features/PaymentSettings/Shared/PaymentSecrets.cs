using System.Security.Cryptography;
using System.Text;

namespace FitnessPlatform.Application.Features.PaymentSettings.Shared;

/// <summary>
/// Hashing for the secrets the bank account flow stores: undo tokens and emailed codes.
/// </summary>
internal static class PaymentSecrets
{
    /// <summary>
    /// SHA-256 hex hash of an undo token.
    /// </summary>
    /// <param name="token">The raw token from the emailed link.</param>
    public static string HashToken(string token) => Hash(token);

    /// <summary>
    /// SHA-256 hex hash of an emailed code, salted with the user id so equal codes of two users differ.
    /// </summary>
    /// <param name="userId">The user the code belongs to.</param>
    /// <param name="code">The raw code.</param>
    public static string HashCode(Guid userId, string code) => Hash($"{userId:N}:{code}");

    private static string Hash(string value) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
}
