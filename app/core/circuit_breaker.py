import time
import logging
import threading
from typing import Callable, Any, Dict

logger = logging.getLogger(__name__)

class CircuitState:
    CLOSED = "CLOSED"        # Normal operation
    OPEN = "OPEN"            # Tripped; external calls fail-fast and return fallback
    HALF_OPEN = "HALF_OPEN"  # Testing external service recovery

class CircuitBreaker:
    def __init__(
        self,
        name: str,
        failure_threshold: int = 4,
        recovery_timeout: float = 35.0,
        expected_exception: type = Exception
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception
        
        self.failure_count = 0
        self.last_failure_time = 0.0
        self.state = CircuitState.CLOSED
        self._lock = threading.Lock()

    def call(self, func: Callable, *args, fallback: Any = None, **kwargs) -> Any:
        with self._lock:
            now = time.time()
            if self.state == CircuitState.OPEN:
                if now - self.last_failure_time > self.recovery_timeout:
                    self.state = CircuitState.HALF_OPEN
                    logger.info(f"CircuitBreaker[{self.name}]: Entering HALF_OPEN state (probing external service).")
                else:
                    logger.warning(f"CircuitBreaker[{self.name}]: Circuit is OPEN. Returning fallback without hitting network.")
                    return fallback() if callable(fallback) else fallback

        try:
            result = func(*args, **kwargs)
            with self._lock:
                if self.state == CircuitState.HALF_OPEN:
                    logger.info(f"CircuitBreaker[{self.name}]: Service probe succeeded. Circuit is reset to CLOSED.")
                self.failure_count = 0
                self.state = CircuitState.CLOSED
            return result
        except self.expected_exception as e:
            with self._lock:
                self.failure_count += 1
                self.last_failure_time = time.time()
                if self.state == CircuitState.HALF_OPEN or self.failure_count >= self.failure_threshold:
                    self.state = CircuitState.OPEN
                    logger.error(f"CircuitBreaker[{self.name}]: Tripped to OPEN state after {self.failure_count} consecutive failures: {e}")
                else:
                    logger.warning(f"CircuitBreaker[{self.name}]: Failure recorded ({self.failure_count}/{self.failure_threshold}): {e}")
            return fallback() if callable(fallback) else fallback


_breakers: Dict[str, CircuitBreaker] = {}
_breaker_lock = threading.Lock()

def get_circuit_breaker(service_name: str, failure_threshold: int = 4, recovery_timeout: float = 35.0) -> CircuitBreaker:
    with _breaker_lock:
        if service_name not in _breakers:
            _breakers[service_name] = CircuitBreaker(service_name, failure_threshold, recovery_timeout)
        return _breakers[service_name]

def execute_with_circuit_breaker(service_name: str, func: Callable, *args, fallback: Any = None, **kwargs) -> Any:
    """
    Executes a callable through the named Circuit Breaker.
    If the circuit is open or the call fails, fallback is safely returned.
    """
    breaker = get_circuit_breaker(service_name)
    return breaker.call(func, *args, fallback=fallback, **kwargs)
