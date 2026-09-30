namespace FitnessPlatform.Application.Domain.Constants;

/// <summary>
/// Serving-size unit keys for a <c>Food</c>'s <c>CommonServings</c>. Seeded foods store one of
/// these keys as the serving <c>Label</c>, translated client-side; the value is always the
/// weight in grams of ONE unit (#1133).
/// </summary>
public static class ServingUnits
{
    /// <summary>A generic portion with no more specific unit (e.g. a plated dish, a shot).</summary>
    public const string Portion = "portion";

    /// <summary>A single countable item (e.g. one egg, one steak).</summary>
    public const string Piece = "piece";

    /// <summary>A slice (e.g. of bread, cheese, ham).</summary>
    public const string Slice = "slice";

    /// <summary>A standard cup measure.</summary>
    public const string Cup = "cup";

    /// <summary>A tablespoon.</summary>
    public const string Tbsp = "tbsp";

    /// <summary>A teaspoon.</summary>
    public const string Tsp = "tsp";

    /// <summary>A handful (e.g. of nuts, berries).</summary>
    public const string Handful = "handful";

    /// <summary>A glass of liquid.</summary>
    public const string Glass = "glass";

    /// <summary>A sealed pack, jar, or bottle (e.g. tofu, pasta sauce).</summary>
    public const string Pack = "pack";

    /// <summary>A can (e.g. tuna, tomatoes).</summary>
    public const string Can = "can";

    /// <summary>A tub (e.g. yogurt, quark).</summary>
    public const string Tub = "tub";

    /// <summary>A whole head (e.g. of cabbage).</summary>
    public const string Head = "head";

    /// <summary>A clove (e.g. of garlic).</summary>
    public const string Clove = "clove";

    /// <summary>A bunch (e.g. of radishes).</summary>
    public const string Bunch = "bunch";

    /// <summary>A scoop (e.g. of protein powder).</summary>
    public const string Scoop = "scoop";

    /// <summary>
    /// Every serving unit key seeded foods may use.
    /// </summary>
    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal)
    {
        Portion,
        Piece,
        Slice,
        Cup,
        Tbsp,
        Tsp,
        Handful,
        Glass,
        Pack,
        Can,
        Tub,
        Head,
        Clove,
        Bunch,
        Scoop,
    };
}
