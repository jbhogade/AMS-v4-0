using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using AMS.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;

namespace AMS.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AmsDb _db;
    private readonly IConfiguration _config;

    public AuthController(AmsDb db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    public record LoginRequest(string Username, string Password);

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Username) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { error = "Username and password are required." });

        var user = await _db.FindUserAsync(req.Username.Trim());
        if (user is null || !user.Active)
            return Unauthorized(new { error = "Invalid username or password." });

        if (!_db.VerifyPassword(user, req.Password))
            return Unauthorized(new { error = "Invalid username or password." });

        var token = CreateToken(user);
        return Ok(new
        {
            token,
            username = user.Username,
            role = user.Role,
            name = user.DisplayName ?? user.LinkedEmployee ?? user.Username,
            displayName = user.DisplayName ?? user.LinkedEmployee ?? user.Username,
            linkedEmployee = user.LinkedEmployee,
            email = user.Email,
            contactNo = user.ContactNo,
            address = user.Address,
            dob = user.Dob,
            gender = user.Gender,
        });
    }

    /* ---- Profile: GET full account + update display fields / password --------- */

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me()
    {
        var username = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (username is null) return Unauthorized();
        var user = await _db.FindUserAsync(username);
        if (user is null) return Unauthorized();
        return Ok(ToProfile(user));
    }

    public record UpdateProfileRequest(
        string? DisplayName, string? Email, string? ContactNo, string? Address,
        string? Dob, string? Gender, string? CurrentPassword, string? NewPassword);

    [HttpPut("me")]
    [Authorize]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest req)
    {
        var username = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (username is null) return Unauthorized();
        var user = await _db.FindUserAsync(username);
        if (user is null) return Unauthorized();

        // Changing the password requires the current password to be verified.
        if (!string.IsNullOrWhiteSpace(req.NewPassword))
        {
            if (string.IsNullOrWhiteSpace(req.CurrentPassword) || !_db.VerifyPassword(user, req.CurrentPassword))
                return BadRequest(new { error = "Current password is incorrect." });
        }

        await _db.UpdateUserAsync(username, req.NewPassword, null, user.LinkedEmployee,
            string.IsNullOrWhiteSpace(req.Email) ? user.Email : req.Email.Trim(), user.Remarks,
            null, req.DisplayName, req.ContactNo, req.Address, req.Dob, req.Gender);

        var updated = await _db.FindUserAsync(username);
        return Ok(updated is null ? ToProfile(user) : ToProfile(updated));
    }

    /* ---- User management (User Master syncs login accounts to ams_users) ------ */

    public record CreateUserRequest(string Username, string Password, string Role,
        string? LinkedEmployee, string? Email, string? Remarks, bool Active);

    [HttpPost("users")]
    [Authorize]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest req)
    {
        var callerRole = User.FindFirstValue(ClaimTypes.Role);
        var username = (req.Username ?? "").Trim();

        // Only a Super Root or above can create login accounts.
        if (callerRole is not ("Super Root" or "Supreme Root"))
            return Forbid();

        // Supreme Root accounts can only be created by a Supreme Root.
        if (req.Role == "Supreme Root" && callerRole != "Supreme Root")
            return Forbid();

        if (username.Length == 0 || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { error = "Username and password are required." });

        var existing = await _db.FindUserAsync(username);
        if (existing is not null)
            return Conflict(new { error = $"Username '{username}' already exists." });

        await _db.CreateUserAsync(username, req.Password, req.Role, req.LinkedEmployee,
            req.Email, req.Remarks, req.Active);
        return Ok(new { ok = true, username, role = req.Role });
    }

    public record UpdateUserRequest(string? Password, string? Role, string? LinkedEmployee,
        string? Email, string? Remarks, bool? Active, string? DisplayName, string? ContactNo,
        string? Address, string? Dob, string? Gender);

    [HttpPut("users/{username}")]
    [Authorize]
    public async Task<IActionResult> UpdateUser(string username, [FromBody] UpdateUserRequest req)
    {
        var callerRole = User.FindFirstValue(ClaimTypes.Role);
        if (callerRole is not ("Super Root" or "Supreme Root")) return Forbid();

        var user = await _db.FindUserAsync(username);
        if (user is null) return NotFound(new { error = $"User '{username}' not found." });

        // Only a Supreme Root may promote/demote a Supreme Root account, and a
        // Supreme Root account can only be changed by a Supreme Root.
        if ((user.Role == "Supreme Root" || req.Role == "Supreme Root") && callerRole != "Supreme Root")
            return Forbid();

        await _db.UpdateUserAsync(username, req.Password, req.Role, req.LinkedEmployee,
            req.Email, req.Remarks, req.Active, req.DisplayName, req.ContactNo,
            req.Address, req.Dob, req.Gender);
        return Ok(new { ok = true, username });
    }

    [HttpDelete("users/{username}")]
    [Authorize]
    public async Task<IActionResult> DeleteUser(string username)
    {
        var callerRole = User.FindFirstValue(ClaimTypes.Role);
        if (callerRole is not ("Super Root" or "Supreme Root")) return Forbid();

        var user = await _db.FindUserAsync(username);
        if (user is null) return NotFound(new { error = $"User '{username}' not found." });

        // Supreme Root accounts can never be deleted; Super Root accounts can
        // only be deleted by a Supreme Root.
        if (user.Role == "Supreme Root") return Forbid();
        if (user.Role == "Super Root" && callerRole != "Supreme Root") return Forbid();

        await _db.DeleteUserAsync(username);
        return Ok(new { ok = true, username });
    }

    [HttpGet("users")]
    [Authorize]
    public async Task<IActionResult> ListUsers()
    {
        var callerRole = User.FindFirstValue(ClaimTypes.Role);
        if (callerRole is not ("Super Root" or "Supreme Root")) return Forbid();

        var users = await _db.ListUsersAsync();
        return Ok(users.Select(u => new
        {
            username = u.Username,
            role = u.Role,
            displayName = u.DisplayName,
            linkedEmployee = u.LinkedEmployee,
            email = u.Email,
            remarks = u.Remarks,
            active = u.Active,
        }));
    }

    /* ---- Helpers -------------------------------------------------------------- */

    private object ToProfile(AmsUser user) => new
    {
        username = user.Username,
        role = user.Role,
        name = user.DisplayName ?? user.LinkedEmployee ?? user.Username,
        displayName = user.DisplayName,
        linkedEmployee = user.LinkedEmployee,
        email = user.Email,
        contactNo = user.ContactNo,
        address = user.Address,
        dob = user.Dob,
        gender = user.Gender,
        remarks = user.Remarks,
    };

    private string CreateToken(AmsUser user)
    {
        var jwtKey = _config["Jwt:Key"] ?? "AmsTestDbLoginSigningKey_2026_ChangeMeInProduction_0123456789ABCDEF";
        var issuer = _config["Jwt:Issuer"] ?? "AMS-API";
        var audience = _config["Jwt:Audience"] ?? "AMS-App";
        var expiryMinutes = int.TryParse(_config["Jwt:ExpiryMinutes"], out var m) ? m : 480;

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Username),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new Claim(ClaimTypes.NameIdentifier, user.Username),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim(ClaimTypes.Name, user.DisplayName ?? user.LinkedEmployee ?? user.Username),
        };

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: DateTime.UtcNow.AddMinutes(expiryMinutes),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
