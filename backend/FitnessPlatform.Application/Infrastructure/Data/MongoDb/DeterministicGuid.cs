using System.Security.Cryptography;
using System.Text;

namespace FitnessPlatform.Application.Infrastructure.Data.MongoDb;

/// <summary>
/// Produces stable, name-based (UUIDv3-style — RFC 4122 §4.3, MD5, version 3) GUIDs for seeded
/// catalog documents. Deterministic across runs and machines — this is what lets the seeder be
/// idempotent (re-running <c>--seed</c> never creates duplicates) and lets cross-referencing seed
/// data (recipe → food, workout template → exercise) resolve without a database round trip
/// <b>on a fresh database</b>. On a DB that already has a same-named legacy document (predating
/// this scheme, with a random <c>ExternalId</c>), <see cref="MongoSeeder"/> resolves references
/// against the actual persisted <c>ExternalId</c> instead of this value — see
/// <c>MongoSeeder.BuildNameToExternalIdMapAsync</c>.
/// </summary>
/// <remarks>
/// Callers pass a namespaced name such as <c>"food:chicken-breast-raw"</c> or
/// <c>"exercise:barbell-bench-press"</c> — the collection-type prefix keeps the same slug from
/// colliding across collections (e.g. a food and an exercise that happen to share a slug).
/// </remarks>
public static class DeterministicGuid
{
    // Fixed, randomly generated namespace GUID for this application's seed data.
    // Never change this value — doing so would silently re-derive every seeded ExternalId,
    // breaking idempotency and orphaning existing cross-references on any already-seeded DB.
    private static readonly Guid Namespace = new("6f2c9a3e-6c4e-4a8b-8f1a-6a9f0f2c9a3e");

    /// <summary>
    /// Derives a stable GUID from the given name, scoped to this application's fixed namespace.
    /// </summary>
    /// <param name="name">A namespaced identifier, e.g. <c>"recipe:avokado-talir"</c>.</param>
    public static Guid Create(string name)
    {
        var namespaceBytes = Namespace.ToByteArray();
        SwapByteOrder(namespaceBytes);

        var nameBytes = Encoding.UTF8.GetBytes(name);
        var combined = new byte[namespaceBytes.Length + nameBytes.Length];
        Buffer.BlockCopy(namespaceBytes, 0, combined, 0, namespaceBytes.Length);
        Buffer.BlockCopy(nameBytes, 0, combined, namespaceBytes.Length, nameBytes.Length);

        var hash = MD5.HashData(combined);

        // Set version (3 = name-based, MD5) and variant bits per RFC 4122.
        hash[6] = (byte)((hash[6] & 0x0F) | (3 << 4));
        hash[8] = (byte)((hash[8] & 0x3F) | 0x80);

        var newGuidBytes = new byte[16];
        Array.Copy(hash, newGuidBytes, 16);
        SwapByteOrder(newGuidBytes);

        return new Guid(newGuidBytes);
    }

    /// <summary>
    /// GUIDs store the first three fields in machine (little-endian) byte order while RFC 4122
    /// expects network (big-endian) order — swap so the hash matches other UUIDv3 implementations.
    /// </summary>
    private static void SwapByteOrder(byte[] guid)
    {
        SwapBytes(guid, 0, 3);
        SwapBytes(guid, 1, 2);
        SwapBytes(guid, 4, 5);
        SwapBytes(guid, 6, 7);
    }

    private static void SwapBytes(byte[] guid, int left, int right) =>
        (guid[left], guid[right]) = (guid[right], guid[left]);
}
