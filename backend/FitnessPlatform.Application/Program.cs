using System.Threading.RateLimiting;
using FastEndpoints;
using Microsoft.AspNetCore.HttpOverrides;
using FastEndpoints.Security;
using FastEndpoints.Swagger;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.HealthChecks;
using FitnessPlatform.Application.Infrastructure.Hubs;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Application.Middleware;
using FitnessPlatform.Application.Seed;
using MongoDB.Driver;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Resend;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// Serilog
builder.Host.UseSerilog((context, config) => config
    .ReadFrom.Configuration(context.Configuration)
    .WriteTo.Console());

// Secrets from environment variables (launchSettings.json in dev, App Settings in prod)
var postgresPassword = builder.Configuration["POSTGRES_PASSWORD"]
    ?? throw new InvalidOperationException("POSTGRES_PASSWORD environment variable is not set.");
var mongoPassword = builder.Configuration["MONGO_PASSWORD"]
    ?? throw new InvalidOperationException("MONGO_PASSWORD environment variable is not set.");
var minioAccessKey = builder.Configuration["MINIO_ACCESS_KEY"]
    ?? throw new InvalidOperationException("MINIO_ACCESS_KEY environment variable is not set.");
var minioSecretKey = builder.Configuration["MINIO_SECRET_KEY"]
    ?? throw new InvalidOperationException("MINIO_SECRET_KEY environment variable is not set.");
var jwtSecret = builder.Configuration["JWT_SECRET"]
    ?? throw new InvalidOperationException("JWT_SECRET environment variable is not set.");

// Inject secrets into configuration so services can read them
builder.Configuration["Jwt:Secret"] = jwtSecret;
builder.Configuration["MinIO:AccessKey"] = minioAccessKey;
builder.Configuration["MinIO:SecretKey"] = minioSecretKey;

// Build connection strings with injected passwords
var postgresConnection = ConnectionStringFactory.BuildPostgres(builder.Configuration);
var mongoConnection = ConnectionStringFactory.BuildMongo(builder.Configuration);

// PostgreSQL + EF Core
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(postgresConnection)
        .UseSnakeCaseNamingConvention());
builder.Services.AddScoped<IApplicationDbContext>(sp => sp.GetRequiredService<ApplicationDbContext>());

// MongoDB — Guid serializer registered via MongoBootstrapper module
// initializer so it runs before any other assembly touches BsonSerializer.
var mongoDatabaseName = builder.Configuration[ConfigKeys.MongoDbDatabaseName]
    ?? throw new InvalidOperationException("MongoDB:DatabaseName is not configured.");
var mongoClient = new MongoClient(mongoConnection);
builder.Services.AddSingleton<IMongoDatabase>(_ => mongoClient.GetDatabase(mongoDatabaseName));
builder.Services.AddSingleton<IMongoContext, MongoContext>();
builder.Services.AddHostedService<MongoIndexInitializer>();

// Blob Storage (MinIO)
builder.Services.AddSingleton<IBlobStorageService, MinioBlobStorageService>();
builder.Services.AddSingleton<IImageUploadService, ImageUploadService>();

// ASP.NET Identity
builder.Services.AddIdentityCore<ApplicationUser>(options =>
{
    options.Password.RequireDigit = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireUppercase = true;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequiredLength = 8;
    options.User.RequireUniqueEmail = true;
})
.AddRoles<ApplicationRole>()
.AddEntityFrameworkStores<ApplicationDbContext>()
.AddDefaultTokenProviders();

// FastEndpoints + JWT
builder.Services
    .AddAuthenticationJwtBearer(s =>
    {
        s.SigningKey = jwtSecret;
    })
    .AddAuthorization()
    .AddFastEndpoints()
    .SwaggerDocument(o =>
    {
        o.ShortSchemaNames = true;
        o.DocumentSettings = s =>
        {
            s.Title = "Fitness Platform API";
            s.Version = "v1";
        };
    });

// SignalR JWT: extract token from query string for hub connections
builder.Services.AddOptions<Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerOptions>(
    Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme)
    .Configure(options =>
    {
        options.Events ??= new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents();
        var existingOnMessageReceived = options.Events.OnMessageReceived;
        options.Events.OnMessageReceived = async context =>
        {
            if (existingOnMessageReceived is not null)
                await existingOnMessageReceived(context);

            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
            {
                context.Token = accessToken;
            }
        };
    });

// Rate Limiting
var rateLimitingDisabled = builder.Configuration.GetValue<bool>("RateLimiting:Disabled");

builder.Services.AddRateLimiter(options =>
{
    // Resolve the client IP from the request context.
    // Behind a trusted reverse proxy (Render edge), X-Forwarded-For has already
    // been resolved into HttpContext.Connection.RemoteIpAddress by UseForwardedHeaders.
    // If RemoteIpAddress is still null (should not happen in production because
    // UseForwardedHeaders is registered before UseRateLimiter), fall back to the
    // connection id — a per-connection unique string — so we never collapse all
    // anonymous connections into a single shared "unknown" bucket that one flood
    // could exhaust for everyone.
    static string GetPartitionKey(HttpContext context) =>
        context.Connection.RemoteIpAddress?.ToString()
        ?? context.Connection.Id;

    options.AddPolicy(AppPolicies.AuthRateLimit, context =>
        rateLimitingDisabled
            ? RateLimitPartition.GetNoLimiter("disabled")
            : RateLimitPartition.GetFixedWindowLimiter(
                partitionKey: GetPartitionKey(context),
                factory: _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 10,
                    Window = TimeSpan.FromMinutes(15),
                    QueueLimit = 0
                }));

    // Separate policy for the refresh endpoint so background token rotation
    // does not consume the shared login/register budget.
    // 120 permits per 15 min per IP: bounds flood abuse while comfortably
    // accommodating normal transparent refresh (multiple tabs, concurrent requests).
    options.AddPolicy(AppPolicies.RefreshRateLimit, context =>
        rateLimitingDisabled
            ? RateLimitPartition.GetNoLimiter("disabled")
            : RateLimitPartition.GetFixedWindowLimiter(
                partitionKey: GetPartitionKey(context),
                factory: _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 120,
                    Window = TimeSpan.FromMinutes(15),
                    QueueLimit = 0
                }));

    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy(AppPolicies.AllowWebApp, policy =>
    {
        var origins = builder.Configuration.GetSection(ConfigKeys.CorsAllowedOrigins).Get<string[]>()
            ?? ["http://localhost:5173"];
        policy.WithOrigins(origins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// SignalR
builder.Services.AddSignalR();
builder.Services.AddSingleton<PresenceTracker>();

// Macro Calculator
builder.Services.AddSingleton<IMacroCalculatorService, MacroCalculatorService>();

// Nutrition Auth Helper (cross-DB link verification)
builder.Services.AddScoped<NutritionAuthHelper>();
builder.Services.AddScoped<ProfessionalAuthHelper>();
builder.Services.AddScoped<IPrDetectionService, PrDetectionService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IWorkoutCompletionService, WorkoutCompletionService>();
// Registers IHttpClientFactory — consumed by ExpoPushNotificationService below
// and by the ResendClient typed client when Email:Provider = Resend.
builder.Services.AddHttpClient();
builder.Services.AddScoped<IPushNotificationService, ExpoPushNotificationService>();
builder.Services.AddScoped<IProfileMapperService, ProfileMapperService>();

// Email — switch provider via Email:Provider config ("Resend" or "Smtp", default: Smtp)
var emailProvider = builder.Configuration[ConfigKeys.EmailProvider] ?? "Smtp";
if (string.Equals(emailProvider, "Resend", StringComparison.OrdinalIgnoreCase))
{
    builder.Services.AddOptions();
    builder.Services.AddHttpClient<ResendClient>();
    builder.Services.Configure<ResendClientOptions>(o =>
    {
        o.ApiToken = builder.Configuration[ConfigKeys.ResendApiToken]
            ?? throw new InvalidOperationException("Resend:ApiToken must be configured when Email:Provider is set to Resend.");
    });
    builder.Services.AddTransient<IResend, ResendClient>();
    builder.Services.AddScoped<IEmailService, ResendEmailService>();
}
else
{
    builder.Services.AddScoped<IEmailService, SmtpEmailService>();
}

// Realtime notifications (SignalR)
builder.Services.AddScoped<IRealtimeNotifier, SignalRNotifier>();

// Weekly check-in scheduler — registered as both singleton (for test access) and hosted service.
builder.Services.AddSingleton<WeeklyCheckInScheduler>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<WeeklyCheckInScheduler>());

// Photo diary reminder scheduler — registered as both singleton (for test access) and hosted service.
builder.Services.AddSingleton<PhotoDiaryReminderScheduler>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<PhotoDiaryReminderScheduler>());

// Social login nonce reaper — periodically deletes expired/consumed nonce rows.
// Registered as singleton (for test access via IServiceProvider) and hosted service.
builder.Services.AddSingleton<SocialLoginNonceReaperService>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<SocialLoginNonceReaperService>());

// Session lock service — mutual exclusion for trainer-edit vs client-live sessions
builder.Services.Configure<TrainingLockOptions>(
    builder.Configuration.GetSection(TrainingLockOptions.SectionName));
builder.Services.AddScoped<ISessionLockService, SessionLockService>();

// Compliance
builder.Services.AddScoped<IComplianceService, ComplianceService>();

// Client verdict
builder.Services.AddScoped<IClientVerdictService, ClientVerdictService>();

// Google social login token verification
builder.Services.AddScoped<IGoogleTokenVerifier, GoogleTokenVerifier>();

// Apple Sign-In token verification
builder.Services.AddScoped<IAppleTokenVerifier, AppleTokenVerifier>();

// Audit
builder.Services.AddScoped<IAuditService, AuditService>();

// Exception handling
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

// Health checks — `/health/live` is the cheap liveness probe (no deps),
// `/health` runs the readiness checks tagged "ready" (Postgres + Mongo ping).
builder.Services.AddHealthChecks()
    .AddCheck<PostgresHealthCheck>("postgres", tags: ["ready"])
    .AddCheck<MongoHealthCheck>("mongodb", tags: ["ready"]);

var app = builder.Build();

// Warn loudly at startup when Testing:Enabled=true.
// POST /test/reset wipes the database on every call. The endpoint itself enforces
// the Development + Testing:Enabled gate at request time, so a bad environment
// value won't bypass the guard, but a startup warning catches misconfiguration
// early (e.g. a prod deploy that accidentally copies Testing:Enabled=true).
var testingEnabled = builder.Configuration.GetValue<bool>("Testing:Enabled");
if (testingEnabled)
{
    app.Logger.LogWarning(
        "TESTING MODE ACTIVE: POST /test/reset will wipe the database on demand. " +
        "This endpoint must never be enabled in a production environment. " +
        "Requests are rejected unless the environment is also Development.");
}

// Seed data
if (args.Contains("--seed"))
{
    await ApplicationDbContextSeed.SeedAsync(app.Services);
    await MongoSeeder.SeedAsync(app.Services);
    return;
}

// QA fixture for the docker-compose end-to-end harness. Order matters:
// roles first (QaSeedRunner assigns roles to its users), then the QA users
// themselves, then Mongo — MongoSeeder.RecipeSeed gates on a nutritionist
// existing in Postgres, so QaSeedRunner has to land before it on cold boot
// or the recipes collection stays empty until the next reseed. Idempotent
// across reruns.
if (args.Contains("--qa-seed"))
{
    await ApplicationDbContextSeed.SeedAsync(app.Services);
    await QaSeedRunner.SeedAsync(app.Services);
    await MongoSeeder.SeedAsync(app.Services);
    return;
}

// One-shot backfill: copy per-photo notes from MongoDB into PlanPhoto.Description in Postgres.
// Usage: dotnet run -- --backfill-photo-descriptions
if (args.Contains("--backfill-photo-descriptions"))
{
    using var scope = app.Services.CreateScope();
    var db     = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
    var mongoc = scope.ServiceProvider.GetRequiredService<IMongoContext>();
    var logFactory = scope.ServiceProvider.GetRequiredService<ILoggerFactory>();
    var svc = new FitnessPlatform.Application.Infrastructure.Services.PhotoDescriptionBackfillService(
        db, mongoc, logFactory.CreateLogger<FitnessPlatform.Application.Infrastructure.Services.PhotoDescriptionBackfillService>());
    var (mealCount, dayCount) = await svc.BackfillAsync();
    Console.WriteLine($"Meal photos updated: {mealCount}");
    Console.WriteLine($"Day photos updated:  {dayCount}");
    return;
}

// One-shot backfill: copy goal + targetWeightKg from ClientOnboardingData onto existing
// NutritionPlan and TrainingPlan MongoDB documents that were created before the plan-level
// goal fields were introduced.
// Usage: dotnet run -- --backfill-plan-goals
if (args.Contains("--backfill-plan-goals"))
{
    using var scope = app.Services.CreateScope();
    var db     = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
    var mongoc = scope.ServiceProvider.GetRequiredService<IMongoContext>();
    var logFactory = scope.ServiceProvider.GetRequiredService<ILoggerFactory>();
    var svc = new FitnessPlatform.Application.Infrastructure.Services.PlanGoalBackfillService(
        db, mongoc, logFactory.CreateLogger<FitnessPlatform.Application.Infrastructure.Services.PlanGoalBackfillService>());
    var (nutritionCount, trainingCount) = await svc.BackfillAsync();
    Console.WriteLine($"Nutrition plans updated: {nutritionCount}");
    Console.WriteLine($"Training plans updated:  {trainingCount}");
    return;
}

// Auto-apply pending EF Core migrations — OPT-IN via Database:RunMigrationsOnStartup=true.
//
// This flag is intentionally OFF by default. It must be set explicitly in the
// environment where auto-migration is desired:
//
//   • Local dev: set in Properties/launchSettings.json (gitignored; never committed)
//         "Database__RunMigrationsOnStartup": "true"
//   • e2e compose harness: set in docker-compose.test.yml api service env section
//         Database__RunMigrationsOnStartup: "true"
//
// Render (and any other hosted environment) sets ASPNETCORE_ENVIRONMENT=Development
// for TLS / certificate reasons — that alone does NOT enable auto-migration.
// Because Render does not set Database__RunMigrationsOnStartup, the flag stays
// false and migrations are NEVER auto-applied there.
//
// NEVER promote this flag to a default-true value without explicit sign-off.
// Schema changes that affect live data must be applied intentionally with a
// reviewed migration plan.
var runMigrationsOnStartup = app.Configuration.GetValue<bool>("Database:RunMigrationsOnStartup");
if (runMigrationsOnStartup)
{
    using var migrationScope = app.Services.CreateScope();
    var migrationDb = migrationScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    await migrationDb.Database.MigrateAsync();
    app.Logger.LogInformation("EF Core migrations applied (Database:RunMigrationsOnStartup=true).");
}

// Middleware pipeline
app.UseExceptionHandler();

// Resolve the true client IP from X-Forwarded-For when the app runs behind
// the Render edge proxy (or any trusted reverse proxy).
//
// SECURITY: blanket trust (ForwardedHeadersOptions with no KnownProxies /
// KnownNetworks configured) lets any client spoof X-Forwarded-For and forge
// its own rate-limit partition key.  We restrict trust to:
//   • RFC 1918 private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
//   • IPv6 loopback / link-local (::1, fc00::/7, fe80::/10)
//
// Render's internal routing places the edge proxy on a private IP relative
// to the application container, so these ranges cover the production topology
// while preventing a public client from injecting an arbitrary forwarded IP.
//
// Must run BEFORE UseRateLimiter so the rate-limiter already sees the resolved
// IP in HttpContext.Connection.RemoteIpAddress.
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor,
    // ForwardLimit defaults to 1 — assumes exactly ONE trusted hop (the Render edge proxy).
    // If the deployment topology ever adds a second trusted hop (e.g. an internal LB behind
    // Render), bump this to 2 and add the LB's network to KnownIPNetworks.
    KnownIPNetworks =
    {
        // 10.0.0.0/8  (RFC 1918)
        new System.Net.IPNetwork(System.Net.IPAddress.Parse("10.0.0.0"), 8),
        // 172.16.0.0/12  (RFC 1918)
        new System.Net.IPNetwork(System.Net.IPAddress.Parse("172.16.0.0"), 12),
        // 192.168.0.0/16  (RFC 1918)
        new System.Net.IPNetwork(System.Net.IPAddress.Parse("192.168.0.0"), 16),
        // ::1/128  (IPv6 loopback)
        new System.Net.IPNetwork(System.Net.IPAddress.IPv6Loopback, 128),
        // fc00::/7  (IPv6 unique local)
        new System.Net.IPNetwork(System.Net.IPAddress.Parse("fc00::"), 7),
        // fe80::/10  (IPv6 link-local)
        new System.Net.IPNetwork(System.Net.IPAddress.Parse("fe80::"), 10),
    }
});

// Health endpoints — registered before HTTPS redirect / auth so they remain
// reachable on plain HTTP (Render terminates TLS at the edge) and don't
// require credentials.
app.MapHealthChecks("/health/live", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = _ => false,
});
app.MapHealthChecks("/health", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready"),
});

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
    app.UseHttpsRedirection();
}
app.UseCors(AppPolicies.AllowWebApp);
app.UseAuthentication();
app.UseAuthorization();
app.MapHub<NotificationHub>("/hubs/notifications");
app.UseRateLimiter();
// NOTE: ResetTestStateEndpoint is always registered in the route table.
// The double gate (Testing:Enabled=true AND IsDevelopment) is enforced at
// request time inside the endpoint's HandleAsync. This avoids a process-wide
// static route table poisoning issue in test environments where multiple
// WebApplicationFactory instances share FastEndpoints' static EndpointData
// (FastEndpoints 8.x builds the route table once per process).
app.UseFastEndpoints(c =>
{
    c.Endpoints.ShortNames = true;
    c.Serializer.Options.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    c.Errors.UseProblemDetails(x =>
    {
        x.IndicateErrorCode = true;
    });
});
app.UseSwaggerGen();

app.Run();
