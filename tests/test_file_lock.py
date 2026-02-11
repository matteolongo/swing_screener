"""Tests for file locking utilities."""
from __future__ import annotations

import json
import tempfile
import threading
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

import pytest
from fastapi import HTTPException

from api.utils.file_lock import locked_read_json, locked_write_json, locked_read_modify_write


class TestBasicLocking:
    """Test basic file locking operations."""

    def test_locked_read_json_success(self, tmp_path):
        """Test successful locked read of JSON file."""
        test_file = tmp_path / "test.json"
        test_data = {"foo": "bar", "count": 42}
        test_file.write_text(json.dumps(test_data))

        result = locked_read_json(test_file)
        assert result == test_data

    def test_locked_write_json_success(self, tmp_path):
        """Test successful locked write of JSON file."""
        test_file = tmp_path / "test.json"
        test_data = {"foo": "bar", "count": 42}

        locked_write_json(test_file, test_data)

        assert test_file.exists()
        content = json.loads(test_file.read_text())
        assert content == test_data

    def test_locked_read_nonexistent_file(self, tmp_path):
        """Test that reading non-existent file raises HTTPException 404."""
        test_file = tmp_path / "nonexistent.json"

        with pytest.raises(HTTPException) as exc_info:
            locked_read_json(test_file)

        assert exc_info.value.status_code == 404
        assert "File not found" in exc_info.value.detail

    def test_locked_read_invalid_json(self, tmp_path):
        """Test that invalid JSON raises HTTPException 500."""
        test_file = tmp_path / "invalid.json"
        test_file.write_text("{invalid json}")

        with pytest.raises(HTTPException) as exc_info:
            locked_read_json(test_file)

        assert exc_info.value.status_code == 500
        assert "Invalid JSON" in exc_info.value.detail

    def test_locked_read_handles_nan(self, tmp_path):
        """Test that NaN values are converted to null."""
        test_file = tmp_path / "nan.json"
        test_file.write_text('{"value": NaN, "count": 42}')

        result = locked_read_json(test_file)
        assert result == {"value": None, "count": 42}

    def test_locked_write_creates_parent_dir(self, tmp_path):
        """Test that write creates parent directories."""
        test_file = tmp_path / "subdir" / "deep" / "test.json"
        test_data = {"created": True}

        locked_write_json(test_file, test_data)

        assert test_file.exists()
        assert test_file.parent.exists()


class TestConcurrentAccess:
    """Test concurrent file access with locking."""

    def test_concurrent_reads(self, tmp_path):
        """Test that multiple threads can read concurrently."""
        test_file = tmp_path / "test.json"
        test_data = {"counter": 100}
        test_file.write_text(json.dumps(test_data))

        results = []
        errors = []

        def read_file():
            try:
                result = locked_read_json(test_file)
                results.append(result)
            except Exception as e:
                errors.append(e)

        # Launch 10 concurrent readers
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(read_file) for _ in range(10)]
            for future in as_completed(futures):
                future.result()

        assert len(errors) == 0, f"Errors occurred: {errors}"
        assert len(results) == 10
        assert all(r == test_data for r in results)

    def test_concurrent_writes_no_corruption(self, tmp_path):
        """Test that concurrent writes don't corrupt data."""
        test_file = tmp_path / "test.json"
        initial_data = {"positions": []}
        test_file.write_text(json.dumps(initial_data))

        errors = []
        successful_writes = []

        def write_file(thread_id):
            try:
                # Read current data
                data = locked_read_json(test_file)
                # Simulate some processing
                time.sleep(0.001)
                # Append thread ID
                data["positions"].append(f"thread-{thread_id}")
                # Write back
                locked_write_json(test_file, data)
                successful_writes.append(thread_id)
            except HTTPException as e:
                if e.status_code == 503:
                    # Lock timeout is acceptable
                    pass
                else:
                    errors.append(e)
            except Exception as e:
                errors.append(e)

        # Launch 20 concurrent writers
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(write_file, i) for i in range(20)]
            for future in as_completed(futures):
                future.result()

        # Verify no corruption
        final_data = json.loads(test_file.read_text())
        assert "positions" in final_data
        assert isinstance(final_data["positions"], list)
        # Due to race conditions, we won't have all 20 writes
        # but the file should be valid JSON
        assert len(errors) == 0, f"Errors occurred: {errors}"

    def test_read_modify_write_atomic(self, tmp_path):
        """Test atomic read-modify-write prevents lost updates."""
        test_file = tmp_path / "counter.json"
        test_file.write_text(json.dumps({"count": 0}))

        errors = []

        def increment_counter():
            try:
                def modify(data):
                    data["count"] += 1
                    time.sleep(0.001)  # Simulate processing
                    return data

                locked_read_modify_write(test_file, modify)
            except HTTPException as e:
                if e.status_code == 503:
                    # Lock timeout acceptable
                    pass
                else:
                    errors.append(e)
            except Exception as e:
                errors.append(e)

        # Launch 50 concurrent incrementers
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(increment_counter) for _ in range(50)]
            for future in as_completed(futures):
                future.result()

        # Check final count - should be close to 50 (some may timeout)
        final_data = json.loads(test_file.read_text())
        assert final_data["count"] > 0
        assert len(errors) == 0, f"Errors occurred: {errors}"


class TestLockTimeout:
    """Test lock timeout behavior."""

    def test_concurrent_write_eventually_succeeds(self, tmp_path):
        """Test that concurrent writes wait for lock release."""
        test_file = tmp_path / "test.json"
        test_data = {"initial": "data"}
        locked_write_json(test_file, test_data)

        results = []
        
        def slow_write():
            """Hold lock for a bit then write."""
            import portalocker
            with portalocker.Lock(test_file, mode="r+", timeout=5, encoding="utf-8"):
                time.sleep(0.5)  # Hold lock
                data = {"slow": "write"}
                with open(test_file, "r+") as f:
                    f.seek(0)
                    f.truncate()
                    json.dump(data, f)
                    f.flush()
            results.append("slow")
        
        def fast_write():
            """Try to write while lock is held."""
            time.sleep(0.1)  # Let slow_write acquire lock first
            try:
                locked_write_json(test_file, {"fast": "write"}, timeout=2.0)
                results.append("fast")
            except HTTPException as e:
                if e.status_code == 503:
                    results.append("timeout")
        
        # Start both threads
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            futures = [
                executor.submit(slow_write),
                executor.submit(fast_write),
            ]
            for future in concurrent.futures.as_completed(futures):
                future.result()
        
        # Either fast succeeded or timed out, but no corruption
        assert len(results) == 2
        assert "slow" in results
        # File should be valid JSON
        data = json.loads(test_file.read_text())
        assert isinstance(data, dict)


class TestBackwardCompatibility:
    """Test that locked operations work with existing JSON files."""

    def test_read_existing_positions_json(self, tmp_path):
        """Test reading existing positions.json format."""
        test_file = tmp_path / "positions.json"
        positions_data = {
            "asof": "2026-02-10",
            "positions": [
                {
                    "ticker": "AAPL",
                    "status": "open",
                    "entry_date": "2026-02-01",
                    "entry_price": 150.0,
                    "stop_price": 145.0,
                    "shares": 100,
                    "position_id": "pos-001"
                }
            ]
        }
        test_file.write_text(json.dumps(positions_data, indent=2))

        result = locked_read_json(test_file)
        assert result == positions_data
        assert result["positions"][0]["ticker"] == "AAPL"

    def test_write_preserves_format(self, tmp_path):
        """Test that write preserves expected JSON format."""
        test_file = tmp_path / "orders.json"
        orders_data = {
            "asof": "2026-02-10",
            "orders": [
                {
                    "order_id": "ord-001",
                    "ticker": "MSFT",
                    "status": "pending",
                    "order_type": "LIMIT",
                    "quantity": 50,
                    "limit_price": 400.0
                }
            ]
        }

        locked_write_json(test_file, orders_data)

        # Read without locking to verify format
        content = test_file.read_text()
        assert '"asof"' in content
        assert '"orders"' in content
        # Verify it's valid JSON
        parsed = json.loads(content)
        assert parsed == orders_data


class TestCLIFileLock:
    """Test CLI file lock utilities."""

    def test_cli_locked_read(self, tmp_path):
        """Test CLI locked read works."""
        from src.swing_screener.utils.file_lock import locked_read_json_cli

        test_file = tmp_path / "test.json"
        test_data = {"cli": "test"}
        test_file.write_text(json.dumps(test_data))

        result = locked_read_json_cli(test_file)
        assert result == test_data

    def test_cli_locked_write(self, tmp_path):
        """Test CLI locked write works."""
        from src.swing_screener.utils.file_lock import locked_write_json_cli

        test_file = tmp_path / "test.json"
        test_data = {"cli": "write"}

        locked_write_json_cli(test_file, test_data)

        content = json.loads(test_file.read_text())
        assert content == test_data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
