import sys
try:
    from dropzone_worker.bootstrap import run
except ImportError:
    from .bootstrap import run

if __name__ == "__main__":
    sys.exit(run())

