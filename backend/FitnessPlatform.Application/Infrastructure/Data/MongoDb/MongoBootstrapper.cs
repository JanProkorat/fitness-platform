using System.Runtime.CompilerServices;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Bson.Serialization.Serializers;

namespace FitnessPlatform.Application.Infrastructure.Data.MongoDb;

/// <summary>
/// Registers the Standard <see cref="GuidSerializer"/> via a module
/// initializer so it lands before any other code in this assembly touches
/// <see cref="BsonSerializer"/>. MongoDB.Driver 3.x will otherwise silently
/// auto-register a default (Unspecified) Guid serializer on first lookup
/// — and once that's in place, a later RegisterSerializer call throws.
/// On Linux test hosts the load order made this happen before Program.cs
/// could register Standard, breaking every Guid write.
/// </summary>
internal static class MongoBootstrapper
{
    [ModuleInitializer]
    internal static void RegisterStandardGuidSerializer()
    {
        try
        {
            BsonSerializer.RegisterSerializer(new GuidSerializer(GuidRepresentation.Standard));
        }
        catch (BsonSerializationException)
        {
            // Driver beat us to it — nothing to do.
        }
    }
}
