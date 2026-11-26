using System.Text;
using AMS.API.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

// Compress JSON/static responses - the startup bulk payload can be large, so
// gzip/brotli cuts the transfer time noticeably on slower links.
builder.Services.AddResponseCompression(options => options.EnableForHttps = true);

builder.Services.AddSingleton<AmsDb>();

var jwtKey = builder.Configuration["Jwt:Key"];
var usingDefaultJwtKey = string.IsNullOrWhiteSpace(jwtKey) || jwtKey == AmsSecurity.DefaultJwtKey;
if (string.IsNullOrWhiteSpace(jwtKey)) jwtKey = AmsSecurity.DefaultJwtKey;
var issuer = builder.Configuration["Jwt:Issuer"] ?? "AMS-API";
var audience = builder.Configuration["Jwt:Audience"] ?? "AMS-App";

// The bundled signing key is public (it lives in source control), so a token
// signed with it can be forged by anyone. Refuse to start in Production unless
// a real key is configured.
if (usingDefaultJwtKey && builder.Environment.IsProduction())
{
    throw new InvalidOperationException(
        "Jwt:Key is not configured. Set a strong, unique Jwt:Key " +
        "(for example the Jwt__Key environment variable) before running in Production.");
}

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = issuer,
            ValidateAudience = true,
            ValidAudience = audience,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(2),
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        };
    });

builder.Services.AddAuthorization();

// Raise the JSON body size limit so large collections can be uploaded.
builder.Services.Configure<Microsoft.AspNetCore.Server.Kestrel.Core.KestrelServerOptions>(o =>
    o.Limits.MaxRequestBodySize = 32_000_000);

var app = builder.Build();

if (usingDefaultJwtKey)
{
    app.Logger.LogWarning(
        "Using the built-in development JWT signing key. Set Jwt:Key (env Jwt__Key) " +
        "before any shared or production deployment.");
}
if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(AmsSecurity.SeedOperatorPasswordEnv))
    || string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(AmsSecurity.SeedAdminPasswordEnv)))
{
    app.Logger.LogWarning(
        "Seeded login accounts use the built-in development passwords. Set " +
        "{OperatorEnv} and {AdminEnv} before any shared or production deployment.",
        AmsSecurity.SeedOperatorPasswordEnv, AmsSecurity.SeedAdminPasswordEnv);
}

app.UseResponseCompression();

// A down/unreachable SQL Server surfaces as a bare HTTP 500 today, which the
// frontend shows as "API error 500" with no explanation. Turn SqlExceptions
// into a clear 503 + JSON message so the UI can explain what went wrong.
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        var ex = context.Features.Get<IExceptionHandlerFeature>()?.Error;
        context.Response.ContentType = "application/json; charset=utf-8";
        // Log the details server-side; never echo SQL/exception text to the
        // client, since it can reveal server names and internal structure.
        if (ex is SqlException)
        {
            app.Logger.LogError(ex, "Database request failed.");
            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            await context.Response.WriteAsJsonAsync(new
            {
                error = "Database unavailable. Check that SQL Server is running and that the AMS database is initialized, then restart the API.",
            });
            return;
        }
        app.Logger.LogError(ex, "Unhandled server error.");
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await context.Response.WriteAsJsonAsync(new
        {
            error = "Unexpected server error.",
        });
    });
});

var resolvedCs = await SqlServerLocator.ResolveAsync(app.Configuration, app.Environment.ContentRootPath, app.Logger);

// Create the database, schema and seeded Supreme Root login (all idempotent).
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AmsDb>();
    db.ApplyConnectionString(resolvedCs);
    try
    {
        await db.InitializeAsync();
    }
    catch (Exception ex)
    {
        app.Logger.LogError("AMS-v4-0 database init failed. Run database/Setup-AMS-v4-0.bat then retry. {Error}", ex.Message);
    }
}

// ---- Serve the AMS-v4-0 frontend from the project root ----------------------
// The API project lives at <AMS-v4-0>/server/AMS.API and the web UI at the
// AMS-v4-0 root (index.html, pages/, css/, js/, assets/). Serve that folder so
// the API and the UI are same-origin (no CORS, one URL to open).
var webRoot = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "..", ".."));

// The backend source, SQL scripts, git metadata and dotfiles live beside the
// web UI in the project root. Never expose them through the static file
// middleware (appsettings.json alone would leak the JWT key and DB connection).
app.Use(async (context, next) =>
{
    var path = context.Request.Path.Value ?? string.Empty;
    var blocked =
        path.StartsWith("/server", StringComparison.OrdinalIgnoreCase) ||
        path.StartsWith("/database", StringComparison.OrdinalIgnoreCase) ||
        path.StartsWith("/.git", StringComparison.OrdinalIgnoreCase) ||
        (path.Length > 1 && path[1] == '.');
    if (blocked)
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        return;
    }
    await next();
});

if (Directory.Exists(webRoot))
{
    AmsDb.EnsureBackupFolder(webRoot);
    var fileProvider = new PhysicalFileProvider(webRoot);
    app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = fileProvider });
    app.UseStaticFiles(new StaticFileOptions { FileProvider = fileProvider });
}

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapGet("/api/health", () => Results.Json(new
{
    ok = true,
    app = "AMS-v4-0 API",
    database = "AMS-v4-0",
}));

app.Run();
