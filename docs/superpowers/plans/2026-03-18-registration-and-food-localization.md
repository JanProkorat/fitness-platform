# Registration Screen & Food Name Localization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mobile registration screen (Client/Trainer/Nutritionist) with auto-login, and localize food names from OpenFoodFacts (en/cs/de) with multi-language caching.

**Architecture:** Two independent features. Feature 1 adds a new expo-router screen at `(auth)/register.tsx` that POSTs to `/auth/register` then auto-logs in. Feature 2 adds `LocalizedNames` to the MongoDB `Food` document, extracts `product_name_en/cs/de` from OpenFoodFacts, and resolves the best name via `Accept-Language` header in the food endpoints.

**Tech Stack:** React Native (Expo Router), TypeScript, ASP.NET Core 10, FastEndpoints, MongoDB, OpenFoodFacts API

---

## File Structure

### Feature 1: Registration Screen

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `mobile/app/(auth)/register.tsx` | Registration screen with form, role picker, GDPR consent |
| Modify | `mobile/app/(auth)/login.tsx` | Add "Sign up" navigation link |

### Feature 2: Food Name Localization

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `backend/.../Domain/Documents/LocalizedNames.cs` | MongoDB embedded doc for en/cs/de names |
| Modify | `backend/.../Domain/Documents/Food.cs` | Add `LocalizedNames` property |
| Modify | `backend/.../Infrastructure/Services/OpenFoodFactsModels.cs` | Add `product_name_en`, `product_name_cs`, `product_name_de` to `OffProduct` |
| Modify | `backend/.../Infrastructure/Services/OpenFoodFactsService.cs` | Extract localized names in `MapToFood` |
| Modify | `backend/.../Features/Foods/Shared/FoodSummary.cs` | Accept language param in `FromDocument` to resolve name |
| Modify | `backend/.../Features/Foods/GetFoodByBarcode/GetFoodByBarcodeEndpoint.cs` | Read `Accept-Language`, pass to `FromDocument` |
| Modify | `backend/.../Features/Foods/SearchFoods/SearchFoodsEndpoint.cs` | Read `Accept-Language`, pass to `FromDocument` |
| Modify | `backend/.../Tests/Services/OpenFoodFactsServiceTests.cs` | Add localized name mapping tests |
| Create | `backend/.../Tests/Documents/LocalizedNamesTests.cs` | Unit tests for `Resolve()` fallback logic |
| Modify | `backend/.../Tests/Endpoints/Foods/GetFoodByBarcodeEndpointTests.cs` | Test language resolution |
| Modify | `backend/.../Tests/Endpoints/Foods/SearchFoodsEndpointTests.cs` | Test Accept-Language in search |
| Modify | `mobile/src/api/client.ts` | Send `Accept-Language` header from device locale |

---

## Task 1: Mobile Registration Screen

**Files:**
- Create: `mobile/app/(auth)/register.tsx`
- Modify: `mobile/app/(auth)/login.tsx`

- [ ] **Step 1: Create register.tsx**

Create `mobile/app/(auth)/register.tsx` with:
- Same dark theme styling as login screen (reuse identical style patterns)
- `KeyboardAvoidingView` wrapping a `ScrollView` (more fields than login)
- Fields: First Name + Last Name (side by side in a `flexDirection: 'row'` container), Email, Password, Confirm Password
- Role picker: 3 `TouchableOpacity` pill buttons for Client / Trainer / Nutritionist, default "Client"
- GDPR consent: `TouchableOpacity` checkbox + text "I consent to the processing of my health data (GDPR Art. 9)"
- "Create account" gold button
- "Already have an account? Sign in" link at bottom using `router.replace('/(auth)/login')`
- Form state via `useState` (matches login screen pattern — no form library)
- `handleRegister` flow:
  1. Validate: all fields filled, passwords match, GDPR checked — show `Alert` if not
  2. `POST /auth/register` with `{ email, password, confirmPassword, firstName, lastName, role, gdprConsent }`
  3. On success: immediately `POST /auth/login` with `{ email, password }`
  4. Fetch `GET /users/me` with the new access token
  5. Call `login()` from auth store (same as login screen)
  6. On error: `Alert.alert` with server error message

```tsx
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../src/api/client';
import { useAuthStore } from '../../src/stores/auth';
import { Colors } from '../../constants/Colors';

const ROLES = ['Client', 'Trainer', 'Nutritionist'] as const;

export default function RegisterScreen() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<string>('Client');
  const [gdprConsent, setGdprConsent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters.');
      return;
    }
    if (!gdprConsent) {
      Alert.alert('Consent Required', 'You must consent to health data processing to register.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/register', {
        email,
        password,
        confirmPassword,
        firstName,
        lastName,
        role,
        gdprConsent,
      });

      // Auto-login after registration
      const { data } = await api.post('/auth/login', { email, password });
      const { data: profile } = await api.get('/users/me', {
        headers: { Authorization: `Bearer ${data.accessToken}` },
      });
      login(
        {
          publicId: profile.userId,
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          roles: profile.roles ?? [],
        },
        data.accessToken,
        data.refreshToken
      );
    } catch (e: any) {
      const msg =
        e.response?.data?.errors?.generalErrors?.[0] ??
        e.response?.data?.message ??
        'Registration failed. Please try again.';
      Alert.alert('Registration Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.logo}>
          GoodFellas <Text style={styles.logoAccent}>Platform</Text>
        </Text>
        <Text style={styles.subtitle}>Create your account</Text>

        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.halfInput]}
            placeholder="First name"
            placeholderTextColor={Colors.dark.muted}
            value={firstName}
            onChangeText={setFirstName}
            autoComplete="given-name"
          />
          <TextInput
            style={[styles.input, styles.halfInput]}
            placeholder="Last name"
            placeholderTextColor={Colors.dark.muted}
            value={lastName}
            onChangeText={setLastName}
            autoComplete="family-name"
          />
        </View>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={Colors.dark.muted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={Colors.dark.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm password"
          placeholderTextColor={Colors.dark.muted}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoComplete="new-password"
        />

        <Text style={styles.label}>I am a</Text>
        <View style={styles.roleRow}>
          {ROLES.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.rolePill, role === r && styles.rolePillActive]}
              onPress={() => setRole(r)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.rolePillText,
                  role === r && styles.rolePillTextActive,
                ]}
              >
                {r}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.consentRow}
          onPress={() => setGdprConsent(!gdprConsent)}
          activeOpacity={0.8}
        >
          <View style={[styles.checkbox, gdprConsent && styles.checkboxChecked]}>
            {gdprConsent && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.consentText}>
            I consent to the processing of my health data (GDPR Art. 9)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Creating account...' : 'Create account'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.replace('/(auth)/login')}
          style={styles.linkRow}
        >
          <Text style={styles.linkText}>
            Already have an account?{' '}
            <Text style={styles.linkAccent}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  inner: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  logo: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.dark.text,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  logoAccent: {
    color: Colors.dark.gold,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.dark.text3,
    marginBottom: 32,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  input: {
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.dark.text,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.text2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  rolePill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
  },
  rolePillActive: {
    backgroundColor: Colors.dark.gold,
    borderColor: Colors.dark.gold,
  },
  rolePillText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.dark.text3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rolePillTextActive: {
    color: '#000',
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 20,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: Colors.dark.gold,
    borderColor: Colors.dark.gold,
  },
  checkmark: {
    color: '#000',
    fontSize: 14,
    fontWeight: '800',
  },
  consentText: {
    flex: 1,
    fontSize: 13,
    color: Colors.dark.text2,
    lineHeight: 18,
  },
  button: {
    backgroundColor: Colors.dark.gold,
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  linkRow: {
    marginTop: 24,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
    color: Colors.dark.text3,
  },
  linkAccent: {
    color: Colors.dark.gold,
    fontWeight: '700',
  },
});
```

- [ ] **Step 2: Add "Sign up" link to login screen**

In `mobile/app/(auth)/login.tsx`, add after the sign-in button (before the closing `</View>`):

```tsx
<TouchableOpacity
  onPress={() => router.replace('/(auth)/register')}
  style={styles.linkRow}
>
  <Text style={styles.linkText}>
    Don't have an account?{' '}
    <Text style={styles.linkAccent}>Sign up</Text>
  </Text>
</TouchableOpacity>
```

Add these styles to the login screen's `StyleSheet`:

```tsx
linkRow: {
  marginTop: 24,
  alignItems: 'center',
},
linkText: {
  fontSize: 14,
  color: Colors.dark.text3,
},
linkAccent: {
  color: Colors.dark.gold,
  fontWeight: '700',
},
```

- [ ] **Step 3: Verify registration screen loads**

Run: `cd mobile && npx expo start`
Expected: Can navigate between login and register screens, form renders correctly.

- [ ] **Step 4: Commit**

```bash
git add mobile/app/\(auth\)/register.tsx mobile/app/\(auth\)/login.tsx
git commit -m "feat(mobile): add registration screen with role picker and auto-login"
```

---

## Task 2: LocalizedNames Document & Food Model Update

**Files:**
- Create: `backend/FitnessPlatform.Application/Domain/Documents/LocalizedNames.cs`
- Modify: `backend/FitnessPlatform.Application/Domain/Documents/Food.cs`

- [ ] **Step 1: Create LocalizedNames embedded document**

Create `backend/FitnessPlatform.Application/Domain/Documents/LocalizedNames.cs`:

```csharp
using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// Stores food names in supported languages for localization.
/// </summary>
public class LocalizedNames
{
    /// <summary>
    /// English name.
    /// </summary>
    [BsonElement("en")]
    public string? En { get; set; }

    /// <summary>
    /// Czech name.
    /// </summary>
    [BsonElement("cs")]
    public string? Cs { get; set; }

    /// <summary>
    /// German name.
    /// </summary>
    [BsonElement("de")]
    public string? De { get; set; }

    /// <summary>
    /// Resolves the best name for the given language, falling back to English, then any available name.
    /// </summary>
    /// <param name="language">Two-letter language code (e.g. "cs", "de", "en").</param>
    /// <returns>The best available name, or <c>null</c> if none set.</returns>
    public string? Resolve(string? language)
    {
        var preferred = language?.ToLowerInvariant() switch
        {
            "cs" => Cs,
            "de" => De,
            "en" => En,
            _ => null
        };

        return preferred ?? En ?? Cs ?? De;
    }
}
```

- [ ] **Step 2: Add LocalizedNames property to Food document**

In `backend/FitnessPlatform.Application/Domain/Documents/Food.cs`, add after the `Name` property:

```csharp
/// <summary>
/// Localized food names (en, cs, de) for multi-language support.
/// Null for system/custom foods that don't come from OpenFoodFacts.
/// </summary>
[BsonElement("localizedNames")]
[BsonIgnoreIfNull]
public LocalizedNames? LocalizedNames { get; set; }
```

- [ ] **Step 3: Run existing tests to verify no breakage**

Run: `cd backend && dotnet test`
Expected: All existing tests pass (new nullable property doesn't break anything).

- [ ] **Step 4: Commit**

```bash
git add backend/FitnessPlatform.Application/Domain/Documents/LocalizedNames.cs backend/FitnessPlatform.Application/Domain/Documents/Food.cs
git commit -m "feat(backend): add LocalizedNames embedded document to Food model"
```

---

## Task 3: Extract Localized Names from OpenFoodFacts API

**Files:**
- Modify: `backend/FitnessPlatform.Application/Infrastructure/Services/OpenFoodFactsModels.cs`
- Modify: `backend/FitnessPlatform.Application/Infrastructure/Services/OpenFoodFactsService.cs`

- [ ] **Step 1: Write failing test for localized name extraction**

In `backend/FitnessPlatform.Tests/Services/OpenFoodFactsServiceTests.cs`, add:

```csharp
[Fact]
public async Task SearchByBarcodeAsync_MapsLocalizedNames()
{
    SetupFindReturns(null);

    var apiResponse = CreateProductResponse("Nutella", "3017620422003", 539, 6.3m, 57.5m, 30.9m);
    apiResponse.Product!.ProductNameEn = "Nutella";
    apiResponse.Product.ProductNameCs = "Nutella čokoládová pomazánka";
    apiResponse.Product.ProductNameDe = "Nutella Schokoladenaufstrich";
    var httpClient = CreateHttpClient(_ => CreateJsonResponse(apiResponse));
    var sut = CreateService(httpClient);

    var result = await sut.SearchByBarcodeAsync("3017620422003");

    result.Should().NotBeNull();
    result!.LocalizedNames.Should().NotBeNull();
    result.LocalizedNames!.En.Should().Be("Nutella");
    result.LocalizedNames.Cs.Should().Be("Nutella čokoládová pomazánka");
    result.LocalizedNames.De.Should().Be("Nutella Schokoladenaufstrich");
}

[Fact]
public async Task SearchByBarcodeAsync_LocalizedNames_HandlesPartialLocalization()
{
    SetupFindReturns(null);

    var apiResponse = CreateProductResponse("Some Food", "111", 100, 5, 10, 3);
    apiResponse.Product!.ProductNameEn = "Some Food";
    // No cs or de name
    var httpClient = CreateHttpClient(_ => CreateJsonResponse(apiResponse));
    var sut = CreateService(httpClient);

    var result = await sut.SearchByBarcodeAsync("111");

    result!.LocalizedNames.Should().NotBeNull();
    result.LocalizedNames!.En.Should().Be("Some Food");
    result.LocalizedNames.Cs.Should().BeNull();
    result.LocalizedNames.De.Should().BeNull();
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && dotnet test --filter "LocalizedNames"`
Expected: Compilation error — `ProductNameEn` doesn't exist on `OffProduct`, `LocalizedNames` not populated.

- [ ] **Step 3: Add localized name fields to OffProduct**

In `backend/FitnessPlatform.Application/Infrastructure/Services/OpenFoodFactsModels.cs`, add to `OffProduct`:

```csharp
/// <summary>
/// English product name.
/// </summary>
[JsonPropertyName("product_name_en")]
public string? ProductNameEn { get; set; }

/// <summary>
/// Czech product name.
/// </summary>
[JsonPropertyName("product_name_cs")]
public string? ProductNameCs { get; set; }

/// <summary>
/// German product name.
/// </summary>
[JsonPropertyName("product_name_de")]
public string? ProductNameDe { get; set; }
```

- [ ] **Step 4: Populate LocalizedNames in MapToFood**

In `OpenFoodFactsService.cs`, inside `MapToFood`, add after setting `Name`:

```csharp
LocalizedNames = new LocalizedNames
{
    En = product.ProductNameEn?.Trim().NullIfEmpty(),
    Cs = product.ProductNameCs?.Trim().NullIfEmpty(),
    De = product.ProductNameDe?.Trim().NullIfEmpty(),
},
```

Add a private helper extension at the bottom of the file (inside the namespace, outside the class):

```csharp
/// <summary>
/// Returns null if the string is empty or whitespace.
/// </summary>
internal static class StringExtensions
{
    internal static string? NullIfEmpty(this string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && dotnet test --filter "LocalizedNames"`
Expected: Both new tests pass.

- [ ] **Step 6: Run all tests**

Run: `cd backend && dotnet test`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/FitnessPlatform.Application/Infrastructure/Services/OpenFoodFactsModels.cs backend/FitnessPlatform.Application/Infrastructure/Services/OpenFoodFactsService.cs backend/FitnessPlatform.Tests/Services/OpenFoodFactsServiceTests.cs
git commit -m "feat(backend): extract localized food names (en/cs/de) from OpenFoodFacts"
```

---

## Task 4: Unit Tests for LocalizedNames.Resolve()

**Files:**
- Create: `backend/FitnessPlatform.Tests/Documents/LocalizedNamesTests.cs`

- [ ] **Step 1: Write unit tests for Resolve() fallback logic**

Create `backend/FitnessPlatform.Tests/Documents/LocalizedNamesTests.cs`:

```csharp
using FitnessPlatform.Application.Domain.Documents;
using FluentAssertions;

namespace FitnessPlatform.Tests.Documents;

/// <summary>
/// Unit tests for <see cref="LocalizedNames"/> resolve/fallback logic.
/// </summary>
public class LocalizedNamesTests
{
    [Fact]
    public void Resolve_ExactMatch_ReturnsPreferredLanguage()
    {
        var names = new LocalizedNames { En = "Apple", Cs = "Jablko", De = "Apfel" };

        names.Resolve("cs").Should().Be("Jablko");
        names.Resolve("de").Should().Be("Apfel");
        names.Resolve("en").Should().Be("Apple");
    }

    [Fact]
    public void Resolve_PreferredMissing_FallsBackToEnglish()
    {
        var names = new LocalizedNames { En = "Apple", Cs = null, De = null };

        names.Resolve("cs").Should().Be("Apple");
        names.Resolve("de").Should().Be("Apple");
    }

    [Fact]
    public void Resolve_PreferredAndEnglishMissing_FallsBackToCzechThenGerman()
    {
        var names = new LocalizedNames { En = null, Cs = "Jablko", De = null };
        names.Resolve("de").Should().Be("Jablko");

        var names2 = new LocalizedNames { En = null, Cs = null, De = "Apfel" };
        names2.Resolve("cs").Should().Be("Apfel");
    }

    [Fact]
    public void Resolve_AllNull_ReturnsNull()
    {
        var names = new LocalizedNames { En = null, Cs = null, De = null };
        names.Resolve("en").Should().BeNull();
    }

    [Fact]
    public void Resolve_NullLanguage_FallsBackToEnglish()
    {
        var names = new LocalizedNames { En = "Apple", Cs = "Jablko", De = "Apfel" };
        names.Resolve(null).Should().Be("Apple");
    }

    [Fact]
    public void Resolve_UnsupportedLanguage_FallsBackToEnglish()
    {
        var names = new LocalizedNames { En = "Apple", Cs = "Jablko", De = "Apfel" };
        names.Resolve("fr").Should().Be("Apple");
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && dotnet test --filter "LocalizedNamesTests"`
Expected: FAIL — `LocalizedNames` class doesn't exist yet (created in Task 2).

Note: This task's tests will pass after Task 2 is implemented. Run them again after Task 2.

- [ ] **Step 3: Commit test file**

```bash
git add backend/FitnessPlatform.Tests/Documents/LocalizedNamesTests.cs
git commit -m "test(backend): add unit tests for LocalizedNames.Resolve() fallback logic"
```

---

## Task 5: Resolve Localized Name in Food Endpoints

**Files:**
- Modify: `backend/FitnessPlatform.Application/Features/Foods/Shared/FoodSummary.cs`
- Modify: `backend/FitnessPlatform.Application/Features/Foods/GetFoodByBarcode/GetFoodByBarcodeEndpoint.cs`
- Modify: `backend/FitnessPlatform.Application/Features/Foods/SearchFoods/SearchFoodsEndpoint.cs`
- Modify: `backend/FitnessPlatform.Tests/Endpoints/Foods/GetFoodByBarcodeEndpointTests.cs`
- Modify: `backend/FitnessPlatform.Tests/Endpoints/Foods/SearchFoodsEndpointTests.cs`

- [ ] **Step 1: Write failing test for language resolution in endpoint**

In `backend/FitnessPlatform.Tests/Endpoints/Foods/GetFoodByBarcodeEndpointTests.cs`, add:

```csharp
[Fact]
public async Task HandleAsync_WithAcceptLanguageCzech_ReturnsCzechName()
{
    var food = FoodTestHelpers.CreateFood(name: "Nutella", barcode: "3017620422003");
    food.LocalizedNames = new LocalizedNames
    {
        En = "Nutella",
        Cs = "Nutella čokoládová pomazánka",
        De = "Nutella Schokoladenaufstrich"
    };
    var externalService = Substitute.For<IFoodExternalService>();
    externalService.SearchByBarcodeAsync("3017620422003", Arg.Any<CancellationToken>())
        .Returns(food);

    var ep = Factory.Create<GetFoodByBarcodeEndpoint>(externalService);
    ep.HttpContext.Request.Headers.AcceptLanguage = "cs";

    await ep.HandleAsync(new GetFoodByBarcodeRequest { Barcode = "3017620422003" }, TestContext.Current.CancellationToken);

    ep.Response.Name.Should().Be("Nutella čokoládová pomazánka");
}

[Fact]
public async Task HandleAsync_WithNoLocalizedNames_ReturnsFoodName()
{
    var food = FoodTestHelpers.CreateFood(name: "Custom Food", barcode: "999");
    // No LocalizedNames set
    var externalService = Substitute.For<IFoodExternalService>();
    externalService.SearchByBarcodeAsync("999", Arg.Any<CancellationToken>())
        .Returns(food);

    var ep = Factory.Create<GetFoodByBarcodeEndpoint>(externalService);
    ep.HttpContext.Request.Headers.AcceptLanguage = "cs";

    await ep.HandleAsync(new GetFoodByBarcodeRequest { Barcode = "999" }, TestContext.Current.CancellationToken);

    ep.Response.Name.Should().Be("Custom Food");
}
```

Add necessary `using` at top if not present:
```csharp
using FitnessPlatform.Application.Domain.Documents;
```

Also in `backend/FitnessPlatform.Tests/Endpoints/Foods/SearchFoodsEndpointTests.cs`, add:

```csharp
[Fact]
public async Task HandleAsync_WithAcceptLanguageCzech_ReturnsCzechName()
{
    var food = FoodTestHelpers.CreateFood(name: "Chicken Breast");
    food.LocalizedNames = new LocalizedNames
    {
        En = "Chicken Breast",
        Cs = "Kuřecí prsa",
    };
    var mongo = FoodTestHelpers.CreateMockMongo(food);
    var externalService = Substitute.For<IFoodExternalService>();

    var ep = Factory.Create<SearchFoodsEndpoint>(mongo, externalService);
    ep.HttpContext.Request.Headers.AcceptLanguage = "cs";

    await ep.HandleAsync(new SearchFoodsRequest { Query = "chicken" }, TestContext.Current.CancellationToken);

    ep.Response.Foods.Should().HaveCount(1);
    ep.Response.Foods[0].Name.Should().Be("Kuřecí prsa");
}
```

Add `using FitnessPlatform.Application.Domain.Documents;` to the file if not already present.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && dotnet test --filter "AcceptLanguage"`
Expected: FAIL — `FromDocument` doesn't accept language, endpoint doesn't read header.

- [ ] **Step 3: Add language parameter to FoodSummary.FromDocument**

In `FoodSummary.cs`, change the `FromDocument` method:

```csharp
/// <summary>
/// Maps a <see cref="Food"/> document to a <see cref="FoodSummary"/> DTO.
/// </summary>
/// <param name="food">The food document.</param>
/// <param name="language">Two-letter language code for name resolution (e.g. "cs", "de"). Defaults to "en".</param>
public static FoodSummary FromDocument(Food food, string? language = null) => new()
{
    FoodId = food.ExternalId,
    Name = food.LocalizedNames?.Resolve(language) ?? food.Name,
    Source = food.Source,
    Barcode = food.Barcode,
    NutrientValue = new NutrientValueDto
    {
        Kcal = food.NutrientValue.Kcal,
        Protein = food.NutrientValue.Protein,
        Carbs = food.NutrientValue.Carbs,
        Fat = food.NutrientValue.Fat,
        Fiber = food.NutrientValue.Fiber,
        Sugar = food.NutrientValue.Sugar,
        SaturatedFat = food.NutrientValue.SaturatedFat,
        Salt = food.NutrientValue.Salt
    },
    Allergens = food.Allergens,
    CommonServings = food.CommonServings
        .Select(s => new ServingSizeDto { Label = s.Label, WeightGrams = s.WeightGrams })
        .ToList(),
    IsVerified = food.IsVerified
};
```

- [ ] **Step 4: Read Accept-Language in GetFoodByBarcodeEndpoint**

In `GetFoodByBarcodeEndpoint.cs`, update `HandleAsync`:

```csharp
public override async Task HandleAsync(GetFoodByBarcodeRequest req, CancellationToken ct)
{
    var food = await externalService.SearchByBarcodeAsync(req.Barcode, ct);

    if (food is null)
    {
        await Send.NotFoundAsync(ct);
        return;
    }

    var language = HttpContext.Request.Headers.AcceptLanguage.FirstOrDefault()?.Split(',').FirstOrDefault()?.Split('-').FirstOrDefault();
    await Send.OkAsync(FoodSummary.FromDocument(food, language), ct);
}
```

- [ ] **Step 5: Read Accept-Language in SearchFoodsEndpoint**

In `SearchFoodsEndpoint.cs`, add before the `Send.OkAsync` call, and update the mapping:

```csharp
var language = HttpContext.Request.Headers.AcceptLanguage.FirstOrDefault()?.Split(',').FirstOrDefault()?.Split('-').FirstOrDefault();

await Send.OkAsync(new SearchFoodsResponse
{
    Foods = localFoods.Select(f => FoodSummary.FromDocument(f, language)).ToList(),
    TotalCount = totalCount,
    Page = req.Page,
    PageSize = req.PageSize
}, ct);
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && dotnet test`
Expected: All tests pass including the new Accept-Language tests.

- [ ] **Step 7: Commit**

```bash
git add backend/FitnessPlatform.Application/Features/Foods/Shared/FoodSummary.cs backend/FitnessPlatform.Application/Features/Foods/GetFoodByBarcode/GetFoodByBarcodeEndpoint.cs backend/FitnessPlatform.Application/Features/Foods/SearchFoods/SearchFoodsEndpoint.cs backend/FitnessPlatform.Tests/Endpoints/Foods/GetFoodByBarcodeEndpointTests.cs backend/FitnessPlatform.Tests/Endpoints/Foods/SearchFoodsEndpointTests.cs
git commit -m "feat(backend): resolve food name from Accept-Language header in food endpoints"
```

---

## Task 6: Send Accept-Language from Mobile App

**Files:**
- Modify: `mobile/src/api/client.ts`

- [ ] **Step 1: Add Accept-Language header to axios request interceptor**

In `mobile/src/api/client.ts`, add `expo-localization` import and modify the request interceptor:

```typescript
import { getLocales } from 'expo-localization';
```

Update the request interceptor to also set `Accept-Language`:

```typescript
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const locale = getLocales()[0]?.languageCode ?? 'en';
  config.headers['Accept-Language'] = locale;
  return config;
});
```

- [ ] **Step 2: Verify expo-localization is available**

`expo-localization` ships with Expo SDK 55 — no install needed. Verify:

Run: `cd mobile && npx expo install expo-localization`
Expected: Already installed or installs successfully.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/api/client.ts mobile/package.json mobile/package-lock.json
git commit -m "feat(mobile): send device locale as Accept-Language header for food name localization"
```
