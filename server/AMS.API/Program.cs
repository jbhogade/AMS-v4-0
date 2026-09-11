using System.Text;
using AMS.API.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

builder.Services.AddSingleton<AmsDb>();

var jwtKey = builder.Configuration["Jwt:Key"] ?? "AmsTestDbLoginSigningKey_2026_ChangeMeInProduction_0123456789ABCDEF";
var issuer = builder.Configuration["Jwt:Issuer"] ?? "AMS-API";
var audience = builder.Configuration["Jwt:Audience"] ?? "AMS-App";

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

builder.Services.AddCors(options =>
{
    options.AddPolicy("AMS", policy =>
        policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
});

// Raise the JSON body size limit so large collections can be uploaded.
builder.Services.Configure<Microsoft.AspNetCore.Server.Kestrel.Core.KestrelServerOptions>(o =>
    o.Limits.MaxRequestBodySize = 32_000_000);

var app = builder.Build();

// A down/unreachable SQL Server surfaces as a bare HTTP 500 today, which the
// frontend shows as "API error 500" with no explanation. Turn SqlExceptions
// into a clear 503 + JSON message so the UI can explain what went wrong.
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        var ex = context.Features.Get<IExceptionHandlerFeature>()?.Error;
        if (ex is SqlException)
        {
            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            context.Response.ContentType = "application/json; charset=utf-8";
            await context.Response.WriteAsJsonAsync(new
            {
                error = "Database unavailable. Check that SQL Server is running and run database/Setup-AMS-TEST.bat, then restart the API.",
            });
        }
    });
});

// Create the database, schema and seeded Supreme Root login (all idempotent).
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AmsDb>();
    try
    {
        await db.InitializeAsync();
    }
    catch (Exception ex)
    {
        app.Logger.LogError("AMS-TEST database init failed. Run database/Setup-AMS-TEST.bat then retry. {Error}", ex.Message);
    }
}

// ---- Serve the AMS-Test frontend from the project root ----------------------
// The API project lives at <AMS-Test>/server/AMS.API and the web UI at the
// AMS-Test root (index.html, pages/, css/, js/, assets/). Serve that folder so
// the API and the UI are same-origin (no CORS, one URL to open).
var webRoot = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "..", ".."));
if (Directory.Exists(webRoot))
{
    var fileProvider = new PhysicalFileProvider(webRoot);
    app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = fileProvider });
    app.UseStaticFiles(new StaticFileOptions { FileProvider = fileProvider });
}

app.UseCors("AMS");
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapGet("/api/health", () => Results.Json(new
{
    ok = true,
    app = "AMS-Test API",
    database = "AMS-TEST",
}));

app.Run();
