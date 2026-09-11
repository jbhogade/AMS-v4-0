"""Unit tests for crypto.py - PBKDF2 parity with .NET HashUtils and JWT."""

import hashlib
import re
import unittest
from types import SimpleNamespace

import jwt

from ams import crypto

CONFIG = SimpleNamespace(
    JWT_KEY="test-signing-key",
    JWT_ISSUER="AMS-API",
    JWT_AUDIENCE="AMS-App",
    JWT_EXPIRY_MINUTES=480,
)


class Pbkdf2Tests(unittest.TestCase):
    def test_salt_format(self):
        salt = crypto.new_salt()
        self.assertRegex(salt, re.compile(r"^[0-9A-F]{32}$"))

    def test_digest_format_and_reproducibility(self):
        salt = "A1B2C3D4E5F60718293A4B5C6D7E8F90"
        h1 = crypto.hash_password("Test@123", salt)
        h2 = crypto.hash_password("Test@123", salt)
        self.assertEqual(h1, h2)
        self.assertRegex(h1, re.compile(r"^[0-9A-F]{64}$"))

    def test_matches_independent_pbkdf2_sha256(self):
        salt = "A1B2C3D4E5F60718293A4B5C6D7E8F90"
        expected = hashlib.pbkdf2_hmac(
            "sha256", b"Test@123", bytes.fromhex(salt), 100_000, dklen=32
        ).hex().upper()
        self.assertEqual(crypto.hash_password("Test@123", salt), expected)

    def test_verify_accepts_correct_rejects_wrong(self):
        salt = crypto.new_salt()
        digest = crypto.hash_password("Passw0rd!", salt)
        self.assertTrue(crypto.verify_password("Passw0rd!", salt, digest))
        self.assertFalse(crypto.verify_password("wrong", salt, digest))
        self.assertFalse(crypto.verify_password("", salt, digest))


class JwtTests(unittest.TestCase):
    def test_round_trip(self):
        token = crypto.create_token("operator.sys", "Supreme Root", "Operator", CONFIG)
        claims = crypto.validate_token(token, CONFIG)
        self.assertEqual(claims["nameidentifier"], "operator.sys")
        self.assertEqual(claims["role"], "Supreme Root")
        self.assertEqual(claims["name"], "Operator")
        self.assertEqual(claims["sub"], "operator.sys")
        self.assertEqual(claims["iss"], "AMS-API")
        self.assertEqual(claims["aud"], "AMS-App")

    def test_rejects_wrong_key(self):
        token = crypto.create_token("operator.sys", "Supreme Root", "Operator", CONFIG)
        bad = SimpleNamespace(**{**CONFIG.__dict__, "JWT_KEY": "other"})
        with self.assertRaises(jwt.PyJWTError):
            crypto.validate_token(token, bad)

    def test_rejects_garbage(self):
        with self.assertRaises(jwt.PyJWTError):
            crypto.validate_token("not-a-token", CONFIG)


if __name__ == "__main__":
    unittest.main()
