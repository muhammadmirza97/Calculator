"""Launch the calculator in a dedicated browser window with idle shutdown."""

from __future__ import annotations

import ctypes
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


PROJECT_DIR = Path(__file__).resolve().parent
DEFAULT_IDLE_SECONDS = 30 * 60
MUTEX_NAME = "Local\\ScientificCalculatorLauncher"
CREATE_NO_WINDOW = 0x08000000


class ActivityClock:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._last_activity = time.monotonic()

    def touch(self) -> None:
        with self._lock:
            self._last_activity = time.monotonic()

    def idle_for(self) -> float:
        with self._lock:
            return time.monotonic() - self._last_activity


activity_clock = ActivityClock()


class CalculatorRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, directory=str(PROJECT_DIR), **kwargs)

    def do_POST(self) -> None:  # noqa: N802 - inherited HTTP method name
        if urlsplit(self.path).path != "/__activity":
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        activity_clock.touch()
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def log_message(self, _format: str, *_args) -> None:
        return


def show_error(message: str) -> None:
    ctypes.windll.user32.MessageBoxW(0, message, "Scientific Calculator", 0x10)


def acquire_single_instance_mutex():
    mutex = ctypes.windll.kernel32.CreateMutexW(None, False, MUTEX_NAME)
    if not mutex:
        raise OSError("Unable to create the launcher mutex")
    if ctypes.windll.kernel32.GetLastError() == 183:
        ctypes.windll.kernel32.CloseHandle(mutex)
        return None
    return mutex


def find_app_browser() -> Path | None:
    local_app_data = Path(os.environ.get("LOCALAPPDATA", ""))
    program_files = Path(os.environ.get("PROGRAMFILES", ""))
    program_files_x86 = Path(os.environ.get("PROGRAMFILES(X86)", ""))
    candidates = [
        program_files_x86 / "Microsoft/Edge/Application/msedge.exe",
        program_files / "Microsoft/Edge/Application/msedge.exe",
        local_app_data / "Microsoft/Edge/Application/msedge.exe",
        program_files / "Google/Chrome/Application/chrome.exe",
        program_files_x86 / "Google/Chrome/Application/chrome.exe",
        local_app_data / "Google/Chrome/Application/chrome.exe",
    ]
    return next((candidate for candidate in candidates if candidate.is_file()), None)


def start_app_window(url: str, profile_dir: Path) -> subprocess.Popen:
    browser = find_app_browser()
    if browser is None:
        raise FileNotFoundError("Microsoft Edge or Google Chrome is required to open the app window.")
    return subprocess.Popen(
        [
            str(browser),
            f"--app={url}",
            f"--user-data-dir={profile_dir}",
            "--no-first-run",
            "--disable-background-mode",
        ],
        cwd=PROJECT_DIR,
        creationflags=CREATE_NO_WINDOW,
    )


def close_app_window(process: subprocess.Popen | None) -> None:
    if process is None or process.poll() is not None:
        return
    subprocess.run(
        ["taskkill", "/PID", str(process.pid), "/T", "/F"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=CREATE_NO_WINDOW,
        check=False,
    )


def monitor_session(
    server: ThreadingHTTPServer,
    app_process: subprocess.Popen | None,
    idle_seconds: int,
) -> None:
    while True:
        time.sleep(1)
        if app_process is not None and app_process.poll() is not None:
            break
        if activity_clock.idle_for() >= idle_seconds:
            close_app_window(app_process)
            break
    server.shutdown()


def main() -> int:
    mutex = acquire_single_instance_mutex()
    if mutex is None:
        show_error("The calculator is already open.")
        return 0

    idle_seconds = int(os.environ.get("CALCULATOR_IDLE_SECONDS", DEFAULT_IDLE_SECONDS))
    no_browser = "--no-browser" in sys.argv
    profile_dir = Path(tempfile.mkdtemp(prefix="scientific-calculator-"))
    app_process = None
    server = None

    try:
        server = ThreadingHTTPServer(("127.0.0.1", 0), CalculatorRequestHandler)
        port = server.server_address[1]
        url = f"http://127.0.0.1:{port}/?launcher=1"
        if no_browser:
            print(url, flush=True)
        else:
            app_process = start_app_window(url, profile_dir)

        monitor = threading.Thread(
            target=monitor_session,
            args=(server, app_process, idle_seconds),
            daemon=True,
        )
        monitor.start()
        server.serve_forever(poll_interval=0.25)
        return 0
    except Exception as error:
        if no_browser:
            raise
        show_error(str(error))
        return 1
    finally:
        if server is not None:
            server.server_close()
        close_app_window(app_process)
        shutil.rmtree(profile_dir, ignore_errors=True)
        ctypes.windll.kernel32.CloseHandle(mutex)


if __name__ == "__main__":
    raise SystemExit(main())
