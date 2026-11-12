from dropzone_worker.core.lifecycle import WorkerLifecycle

def test_lifecycle_shutdown_callback():
    lifecycle = WorkerLifecycle()
    called = []

    lifecycle.register_shutdown_callback(lambda: called.append(True))
    assert lifecycle.is_running is True
    assert lifecycle.is_shutting_down is False

    lifecycle.trigger_shutdown()
    assert lifecycle.is_running is False
    assert lifecycle.is_shutting_down is True
    assert len(called) == 1

    # Second trigger should not execute callbacks again
    lifecycle.trigger_shutdown()
    assert len(called) == 1
