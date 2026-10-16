import time
from app.core.circuit_breaker import CircuitBreaker, CircuitState, execute_with_circuit_breaker

def test_circuit_breaker_normal_execution():
    cb = CircuitBreaker("test_service", failure_threshold=2, recovery_timeout=0.5)
    result = cb.call(lambda: "success_data", fallback="fallback_data")
    assert result == "success_data"
    assert cb.state == CircuitState.CLOSED
    assert cb.failure_count == 0


def test_circuit_breaker_trips_to_open():
    cb = CircuitBreaker("test_failing_service", failure_threshold=2, recovery_timeout=0.2)
    
    def failing_fn():
        raise ConnectionError("External service down")

    # First failure
    res1 = cb.call(failing_fn, fallback="fallback_val")
    assert res1 == "fallback_val"
    assert cb.failure_count == 1
    assert cb.state == CircuitState.CLOSED

    # Second failure -> should trip circuit to OPEN
    res2 = cb.call(failing_fn, fallback="fallback_val")
    assert res2 == "fallback_val"
    assert cb.state == CircuitState.OPEN

    # While OPEN, fails fast without executing the function
    executed = False
    def track_fn():
        nonlocal executed
        executed = True
        return "ok"

    res3 = cb.call(track_fn, fallback="fast_fail_val")
    assert res3 == "fast_fail_val"
    assert executed is False  # Network was never touched!


def test_circuit_breaker_recovery_half_open():
    cb = CircuitBreaker("test_recovery", failure_threshold=1, recovery_timeout=0.1)

    # Trip circuit
    cb.call(lambda: (_ for _ in ()).throw(ValueError("Error")), fallback=[])
    assert cb.state == CircuitState.OPEN

    # Wait for recovery timeout
    time.sleep(0.15)

    # Next call should be in HALF_OPEN and succeed
    res = cb.call(lambda: ["recovered"], fallback=[])
    assert res == ["recovered"]
    assert cb.state == CircuitState.CLOSED
    assert cb.failure_count == 0


def test_execute_with_circuit_breaker_helper():
    res = execute_with_circuit_breaker("custom_breaker", lambda: 42, fallback=0)
    assert res == 42
