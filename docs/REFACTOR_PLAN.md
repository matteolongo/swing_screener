# Refactoring and Improvement Plan

This document outlines a detailed, phased plan to implement the recommendations from `CODE_REVIEW.md`. The goal is to improve the project's robustness, maintainability, and testability.

## Phase 1: Foundational Refactoring (Low-Risk Changes)

This phase focuses on improving the codebase structure without altering the core trading logic.

### Task 1.1: Consolidate the Data Provider Abstraction

**Goal:** Ensure all market data fetching goes through the `MarketDataProvider` interface for consistency and to simplify future changes.

1.  **Analyze Data Flow**: Confirm that `data/market_data.py`'s `fetch_ohlcv` is the primary function being called by the application for `yfinance` data.
2.  **Centralize Logic in Provider**:
    *   Modify `data/providers/yfinance_provider.py`. Ensure its `fetch_ohlcv` method contains all the necessary logic, including caching. The current implementation already wraps the old function; the next step is to make it self-sufficient.
    *   Move the caching logic (like `_cache_path`) from `data/market_data.py` into `YfinanceProvider`. The provider should manage its own cache. `AlpacaDataProvider` already does this, providing a good pattern to follow.
3.  **Refactor Call Sites**:
    *   Modify any part of the application that calls `fetch_ohlcv` directly from `data/market_data.py`.
    *   These call sites should instead use the factory `get_market_data_provider()` to get an instance of the current provider and then call the `fetch_ohlcv` method on that instance.

## Phase 2: Persistence Layer Overhaul (High-Impact)

**Goal:** Replace the fragile file-based state management (`orders.json`, `positions.json`) with a robust SQLite database. This is the most critical improvement.

### Task 2.1: Set up Database and Schema

1.  **Add Dependency**: Add `sqlalchemy` to the project dependencies.
2.  **Define Schema**:
    *   Create a new module: `src/swing_screener/db.py`.
    *   In this module, define the database connection logic and use `sqlalchemy` to define the schema for an `orders` table and a `positions` table.
    *   The table columns should directly map to the fields in the `Order` and `Position` dataclasses.
    *   Define a foreign key relationship: `orders.position_id` should reference `positions.id`. This enforces data integrity.

### Task 2.2: Replace File I/O with Database Operations

1.  **Rewrite `load` functions**:
    *   In `portfolio/state.py`, rewrite `load_positions` to execute a `SELECT` query on the `positions` table and construct `Position` objects from the results.
    *   In `execution/orders.py`, rewrite `load_orders` to do the same for the `orders` table.
2.  **Rewrite state-mutating workflows with transactions**:
    *   In `execution/order_workflows.py`, rewrite `fill_entry_order` to use a single database transaction. Inside the transaction block:
        *   `UPDATE` the status of the filled entry order.
        *   `INSERT` a new row into the `positions` table.
        *   `INSERT` new rows into the `orders` table for the linked stop-loss and take-profit orders.
    *   Perform a similar rewrite for `scale_in_fill`.
3.  **Deprecate `save` functions**: The `save_positions` and `save_orders` functions, which write the entire state back to a file, will no longer be needed. Changes will be persisted transactionally within the workflow functions.

### Task 2.3: Create a One-Time Data Migration Script

1.  **Create Script**: Create a new script, e.g., `scripts/migrate_json_to_sqlite.py`.
2.  **Implement Logic**: This script will:
    *   Read all data from `positions.json` and `orders.json` using the old `load_` functions.
    *   Connect to the new SQLite database.
    *   `INSERT` the data into the new `positions` and `orders` tables, ensuring relationships are maintained.

### Task 2.4: Clean Up Obsolete Code

1.  **Remove File Locking**: Delete `src/swing_screener/utils/file_lock.py`. Remove all calls to `locked_read_json_cli` and `locked_write_json_cli`.
2.  **Remove Migration Logic**: Delete `src/swing_screener/portfolio/migrate.py`, as schema and data integrity are now handled by the database.

## Phase 3: Enhance Test Coverage

**Goal:** Improve confidence in the backtesting engine by adding targeted integration tests for critical edge cases.

### Task 3.1: Implement Backtester Scenario Tests

1.  **Create Test File**: In the `tests/` directory, create `test_backtest_scenarios.py`.
2.  **Test 1: Gap-Down Through Stop**:
    *   Write a test function `test_stop_hit_on_gap_down`.
    *   Inside, construct a small, hand-crafted `pd.DataFrame` representing OHLCV data where the `open` price of a bar is below the active stop-loss.
    *   Call `backtest_single_ticker_R` with this data.
    *   Assert that the resulting trade record shows an `exit_type` of "stop" and an `exit_price` equal to that bar's `open` price.
3.  **Implement Other Scenarios**: Create similar, focused test functions for the following cases:
    *   Price gaps up through a take-profit level.
    *   Stop is hit by the `low` of the bar intra-day.
    *   Breakeven stop is correctly triggered when `R >= 1.0`.
    *   Trailing stop is correctly activated when `R >= 2.0` and subsequently moves up with the SMA.
    *   A trade is correctly exited due to the `max_holding_days` time stop.
4.  **No Mocks**: These tests should not mock the data but provide real `DataFrame` objects to the backtesting function to validate its behavior under realistic (though crafted) conditions.
