using System.Text.Json.Serialization;

namespace FitnessPlatform.Application.Features.SubscriptionPlans.Shared;

/// <summary>
/// Wraps a value so JSON binding can distinguish "the request body omitted this field"
/// (<see cref="IsSet"/> is <c>false</c>) from "the field was explicitly present, including
/// an explicit <c>null</c>" (<see cref="IsSet"/> is <c>true</c>). System.Text.Json only
/// invokes a property's converter when the payload actually contains that key, so
/// <see cref="OptionalFieldConverter{T}"/> (see <c>OptionalFieldConverter.cs</c>) never runs
/// for a genuinely-omitted field, leaving <see cref="IsSet"/> at its default (<c>false</c>).
/// </summary>
/// <remarks>
/// Used on <c>UpdateSubscriptionPlanRequest.MaxActiveClients</c> so a PUT that omits the
/// field 400s (missing intent), while an explicit <c>null</c> still means "unlimited" per
/// <see cref="Domain.Entities.SubscriptionPlan.MaxActiveClients"/> and
/// <see cref="Domain.Services.EntitlementService"/>.
/// </remarks>
[JsonConverter(typeof(OptionalFieldConverterFactory))]
public readonly struct OptionalField<T>
{
    /// <summary>Whether the field was present in the request body (even if its value was null).</summary>
    public bool IsSet { get; }

    /// <summary>The bound value. Meaningless when <see cref="IsSet"/> is <c>false</c>.</summary>
    public T? Value { get; }

    /// <summary>Constructs a set field with the given value.</summary>
    public OptionalField(T? value)
    {
        IsSet = true;
        Value = value;
    }
}
