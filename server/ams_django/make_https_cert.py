from datetime import datetime, timedelta, timezone
from pathlib import Path
import ipaddress
import socket
import sys

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

HERE = Path(__file__).resolve().parent
CERT = HERE / "cert.pem"
KEY = HERE / "key.pem"


def local_ipv4s() -> list[str]:
    found: set[str] = set()
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            found.add(info[4][0])
    except OSError:
        pass
    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        probe.connect(("8.8.8.8", 80))
        found.add(probe.getsockname()[0])
        probe.close()
    except OSError:
        pass
    out = []
    for ip in found:
        if ip.startswith("127.") or ip.startswith("169.254."):
            continue
        out.append(ip)
    return sorted(out, key=lambda x: [int(p) for p in x.split(".")])


def main() -> int:
    force = "--force" in sys.argv
    lan_ips = local_ipv4s()
    if CERT.exists() and KEY.exists() and not force:
        print(f"Using existing {CERT.name} and {KEY.name}")
        print("If the browser rejects your PC IP, run: python make_https_cert.py --force")
        return 0
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "AMS Django")])
    now = datetime.now(timezone.utc)
    names = [
        x509.DNSName("localhost"),
        x509.IPAddress(ipaddress.ip_address("127.0.0.1")),
    ]
    for ip in lan_ips:
        names.append(x509.IPAddress(ipaddress.ip_address(ip)))
    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now)
        .not_valid_after(now + timedelta(days=365))
        .add_extension(x509.SubjectAlternativeName(names), critical=False)
        .sign(key, hashes.SHA256())
    )
    KEY.write_bytes(
        key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )
    CERT.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    print(f"Created {CERT.name} and {KEY.name} (self-signed, 365 days)")
    print("Open https://127.0.0.1:<port>/ on this PC.")
    for ip in lan_ips:
        print(f"Open https://{ip}:<port>/ from other devices on the LAN.")
    if not lan_ips:
        print("No LAN IPv4 found. Check ipconfig for IPv4 Address.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
