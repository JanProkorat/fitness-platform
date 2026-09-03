using System.Text.Json;
using System.Text.Json.Serialization;

namespace FitnessPlatform.Application.Features.SubscriptionPlans.Shared;

/// <summary>
/// Resolves the correct closed <see cref="OptionalFieldConverter{T}"/> for any
/// <see cref="OptionalField{T}"/> property System.Text.Json encounters. Paired
/// implementation detail for <see cref="OptionalField{T}"/> — see <c>OptionalField.cs</c>.
/// </summary>
internal sealed class OptionalFieldConverterFactory : JsonConverterFactory
{
    /// <inheritdoc />
    public override bool CanConvert(Type typeToConvert) =>
        typeToConvert.IsGenericType && typeToConvert.GetGenericTypeDefinition() == typeof(OptionalField<>);

    /// <inheritdoc />
    public override JsonConverter CreateConverter(Type typeToConvert, JsonSerializerOptions options)
    {
        var innerType = typeToConvert.GetGenericArguments()[0];
        var converterType = typeof(OptionalFieldConverter<>).MakeGenericType(innerType);
        return (JsonConverter)Activator.CreateInstance(converterType)!;
    }
}

/// <summary>
/// Reads/writes an <see cref="OptionalField{T}"/> as a plain <typeparamref name="T"/> on the
/// wire — the "was it present" signal comes from whether this converter ran at all, not from
/// anything in the serialized shape.
/// </summary>
internal sealed class OptionalFieldConverter<T> : JsonConverter<OptionalField<T>>
{
    /// <inheritdoc />
    public override OptionalField<T> Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        => new(JsonSerializer.Deserialize<T>(ref reader, options));

    /// <inheritdoc />
    public override void Write(Utf8JsonWriter writer, OptionalField<T> value, JsonSerializerOptions options)
        => JsonSerializer.Serialize(writer, value.Value, options);
}
