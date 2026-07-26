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

// MongoIndexInitializer is registered as a plain singleton, NOT via AddHostedService.
// It is invoked explicitly, awaited, and completed BEFORE app.Run() below — see that
// call site for why. Index creation is idempotent and stays part of the same pass.
builder.Services.AddSingleton<MongoIndexInitializer>();

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
builder.Services.AddScoped<IEmailVerificationTokenService, EmailVerificationTokenService>();
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

// Get-or-create conversation + seed-first-message (invite messages, accept-time
// statements) — shared by CreatePendingInviteEndpoint, AcceptClientInviteEndpoint,
// and AcceptInvitationEndpoint (#768).
builder.Services.AddScoped<IConversationSeedService, ConversationSeedService>();

// Seeds a professional-client conversation for a brand-new account against any
// message-bearing PendingInvite already addressed to their email — shared by
// RegisterEndpoint, GoogleSocialLoginEndpoint, and AppleSocialLoginEndpoint so the
// coach's opening message is visible before the client accepts (#803/#817).
builder.Services.AddScoped<IPendingInviteConversationSeeder, PendingInviteConversationSeeder>();

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

// Background email dispatch queue + worker (#702) — closes the timing-enumeration
// oracle on the anonymous resend-verification endpoint by deferring the SMTP send off
// the request path. Queue is a singleton so the request path (scoped) and the worker
// (hosted service) share the same channel. Worker registered as both singleton (for
// test access via IServiceProvider) and hosted service, mirroring the schedulers above.
builder.Services.AddSingleton<IBackgroundEmailQueue, BackgroundEmailQueue>();
builder.Services.AddSingleton<EmailDispatchWorker>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<EmailDispatchWorker>());

// Session lock service — mutual exclusion for trainer-edit vs client-live sessions
builder.Services.Configure<TrainingLockOptions>(
    builder.Configuration.GetSection(TrainingLockOptions.SectionName));
builder.Services.AddScoped<ISessionLockService, SessionLockService>();

// Compliance
builder.Services.AddScoped<IComplianceService, ComplianceService>();

// Client verdict
builder.Services.AddScoped<IClientVerdictService, ClientVerdictService>();

// Shared version-gated fetch-check-replace-409 skeleton for NutritionPlans/TrainingPlans
// mutation endpoints (Update, Publish, Complete, LinkQuestionnaire).
builder.Services.AddScoped<PlanConcurrencyGuard>();

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
// POST /test/reset wipes the database on every call. The Testing:Enabled flag is the
// SOLE gate — the environment name is no longer checked. This means a misconfigured
// production deploy that accidentally sets Testing:Enabled=true would expose the
// endpoint with no further backstop. The startup warning is the early alarm for
// exactly this scenario. This flag must never be set outside of test harnesses.
var testingEnabled = builder.Configuration.GetValue<bool>("Testing:Enabled");
if (testingEnabled)
{
    app.Logger.LogWarning(
        "TESTING MODE ACTIVE: POST /test/reset will wipe the database on demand. " +
        "Testing:Enabled=true is the SOLE gate — the environment name is not checked. " +
        "This flag must NEVER be set outside of isolated test harnesses. " +
        "A production deploy with this flag set has no further protection.");
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
// themselves, then Mongo. Note (#809): MongoSeeder's catalog recipes/workout
// templates no longer gate on a nutritionist existing — the old per-nutritionist
// private-recipe cloning was removed; catalog recipes are public and owned by
// the system admin user regardless of which (if any) nutritionists exist.
// QaSeedRunner still runs before MongoSeeder here so the QA fixture users/plans
// and the public catalog land in one deterministic pass on cold boot. Idempotent
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

// One-shot migration (#840): rewrite every Mongo document's clientId field from
// ClientProfile.PublicId to ApplicationUser.Id (NutritionPlan, TrainingPlan,
// TrainingCompletion, DayLog, MealLog, SessionLog, SessionLock).
//
// This is the PRODUCTION entrypoint for this migration. Render does not set
// Database:RunMigrationsOnStartup (see that flag's remarks below), so the
// startup-gated invocation near app.Run() is dev/e2e-only convenience and never
// fires in prod. Run this once as an intentional deploy step, the same way EF
// Core migrations are applied deliberately on Render rather than auto-run:
//
//   dotnet run -- --migrate-client-ids
//
// Idempotent — safe to re-run; see MongoIndexInitializer.MigrateClientIdsAsync's
// remarks for the idempotency argument.
if (args.Contains("--migrate-client-ids"))
{
    using var scope = app.Services.CreateScope();
    var migrationDb = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
    var mongoIndexInitializer = scope.ServiceProvider.GetRequiredService<MongoIndexInitializer>();
    await mongoIndexInitializer.MigrateClientIdsAsync(migrationDb, CancellationToken.None);
    Console.WriteLine("ClientId standardisation (#840) complete — see log output above for per-collection counts.");
    return;
}

// One-shot migration (#841): merge every WorkoutLog + TrainingCompletion document into the
// unified SessionExecution collection.
//
// This is the PRODUCTION entrypoint for this migration, mirroring --migrate-client-ids (#840)
// above — Render does not set Database:RunMigrationsOnStartup, so this must be run once as an
// intentional deploy step:
//
//   dotnet run -- --migrate-session-executions
//
// Idempotent — safe to re-run; see MongoIndexInitializer.MigrateSessionExecutionsAsync's
// remarks for the idempotency argument (identity = (clientId, sessionId, date) for plan-bound
// executions, ExternalId for ad-hoc ones).
//
// Pure Mongo-to-Mongo — unlike --migrate-client-ids this needs no IApplicationDbContext scope.
if (args.Contains("--migrate-session-executions"))
{
    using var scope = app.Services.CreateScope();
    var mongoIndexInitializer = scope.ServiceProvider.GetRequiredService<MongoIndexInitializer>();
    var (merged, logOnly, completionOnly, adHoc, skipped) =
        await mongoIndexInitializer.MigrateSessionExecutionsAsync(CancellationToken.None);
    Console.WriteLine(
        $"SessionExecution migration (#841) complete — merged={merged} logOnly={logOnly} " +
        $"completionOnly={completionOnly} adHoc={adHoc} skipped(alreadyMigrated)={skipped}. " +
        "See log output above for details.");
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
// Captures Accept-Language into ApplicationUser.Language for authenticated callers
// (#788) — must run after UseAuthorization so context.User is populated.
app.UseMiddleware<LocaleCaptureMiddleware>();
app.MapHub<NotificationHub>("/hubs/notifications");
app.UseRateLimiter();
// NOTE: ResetTestStateEndpoint is always registered in the route table.
// The single gate (Testing:Enabled=true) is enforced at request time inside
// the endpoint's HandleAsync. This avoids a process-wide static route table
// poisoning issue in test environments where multiple WebApplicationFactory
// instances share FastEndpoints' static EndpointData
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

// #837 fix (pass-2 review M1): guarantee the retire-schema-on-read migration
// (backfilling legacy TrainingSession/WorkoutLog/TrainingCompletion documents,
// plus its idempotent index creation) COMPLETES before Kestrel accepts any
// request. This is why MongoIndexInitializer is registered above as a plain
// AddSingleton, NOT AddHostedService: in the generic/web host, hosted services
// start sequentially in registration order, and the framework's own web-hosting
// service (which actually starts Kestrel listening) is registered ahead of
// anything added later in this file — so a plain AddHostedService<MongoIndexInitializer>
// would let Kestrel begin serving BEFORE (or concurrently with) this migration's
// StartAsync, not after it. A request racing an unfinished migration would read
// an un-migrated legacy TrainingSession/WorkoutLog document and throw
// BsonSerializationException — #837 deleted the graceful WithBackfilledSections
// request-time fallback, and the document types carry no [BsonIgnoreExtraElements],
// so that read no longer self-heals the way it did pre-#837. Awaiting the explicit
// call below, strictly before app.Run(), removes that race entirely: there is no
// hosted-service ordering to reason about because this is plain sequential code.
using (var migrationScope = app.Services.CreateScope())
{
    var mongoIndexInitializer = migrationScope.ServiceProvider.GetRequiredService<MongoIndexInitializer>();

    await mongoIndexInitializer.StartAsync(CancellationToken.None);

    // #840: standardise every Mongo document's clientId field on ApplicationUser.Id
    // (NutritionPlan, TrainingPlan, TrainingCompletion, DayLog, MealLog, SessionLog,
    // SessionLock — WorkoutLog and PersonalRecord already used ApplicationUser.Id).
    // Same pre-app.Run() timing requirement as StartAsync above: endpoints filter
    // these collections by ApplicationUser.Id, and a request racing an unmigrated
    // document would silently match zero documents rather than throw, so this must
    // also complete before Kestrel accepts traffic when it runs. IApplicationDbContext
    // is scoped, so it's resolved from this same scope and passed in as a parameter —
    // see MongoIndexInitializer.MigrateClientIdsAsync's remarks for why it isn't a
    // constructor dependency.
    //
    // GATED behind the SAME runMigrationsOnStartup flag as the relational EF migration
    // above (unlike StartAsync(), which always runs — it never touches Postgres). This
    // migration reads ClientProfile rows from Postgres via IApplicationDbContext, and in
    // the Testcontainers/e2e harness Database:RunMigrationsOnStartup=false while the
    // relational schema is provisioned later by ApplicationDbContextSeed — so running
    // this unconditionally raced an unprovisioned Postgres schema and threw Npgsql 42P01
    // "relation client_profiles does not exist" nondeterministically across the shared
    // fixture.
    //
    // This startup-gated invocation is DEV/E2E CONVENIENCE ONLY. Render does NOT set
    // Database:RunMigrationsOnStartup (see the flag's own remarks a few dozen lines
    // above: "Because Render does not set Database__RunMigrationsOnStartup, the flag
    // stays false and migrations are NEVER auto-applied there"), so this block never
    // runs in production. The production mechanism is the dedicated
    // `dotnet run -- --migrate-client-ids` one-shot CLI arg defined earlier in this
    // file — run it once as an intentional deploy step, mirroring how EF Core
    // migrations are applied deliberately on Render rather than auto-run. The
    // Testcontainers tests for this migration invoke MigrateClientIdsAsync directly
    // against an already-provisioned schema, independent of this startup gate.
    if (runMigrationsOnStartup)
    {
        var migrationDbContext = migrationScope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
        await mongoIndexInitializer.MigrateClientIdsAsync(migrationDbContext, CancellationToken.None);
    }
}

app.Run();
