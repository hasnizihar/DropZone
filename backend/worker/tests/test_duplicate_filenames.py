import os
import tempfile
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
import pytest

from dropzone_worker.services.direct_stream_engine import (
    DirectStreamEngine,
    split_base_and_ext,
    resolve_unique_filename,
)
from dropzone_worker.services.direct_http_service import DirectHttpService

TEST_DATA = b"X" * (128 * 1024)  # 128 KB test file

class DuplicateTestHttpHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_HEAD(self):
        if self.path == "/10Mb.dat":
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(len(TEST_DATA)))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("ETag", '"etag-10mb"')
            self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        if self.path == "/10Mb.dat":
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(len(TEST_DATA)))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("ETag", '"etag-10mb"')
            self.end_headers()
            self.wfile.write(TEST_DATA)
        else:
            self.send_response(404)
            self.end_headers()


@pytest.fixture(scope="module")
def local_test_server():
    server = HTTPServer(("127.0.0.1", 0), DuplicateTestHttpHandler)
    port = server.server_port
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{port}"
    server.shutdown()


def test_split_base_and_ext():
    assert split_base_and_ext("10Mb.dat") == ("10Mb", ".dat")
    assert split_base_and_ext("archive.tar.gz") == ("archive", ".tar.gz")
    assert split_base_and_ext("archive.tar.bz2") == ("archive", ".tar.bz2")
    assert split_base_and_ext("data.tar.xz") == ("data", ".tar.xz")
    assert split_base_and_ext("noextension") == ("noextension", "")
    assert split_base_and_ext("file.part.meta.json") == ("file", ".part.meta.json")


def test_resolve_unique_filename():
    with tempfile.TemporaryDirectory() as tmpdir:
        # 1. Target directory empty -> original filename returned
        name0 = resolve_unique_filename(tmpdir, "10Mb.dat")
        assert name0 == "10Mb.dat"

        # 2. File exists on disk -> increment counter
        with open(os.path.join(tmpdir, "10Mb.dat"), "wb") as f:
            f.write(b"existing-file-content")

        name1 = resolve_unique_filename(tmpdir, "10Mb.dat")
        assert name1 == "10Mb (1).dat"

        # 3. .part file exists on disk -> increment counter
        with open(os.path.join(tmpdir, "10Mb (1).dat.part"), "wb") as f:
            f.write(b"partial-data")

        name2 = resolve_unique_filename(tmpdir, "10Mb.dat")
        assert name2 == "10Mb (2).dat"

        # 4. .part.meta.json exists on disk -> increment counter
        with open(os.path.join(tmpdir, "10Mb (2).dat.part.meta.json"), "w") as f:
            f.write("{}")

        name3 = resolve_unique_filename(tmpdir, "10Mb.dat")
        assert name3 == "10Mb (3).dat"


def test_direct_stream_engine_duplicate_downloads_isolation(local_test_server):
    """
    Verifies that running two downloads of the same URL with unique filenames
    produces distinct files on disk, does not overwrite the first file, and
    does not hijack sidecar metadata.
    """
    events = []

    def mock_event(event_name, payload):
        events.append((event_name, payload))

    engine = DirectStreamEngine(
        write_event_fn=mock_event,
        http_service=DirectHttpService(),
    )

    test_url = f"{local_test_server}/10Mb.dat"

    with tempfile.TemporaryDirectory() as tmpdir:
        # Download 1: 10Mb.dat
        res1 = engine.execute_download(
            url=test_url,
            target_directory=tmpdir,
            job_id="job_1",
            custom_filename="10Mb.dat",
            allow_loopback=True,
        )

        file1_path = os.path.join(tmpdir, "10Mb.dat")
        assert os.path.exists(file1_path)
        assert os.path.getsize(file1_path) == len(TEST_DATA)
        assert res1["outputPath"] == file1_path

        # Download 2: Same URL, allocated unique custom_filename "10Mb (1).dat"
        res2 = engine.execute_download(
            url=test_url,
            target_directory=tmpdir,
            job_id="job_2",
            custom_filename="10Mb (1).dat",
            allow_loopback=True,
        )

        file2_path = os.path.join(tmpdir, "10Mb (1).dat")
        assert os.path.exists(file2_path)
        assert os.path.getsize(file2_path) == len(TEST_DATA)
        assert res2["outputPath"] == file2_path

        # CRITICAL ASSERTIONS:
        # 1. file1 must still exist and NOT have been overwritten by file2
        with open(file1_path, "rb") as f1:
            assert f1.read() == TEST_DATA

        # 2. file2 must contain its own distinct data
        with open(file2_path, "rb") as f2:
            assert f2.read() == TEST_DATA

        # 3. Output paths must be completely distinct
        assert res1["outputPath"] != res2["outputPath"]
        assert os.path.basename(res1["outputPath"]) == "10Mb.dat"
        assert os.path.basename(res2["outputPath"]) == "10Mb (1).dat"
