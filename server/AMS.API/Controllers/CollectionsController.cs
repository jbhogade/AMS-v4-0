using System.Text.Json;
using AMS.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AMS.API.Controllers;

/// <summary>
/// Generic JSON-document collections. The frontend treats each business entity
/// (assets, employees, masters, settings, ...) as an in-memory array that it
/// PUTs back wholesale whenever a record changes. SQL Server is the single
/// source of truth; the arrays are just a live cache of the JSON document.
/// </summary>
[ApiController]
[Route("api/collection")]
[Authorize]
public class CollectionsController : ControllerBase
{
    private static readonly HashSet<string> AllowedKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "assets", "employees", "assetTypes", "assetMakes", "assetCategories",
        "sites", "departments", "designations", "vendors", "consumables",
        "spareParts", "accessories", "mobiles", "company", "roleAccess", "accessRights",
        "reportPrefs", "users", "exitRecords", "consumableLog", "sparePartLog",
        "simCards", "simOperators", "simPlans", "consumableCategories",
        "consumableUnits", "sparePartCategories", "vendorCategories",
    };

    private readonly AmsDb _db;

    public CollectionsController(AmsDb db)
    {
        _db = db;
    }

    [HttpGet("{key}")]
    public async Task<IActionResult> Get(string key)
    {
        if (!AllowedKeys.Contains(key))
            return NotFound(new { error = $"Unknown collection: {key}" });

        var json = await _db.GetCollectionAsync(key);
        if (string.IsNullOrWhiteSpace(json))
            return Ok("[]");

        try
        {
            return Content(json, "application/json; charset=utf-8");
        }
        catch (JsonException)
        {
            return Ok("[]");
        }
    }

    [HttpPut("{key}")]
    public async Task<IActionResult> Put(string key, [FromBody] JsonElement body)
    {
        if (!AllowedKeys.Contains(key))
            return NotFound(new { error = $"Unknown collection: {key}" });

        // A collection is either an array (assets, employees, masters, ...) or
        // a single document object (company, roleAccess, reportPrefs, ...).
        if (body.ValueKind != JsonValueKind.Array && body.ValueKind != JsonValueKind.Object)
            return BadRequest(new { error = "Body must be a JSON array or object." });

        var json = body.GetRawText();
        if (json.Length > 16_000_000) // 16 MB safety cap
            return BadRequest(new { error = "Payload too large." });

        try
        {
            await _db.SaveCollectionAsync(key, json);
        }
        catch (CollectionSaveException ex)
        {
            /* Duplicate natural key (record_key) - report the offending key so
               the user can fix the data instead of seeing a generic 500. */
            return Conflict(new { error = ex.Message });
        }
        return Ok(new { ok = true, collection = key });
    }

    [HttpDelete("{key}")]
    public async Task<IActionResult> Clear(string key)
    {
        if (!AllowedKeys.Contains(key))
            return NotFound(new { error = $"Unknown collection: {key}" });

        await _db.SaveCollectionAsync(key, "[]");
        return Ok(new { ok = true, collection = key, count = 0 });
    }
}
