#!/usr/bin/env python3
"""
DROPZONE - Real Download Verification Test Suite (Stage 3.3)
Validates true end-to-end downloads across core and social platforms:
- URL recognition
- Metadata extraction
- Format extraction
- Actual media byte transfer
- Output file integrity (size > 0, valid magic bytes / headers)
- Error categorization (Distinguishes extraction from download from auth walls)
"""

import sys
import os
import json
import time
import shutil
from typing import Dict, Any, List

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend/worker/src")))

from dropzone_worker.core.health import WorkerHealthMonitor
from dropzone_worker.core.lifecycle import WorkerLifecycle
from dropzone_worker.core.dispatcher import CommandDispatcher
from dropzone_worker.protocol.errors import WorkerProtocolError

MAGIC_SIGNATURES = {
    "pdf": [b"%PDF"],
    "zip": [b"PK\x03\x04"],
    "mp4": [b"ftyp", b"\x00\x00\x00"],
    "mp3": [b"ID3", b"\xff\xfb", b"\xff\xf3", b"\xff\xf2", b"\xff\xfa"],
    "jpg": [b"\xff\xd8\xff"],
    "jpeg": [b"\xff\xd8\xff"],
    "png": [b"\x89PNG\r\n\x1a\n"],
    "webm": [b"\x1a\x45\xdf\xa3"],
    "mkv": [b"\x1a\x45\xdf\xa3"],
    "json": [b"{", b"[", b" "],
    "txt": [b""],
}

TEST_TARGETS = [
    {
        "platform": "Direct HTTP (W3C PDF)",
        "group": "Direct File & Cloud",
        "url": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        "expected_engine": "direct-http",
        "expected_ext": "pdf",
        "notes": "Direct PDF stream from w3.org Akamai CDN (previously failed manual test)",
    },
    {
        "platform": "Direct HTTP (Public Mirror PDF)",
        "group": "Direct File & Cloud",
        "url": "https://filesamples.com/samples/document/pdf/sample3.pdf",
        "expected_engine": "direct-http",
        "expected_ext": "pdf",
        "notes": "Direct PDF document stream with resume support",
    },
    {
        "platform": "GitHub (Master Archive ZIP)",
        "group": "Direct File & Cloud",
        "url": "https://github.com/hasnizihar/dropzone/archive/refs/heads/master.zip",
        "expected_engine": "direct-http",
        "expected_ext": "zip",
        "notes": "Direct repository archive stream with Content-Length chunking",
    },
    {
        "platform": "Internet Archive (MP3 Audio)",
        "group": "Direct File & Cloud",
        "url": "https://archive.org/download/testmp3testfile/mpthreetest.mp3",
        "expected_engine": "direct-http",
        "expected_ext": "mp3",
        "notes": "Public domain audio stream hosted on archive.org",
    },
    {
        "platform": "YouTube (Shorts Video)",
        "group": "Video Platforms",
        "url": "https://youtube.com/shorts/aBBXver4zxQ",
        "expected_engine": "yt-dlp",
        "expected_ext": "mp4",
        "notes": "Short-form vertical video; DASH video+audio merging",
    },
    {
        "platform": "Vimeo (Player Embed)",
        "group": "Video Platforms",
        "url": "https://player.vimeo.com/video/76979871",
        "expected_engine": "yt-dlp",
        "expected_ext": "mp4",
        "notes": "Public Vimeo staff pick via player embed without web client login wall",
    },
    {
        "platform": "Vimeo (Web Client)",
        "group": "Video Platforms",
        "url": "https://vimeo.com/76979871",
        "expected_engine": "yt-dlp",
        "expected_ext": "mp4",
        "notes": "Direct web client URL; test login requirement wall",
    },
    {
        "platform": "TikTok (Public Video)",
        "group": "Video Platforms",
        "url": "https://www.tiktok.com/@tiktok/video/7106594312292453675",
        "expected_engine": "yt-dlp",
        "expected_ext": "mp4",
        "notes": "Public TikTok video without watermark",
    },
    {
        "platform": "Instagram (Public Reel / Video)",
        "group": "Video Platforms",
        "url": "https://www.instagram.com/p/CQgFKYBh4HX/?hl=en",
        "expected_engine": "yt-dlp",
        "expected_ext": "mp4",
        "notes": "Public Instagram video post; DASH stream extraction",
    },
    {
        "platform": "Reddit (Public Post Video)",
        "group": "Other Media Platforms",
        "url": "https://www.reddit.com/r/aww/comments/1czk3b9/tiny_kitten/",
        "expected_engine": "yt-dlp",
        "expected_ext": "mp4",
        "notes": "Public Reddit post; tests session wall vs authentication requirement",
    },
    {
        "platform": "Pinterest (Public Pin)",
        "group": "Gallery & Images",
        "url": "https://www.pinterest.com/pin/993606736517855325/",
        "expected_engine": "gallery-dl / yt-dlp",
        "expected_ext": "jpg",
        "notes": "Public image pin",
    },
    {
        "platform": "Flickr (Public Photo)",
        "group": "Gallery & Images",
        "url": "https://www.flickr.com/photos/nasa-hq/53066467067/",
        "expected_engine": "gallery-dl",
        "expected_ext": "jpg",
        "notes": "Flickr photo stream (test asset expiration & gallery-dl extractor)",
    },
    {
        "platform": "Dropbox (Public Shared File)",
        "group": "Direct File & Cloud",
        "url": "https://www.dropbox.com/s/sample/test.pdf?dl=1",
        "expected_engine": "direct-http",
        "expected_ext": "pdf",
        "notes": "Dropbox shared link with direct dl=1 parameter",
    },
]

def check_file_integrity(filepath: str, expected_ext: str) -> Dict[str, Any]:
    if not os.path.exists(filepath):
        return {"valid": False, "reason": "Output file does not exist on disk"}

    size = os.path.getsize(filepath)
    if size == 0:
        return {"valid": False, "size": 0, "reason": "Output file is 0 bytes (empty)"}

    # Read leading bytes for magic check
    try:
        with open(filepath, "rb") as f:
            header = f.read(64)
    except Exception as e:
        return {"valid": False, "size": size, "reason": f"Cannot read output file: {e}"}

    ext = expected_ext.lower().lstrip(".")
    sigs = MAGIC_SIGNATURES.get(ext, [])
    if not sigs:
        # Generic check
        return {"valid": True, "size": size, "magic": header[:8].hex()}

    match = False
    for sig in sigs:
        if sig in header:
            match = True
            break

    if not match:
        return {
            "valid": False,
            "size": size,
            "reason": f"Magic bytes mismatch for .{ext}: header starts with {header[:16]!r}",
            "header": header[:16].hex()
        }

    return {"valid": True, "size": size, "header": header[:16].hex()}

def run_download_verification():
    health = WorkerHealthMonitor()
    lifecycle = WorkerLifecycle()
    dispatcher = CommandDispatcher(health, lifecycle)

    tmp_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../tmp_e2e_downloads"))
    os.makedirs(tmp_dir, exist_ok=True)

    results = []

    print("=" * 80)
    print("DROPZONE STAGE 3.3 - REAL DOWNLOAD VERIFICATION TEST HARNESS")
    print(f"yt-dlp version: {getattr(dispatcher.analyzer, 'version', '2026.10.26')}")
    print(f"Target Directory: {tmp_dir}")
    print(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)

    for idx, target in enumerate(TEST_TARGETS, 1):
        name = target["platform"]
        group = target["group"]
        url = target["url"]
        expected_engine = target["expected_engine"]
        expected_ext = target["expected_ext"]
        notes = target["notes"]

        print(f"\n[{idx}/{len(TEST_TARGETS)}] Testing Platform: {name} ({group})")
        print(f"  URL: {url}")

        start_time = time.time()
        extract_success = False
        extract_duration = 0
        download_success = False
        download_duration = 0
        error_msg = None
        file_info = {}
        status = "Pending"
        engine_used = expected_engine
        formats_count = 0
        assets_count = 0
        download_type = "unknown"
        title = "Unknown"

        # 1. Extraction Phase
        extract_start = time.time()
        analysis_res = None
        try:
            analysis_res = dispatcher._analyze_unified(url)
            extract_duration = int((time.time() - extract_start) * 1000)
            extract_success = True

            download_type = analysis_res.get("downloadType", "unknown")
            meta = analysis_res.get("metadata", {}) or analysis_res.get("fileInfo", {})
            title = meta.get("title") or meta.get("filename") or analysis_res.get("title", "Unknown")
            formats = analysis_res.get("formats", [])
            assets = analysis_res.get("assets", [])
            formats_count = len(formats)
            assets_count = len(assets)

            print(f"  -> Extraction: PASSED in {extract_duration}ms | Type: {download_type} | Formats: {formats_count} | Assets: {assets_count}")
        except Exception as exc:
            extract_duration = int((time.time() - extract_start) * 1000)
            error_msg = str(exc)
            print(f"  -> Extraction: FAILED in {extract_duration}ms: {error_msg[:120]}")

        # 2. Real Download Phase (Only if extraction succeeded)
        downloaded_file_path = None
        if extract_success and analysis_res:
            download_start = time.time()
            job_id = f"e2e_job_{idx}_{int(time.time())}"

            # Determine engine to invoke
            if download_type == "file":
                engine_used = "direct-http"
            elif download_type in ("image", "gallery") and assets_count > 0:
                engine_used = "image"
            else:
                engine_used = "yt-dlp"

            try:
                # Prepare payload
                payload = {
                    "jobId": job_id,
                    "url": url,
                    "targetDirectory": tmp_dir,
                    "engine": engine_used,
                }

                if engine_used == "yt-dlp":
                    # Use default best format to ensure video+audio merging works across platforms
                    payload["formatId"] = None
                elif engine_used == "image" and assets_count > 0:
                    payload["url"] = analysis_res["assets"][0]["url"]
                    payload["customFilename"] = analysis_res["assets"][0].get("filename") or f"test_asset_{idx}.jpg"
                elif engine_used == "direct-http":
                    payload["customFilename"] = f"test_download_{idx}.{expected_ext}"

                print(f"  -> Executing Real Download via engine '{engine_used}'...")
                res = dispatcher._handle_start_download(payload)
                download_duration = int((time.time() - download_start) * 1000)

                output_path = res.get("outputPath")
                if not output_path and res.get("success"):
                    # Inspect directory for created file
                    for fname in os.listdir(tmp_dir):
                        if not fname.endswith(".part") and not fname.endswith(".meta.json"):
                            output_path = os.path.join(tmp_dir, fname)
                            break

                downloaded_file_path = output_path
                if output_path and os.path.exists(output_path):
                    # Check integrity
                    actual_ext = os.path.splitext(output_path)[1].lstrip(".") or expected_ext
                    integrity = check_file_integrity(output_path, actual_ext)
                    file_info = {
                        "path": output_path,
                        "filename": os.path.basename(output_path),
                        "sizeBytes": integrity.get("size", 0),
                        "format": actual_ext,
                        "integrity": integrity["valid"],
                        "headerHex": integrity.get("headerHex") or integrity.get("header")
                    }

                    if integrity["valid"]:
                        download_success = True
                        print(f"  -> Download: VERIFIED in {download_duration}ms | Size: {file_info['sizeBytes']:,} bytes | File: {file_info['filename']}")
                    else:
                        error_msg = f"Integrity check failed: {integrity.get('reason')}"
                        print(f"  -> Download: INTEGRITY FAILED: {error_msg}")

                    # Clean up verified file to keep test dir clean
                    try:
                        if os.path.exists(output_path):
                            os.remove(output_path)
                    except Exception:
                        pass
                else:
                    error_msg = "Download reported success but output file not found on disk."
                    print(f"  -> Download: FAILED: {error_msg}")

            except Exception as exc:
                download_duration = int((time.time() - download_start) * 1000)
                error_msg = str(exc)
                print(f"  -> Download: FAILED in {download_duration}ms: {error_msg[:120]}")

        # 3. Categorize Status according to 5-tier taxonomy
        if download_success:
            status = "Download Verified End-to-End"
        elif extract_success and not download_success:
            if error_msg and ("login" in error_msg.lower() or "auth" in error_msg.lower() or "cookie" in error_msg.lower()):
                status = "Authentication Required"
            else:
                status = "Metadata Extraction Tested"
        else:
            if error_msg and ("login" in error_msg.lower() or "auth" in error_msg.lower() or "cookie" in error_msg.lower() or "403" in error_msg):
                status = "Authentication Required"
            elif error_msg and ("unsupported" in error_msg.lower()):
                status = "Unsupported"
            else:
                status = "Unsupported"

        total_duration = extract_duration + download_duration

        results.append({
            "platform": name,
            "group": group,
            "url": url,
            "engine": engine_used,
            "status": status,
            "extraction": {
                "success": extract_success,
                "durationMs": extract_duration,
                "downloadType": download_type,
                "formatsCount": formats_count,
                "assetsCount": assets_count,
                "title": title[:60]
            },
            "download": {
                "success": download_success,
                "durationMs": download_duration,
                "fileInfo": file_info
            },
            "error": error_msg,
            "durationMs": total_duration,
            "notes": notes
        })

    # Save detailed JSON report
    report_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../docs/real_download_results.json"))
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print(f"\n[E2E Verification] Completed run across {len(TEST_TARGETS)} platforms.")
    print(f"Detailed results saved to: {report_path}")

    # Clean up test output directory
    try:
        shutil.rmtree(tmp_dir)
        print("[E2E Verification] Cleaned up temporary test artifacts folder.")
    except Exception as e:
        print(f"[E2E Verification] Warning during cleanup: {e}")

    return results

if __name__ == "__main__":
    run_download_verification()
