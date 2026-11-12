import os
import sys
import shutil
import PyInstaller.__main__

def build_worker():
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    worker_src = os.path.join(project_root, "backend", "worker", "src")
    entry_point = os.path.join(worker_src, "dropzone_worker", "__main__.py")
    dist_dir = os.path.join(project_root, "apps", "desktop", "resources", "worker")
    build_dir = os.path.join(project_root, "build", "pyinstaller")

    os.makedirs(dist_dir, exist_ok=True)
    os.makedirs(build_dir, exist_ok=True)

    print(f"[BuildWorker] Packaging standalone worker from: {entry_point}")
    print(f"[BuildWorker] Output directory: {dist_dir}")

    pyinstaller_args = [
        "--name=dropzone-worker",
        "--onefile",
        f"--paths={worker_src}",
        "--hidden-import=dropzone_worker",
        "--hidden-import=dropzone_worker.bootstrap",
        "--collect-all=yt_dlp",
        "--collect-all=gallery_dl",
        f"--distpath={dist_dir}",
        f"--workpath={build_dir}",
        f"--specpath={build_dir}",
        "--clean",
        "--noconfirm",
        entry_point,
    ]

    PyInstaller.__main__.run(pyinstaller_args)

    output_exe = os.path.join(dist_dir, "dropzone-worker.exe" if sys.platform == "win32" else "dropzone-worker")
    if not os.path.isfile(output_exe):
        print(f"[BuildWorker ERROR] Output binary not found: {output_exe}")
        sys.exit(1)

    size_mb = os.path.getsize(output_exe) / (1024 * 1024)
    print(f"[BuildWorker SUCCESS] Standalone worker built: {output_exe} ({size_mb:.2f} MB)")

if __name__ == "__main__":
    build_worker()

