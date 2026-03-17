using System.Threading.RateLimiting;
using FastEndpoints;
using FastEndpoints.Security;
using FastEndpoints.Swagger;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Application.Middleware;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Bson.Serialization.Serializers;
using MongoDB.Driver;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
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
var postgresConnection = builder.Configuration.GetConnectionString(ConfigKeys.PostgreSql)
    + $";Password={postgresPassword}";
var mongoConnection = string.Format(
    builder.Configuration.GetConnectionString("MongoDB")!,
    mongoPassword);

// PostgreSQL + EF Core
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(postgresConnection)
        .UseSnakeCaseNamingConvention());
builder.Services.AddScoped<IApplicationDbContext>(sp => sp.GetRequiredService<ApplicationDbContext>());

// MongoDB
BsonSerializer.RegisterSerializer(new GuidSerializer(GuidRepresentation.Standard));
var mongoDatabaseName = builder.Configuration[ConfigKeys.MongoDbDatabaseName]
    ?? throw new InvalidOperationException("MongoDB:DatabaseName is not configured.");
var mongoClient = new MongoClient(mongoConnection);
builder.Services.AddSingleton<IMongoDatabase>(_ => mongoClient.GetDatabase(mongoDatabaseName));
builder.Services.AddSingleton<IMongoContext, MongoContext>();
builder.Services.AddHostedService<MongoIndexInitializer>();

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

// Rate Limiting
var rateLimitingDisabled = builder.Configuration.GetValue<bool>("RateLimiting:Disabled");

builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy(AppPolicies.AuthRateLimit, context =>
        rateLimitingDisabled
            ? RateLimitPartition.GetNoLimiter("disabled")
            : RateLimitPartition.GetFixedWindowLimiter(
                partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                factory: _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 10,
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

// Open Food Facts
var offBaseUrl = builder.Configuration[ConfigKeys.OpenFoodFactsBaseUrl] ?? "https://world.openfoodfacts.org/";
var offTimeout = builder.Configuration.GetValue(ConfigKeys.OpenFoodFactsTimeoutSeconds, 5);
builder.Services.AddHttpClient<IFoodExternalService, OpenFoodFactsService>(client =>
{
    client.BaseAddress = new Uri(offBaseUrl);
    client.Timeout = TimeSpan.FromSeconds(offTimeout);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("FitnessPlatform/1.0 (contact@fitnessplatform.local)");
})
.AddStandardResilienceHandler(options =>
{
    options.Retry.MaxRetryAttempts = 3;
    options.Retry.Delay = TimeSpan.FromSeconds(1);
    options.AttemptTimeout.Timeout = TimeSpan.FromSeconds(offTimeout);
    options.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(offTimeout * 4);
});

// Macro Calculator
builder.Services.AddSingleton<IMacroCalculatorService, MacroCalculatorService>();

// Nutrition Auth Helper (cross-DB link verification)
builder.Services.AddScoped<NutritionAuthHelper>();

// Email
builder.Services.AddScoped<IEmailService, SmtpEmailService>();

// Compliance
builder.Services.AddScoped<IComplianceService, ComplianceService>();

// Audit
builder.Services.AddScoped<IAuditService, AuditService>();

// Exception handling
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

var app = builder.Build();

// Seed data
if (args.Contains("--seed"))
{
    await ApplicationDbContextSeed.SeedAsync(app.Services);
    await MongoSeeder.SeedAsync(app.Services);
    return;
}

// Middleware pipeline
app.UseExceptionHandler();

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
    app.UseHttpsRedirection();
}
app.UseCors(AppPolicies.AllowWebApp);
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.UseFastEndpoints(c =>
{
    c.Endpoints.ShortNames = true;
    c.Errors.UseProblemDetails(x =>
    {
        x.IndicateErrorCode = true;
    });
});
app.UseSwaggerGen();

app.Run();
