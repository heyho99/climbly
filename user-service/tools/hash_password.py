#!/usr/bin/env python3
"""
Utility to generate and verify password hashes compatible with user-service.

Usage examples:
  # Generate hash interactively (password prompt)
  python tools/hash_password.py

  # Generate hash from CLI arg (beware of shell history)
  python tools/hash_password.py --password dev

  # Verify password against an existing hash
  python tools/hash_password.py --verify --password dev --hash "$2b$12$...."
"""
from __future__ import annotations
import argparse
import getpass
import sys
from passlib.context import CryptContext

ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def prompt_password(confirm: bool = True) -> str:
    pw = getpass.getpass("Password: ")
    if confirm:
        pw2 = getpass.getpass("Confirm Password: ")
        if pw != pw2:
            print("Passwords do not match.", file=sys.stderr)
            sys.exit(2)
    return pw


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate/verify bcrypt hashes (passlib)")
    parser.add_argument("--password", help="Plaintext password. If omitted, will prompt.")
    parser.add_argument("--verify", action="store_true", help="Verify given password against --hash")
    parser.add_argument("--hash", dest="hash_", help="Existing hash to verify against")
    args = parser.parse_args()

    if args.verify:
        if not args.hash_:
            print("--verify requires --hash <HASH>", file=sys.stderr)
            sys.exit(2)
        pw = args.password or prompt_password(confirm=False)
        ok = ctx.verify(pw, args.hash_)
        print("OK" if ok else "NG", flush=True)
        sys.exit(0 if ok else 1)

    # generate hash
    pw = args.password or prompt_password(confirm=True)
    hashed = ctx.hash(pw)
    print(hashed)


if __name__ == "__main__":
    main()
