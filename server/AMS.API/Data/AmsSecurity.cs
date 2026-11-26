namespace AMS.API.Data;

/// <summary>
/// Development-only security fallbacks, kept in one place so it is obvious
/// which values must be supplied by configuration/environment before the API
/// runs outside a local development machine. Startup refuses to run in the
/// Production environment while any of these defaults is still in use.
/// </summary>
public static class AmsSecurity
{
    /// <summary>Development-only JWT signing key. Override with <c>Jwt__Key</c>.</summary>
    public const string DefaultJwtKey =
        "AmsTestDbLoginSigningKey_2026_ChangeMeInProduction_0123456789ABCDEF";

    /// <summary>Development-only seed passwords. Override with the matching env var.</summary>
    public const string DefaultSeedOperatorPassword = "Sr#Ops@2026";
    public const string DefaultSeedAdminPassword = "Admin@#$12345";

    public const string SeedOperatorPasswordEnv = "AMS_SEED_OPERATOR_PASSWORD";
    public const string SeedAdminPasswordEnv = "AMS_SEED_ADMIN_PASSWORD";
}
