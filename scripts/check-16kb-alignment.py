#!/usr/bin/env python3
"""
check-16kb-alignment.py

Checks that all .so files in an APK/AAB have ELF LOAD segments aligned
to 16KB (0x4000), as required by Google Play for Android 15+ devices.

Usage:
    python3 scripts/check-16kb-alignment.py path/to/app.apk
    python3 scripts/check-16kb-alignment.py path/to/app.aab

Requires: Python 3.6+, no external dependencies.
"""

import sys
import struct
import zipfile
import os

REQUIRED_ALIGNMENT = 0x4000  # 16384 bytes


def check_elf_alignment(data: bytes, filename: str) -> bool:
    """
    Parses ELF LOAD segment alignment from raw bytes.
    Returns True if all LOAD segments are aligned to >= 16KB.
    """
    if len(data) < 64 or data[:4] != b'\x7fELF':
        print(f"  SKIP  {filename} — not an ELF file")
        return True  # not our concern

    # ELF header fields (little-endian, 64-bit)
    ei_class = data[4]  # 1 = 32-bit, 2 = 64-bit
    is_64bit = (ei_class == 2)

    if is_64bit:
        # e_phoff at offset 32, e_phentsize at 54, e_phnum at 56
        e_phoff     = struct.unpack_from('<Q', data, 32)[0]
        e_phentsize = struct.unpack_from('<H', data, 54)[0]
        e_phnum     = struct.unpack_from('<H', data, 56)[0]
        pt_load     = 1
        align_offset = 48  # p_align offset within a 64-bit Phdr
    else:
        # 32-bit ELF
        e_phoff     = struct.unpack_from('<I', data, 28)[0]
        e_phentsize = struct.unpack_from('<H', data, 42)[0]
        e_phnum     = struct.unpack_from('<H', data, 44)[0]
        pt_load     = 1
        align_offset = 28  # p_align offset within a 32-bit Phdr

    all_ok = True
    for i in range(e_phnum):
        offset = e_phoff + i * e_phentsize
        if offset + e_phentsize > len(data):
            break

        p_type = struct.unpack_from('<I', data, offset)[0]
        if p_type != pt_load:
            continue

        if is_64bit:
            p_align = struct.unpack_from('<Q', data, offset + align_offset)[0]
        else:
            p_align = struct.unpack_from('<I', data, offset + align_offset)[0]

        if p_align < REQUIRED_ALIGNMENT:
            print(f"  FAIL  {filename}")
            print(f"        LOAD segment {i}: alignment=0x{p_align:x} "
                  f"(need >= 0x{REQUIRED_ALIGNMENT:x} / 16KB)")
            all_ok = False

    if all_ok:
        print(f"  OK    {filename}")

    return all_ok


def check_archive(path: str) -> bool:
    print(f"\nChecking: {path}\n")
    all_pass = True

    with zipfile.ZipFile(path, 'r') as zf:
        so_files = [n for n in zf.namelist() if n.endswith('.so')]

        if not so_files:
            print("  No .so files found in archive.")
            return True

        for name in sorted(so_files):
            data = zf.read(name)
            ok = check_elf_alignment(data, name)
            if not ok:
                all_pass = False

    print()
    if all_pass:
        print("✅  All .so files meet the 16KB page-alignment requirement.")
    else:
        print("❌  Some .so files do NOT meet the 16KB page-alignment requirement.")
        print("    Rebuild with: bash scripts/build-android.sh")
        print("    Ensure Cargo.toml has: rustflags = [\"-C\", \"link-arg=-Wl,-z,max-page-size=16384\"]")
        print("    Ensure build.gradle has: cFlags \"-Wl,-z,max-page-size=16384\"")

    return all_pass


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(f"Usage: python3 {sys.argv[0]} <path-to-apk-or-aab>")
        sys.exit(1)

    path = sys.argv[1]
    if not os.path.exists(path):
        print(f"File not found: {path}")
        sys.exit(1)

    ok = check_archive(path)
    sys.exit(0 if ok else 1)
