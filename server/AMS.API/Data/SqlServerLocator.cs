using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;

namespace AMS.API.Data;

/// <summary>
/// Finds a reachable local SQL Server instance at API startup and, when the
/// winner differs from appsettings.json, rewrites only Server= in
/// ConnectionStrings:Default. Probe order matches Setup-AMS-v4-0.bat.
/// </summary>
public static class SqlServerLocator
{
    private static readonly string[] ExtraProbeServers =
    {
        @".\SQLEXPRESS",
        @"localhost\SQLEXPRESS",
        "localhost",
    };

    private const int ConnectTimeoutSeconds = 3;

    public static async Task<string> ResolveAsync(IConfiguration config, string contentRoot, ILogger logger, CancellationToken cancellationToken = default)
    {
        var original = config.GetConnectionString("Default") ?? "";
        if (string.IsNullOrWhiteSpace(original))
        {
            logger.LogError("AMS-v4-0 ConnectionStrings:Default is empty. Set Server= in appsettings.json.");
            return original;
        }

        string configuredServer;
        try
        {
            configuredServer = new SqlConnectionStringBuilder(original).DataSource;
        }
        catch (Exception ex)
        {
            logger.LogError("AMS-v4-0 ConnectionStrings:Default is not a valid SQL connection string. {Error}", ex.Message);
            return original;
        }

        var candidates = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        void Add(string server)
        {
            if (string.IsNullOrWhiteSpace(server)) return;
            if (!seen.Add(NormalizeServerKey(server))) return;
            candidates.Add(server.Trim());
        }

        Add(configuredServer);
        foreach (var server in ExtraProbeServers) Add(server);

        string? winner = null;
        var tried = new List<string>();
        foreach (var server in candidates)
        {
            tried.Add(server);
            try
            {
                var probe = new SqlConnectionStringBuilder(WithServer(original, server))
                {
                    InitialCatalog = "master",
                    ConnectTimeout = ConnectTimeoutSeconds,
                };
                await using var conn = new SqlConnection(probe.ConnectionString);
                await conn.OpenAsync(cancellationToken);
                winner = server;
                break;
            }
            catch (Exception ex)
            {
                logger.LogWarning("AMS-v4-0 SQL Server probe failed for {Server}: {Error}", server, ex.Message);
            }
        }

        if (winner is null)
        {
            logger.LogError("AMS-v4-0 could not reach SQL Server. Tried: {Servers}. Run database/Setup-AMS-v4-0.bat then retry.", string.Join(", ", tried));
            return original;
        }

        logger.LogInformation("AMS-v4-0 using SQL Server instance: {Server}", winner);

        if (ServersEqual(configuredServer, winner)) return original;

        var updated = WithServer(original, winner);
        config["ConnectionStrings:Default"] = updated;
        TryRewriteAppSettings(contentRoot, original, updated, winner, logger);
        return updated;
    }

    internal static string NormalizeServerKey(string server)
    {
        var s = (server ?? "").Trim();
        if (s == "." || s.Equals("localhost", StringComparison.OrdinalIgnoreCase)) return "localhost";
        if (s.StartsWith(".\\", StringComparison.Ordinal)) return "localhost\\" + s[2..];
        if (s.StartsWith("localhost\\", StringComparison.OrdinalIgnoreCase)) return "localhost\\" + s["localhost\\".Length..];
        return s;
    }

    internal static bool ServersEqual(string a, string b) =>
        string.Equals(NormalizeServerKey(a), NormalizeServerKey(b), StringComparison.OrdinalIgnoreCase);

    internal static string WithServer(string connectionString, string server)
    {
        if (Regex.IsMatch(connectionString, @"(^|;)Server=", RegexOptions.IgnoreCase))
            return Regex.Replace(connectionString, @"(?<=(?:^|;)Server=)[^;]*", server, RegexOptions.IgnoreCase);
        if (Regex.IsMatch(connectionString, @"(^|;)Data Source=", RegexOptions.IgnoreCase))
            return Regex.Replace(connectionString, @"(?<=(?:^|;)Data Source=)[^;]*", server, RegexOptions.IgnoreCase);
        var builder = new SqlConnectionStringBuilder(connectionString) { DataSource = server };
        return builder.ConnectionString;
    }

    private static void TryRewriteAppSettings(string contentRoot, string originalCs, string updatedCs, string server, ILogger logger)
    {
        var path = Path.Combine(contentRoot, "appsettings.json");
        try
        {
            var json = File.ReadAllText(path);
            var replaced = json.Replace(JsonSerializer.Serialize(originalCs), JsonSerializer.Serialize(updatedCs));
            if (replaced == json)
            {
                var root = JsonNode.Parse(json)?.AsObject();
                var cs = root?["ConnectionStrings"]?.AsObject();
                if (root is null || cs is null || cs["Default"] is null)
                {
                    logger.LogWarning("AMS-v4-0 could not find ConnectionStrings:Default in appsettings.json. Using in-memory Server={Server}.", server);
                    return;
                }
                cs["Default"] = updatedCs;
                replaced = root.ToJsonString(new JsonSerializerOptions { WriteIndented = true }) + Environment.NewLine;
            }
            File.WriteAllText(path, replaced);
            logger.LogInformation("AMS-v4-0 wrote Server={Server} to appsettings.json", server);
        }
        catch (Exception ex)
        {
            logger.LogWarning("AMS-v4-0 could not write appsettings.json ({Error}). Using in-memory Server={Server}.", ex.Message, server);
        }
    }
}
