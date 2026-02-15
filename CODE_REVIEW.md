# Backend Code Review: `src/swing_screener`

This document provides a software engineering review of the `src/swing_screener` module. The analysis focuses on architecture, maintainability, potential risks, and areas for improvement.

## 1. High-Level Architecture

The project is structured as a modular pipeline, which is a strong architectural choice. Data flows from data sources through screeners, ranking, signal generation, and risk management to produce a final report. The separation of concerns is generally good, with distinct packages for indicators, signals, risk, etc.

**Key Strengths:**

*   **Modularity**: The separation into `data`, `indicators`, `screeners`, `signals`, `risk`, and `reporting` makes the system understandable and extensible.
*   **Strategy-Driven**: The `strategies` framework, allowing strategy definitions in JSON, is a powerful feature. It decouples the core logic from the specific trading rules, enabling easy experimentation.
*   **Stateless Components**: Many core components (indicators, screeners, signals, recommendations) are implemented as stateless, functional pipelines. This makes them easy to test and reason about.

**Primary Weaknesses:**

*   **File-Based State Management**: The use of `orders.json` and `positions.json` as a database is the most significant architectural weakness. This approach is not transactional, prone to race conditions (despite file locks), and makes data integrity and migration difficult. The existence of `portfolio/migrate.py` and `utils/file_lock.py` are symptoms of this underlying issue.
*   **"God Object" CLI**: `cli.py` is a monolithic script that handles all command parsing and directly orchestrates business logic. As new commands are added, this file will become increasingly difficult to maintain and test.

## 2. Module-Specific Analysis

### `data/` and `config.py`

*   **Good**: The introduction of a `providers` abstraction (`data/providers/`) to support multiple data sources (`yfinance`, `Alpaca`) is a solid design choice. The use of a factory `get_market_data_provider` is good practice.
*   **Improvement**: There's a slight redundancy between `data/market_data.py` and `data/providers/yfinance_provider.py`. The provider wraps the logic from `market_data.py`. This suggests a refactoring is in progress. The goal should be to have all data access go through the `MarketDataProvider` interface, completely hiding the `yfinance` specifics from the rest of the app.
*   **Maintainability**: The cache key generation in `_cache_path` in `market_data.py` is complex and based on a long string of parameters. This can be brittle. A more robust approach would be to hash a dictionary of the request parameters to create a unique, stable cache key.

### `backtest/`

*   **Good**: The backtesting engine is designed around R-multiples, which is a best practice for evaluating trading systems independent of position size.
*   **Concern**: `backtest/simulator.py` contains a large, stateful loop (`for i in range(len(df))`). This style of event-driven backtesting is powerful but notoriously difficult to get right.
    *   **Risk of Look-Ahead Bias**: The logic for trailing stops (`_maybe_trail_stop`) and signal generation must be carefully reviewed to ensure it only uses data available *before* the current bar's open. For example, `df["entry_sig"].shift(1)` is used, which is correct. However, inside the loop, using `df['trail_sma'].iloc[i]` to make a decision for the current bar `i` is correct only if that SMA value was computable using data from `i-1` or earlier. The code seems to handle this correctly, but it's a high-risk area.
    *   **Testing**: Testing this loop thoroughly is critical. It requires carefully crafted scenarios to check gap handling, stop execution priority, and trailing logic at different stages of a trade. Mocks would likely hide the intricacies of the data dependencies. **This is a poorly testable part of the codebase without significant effort in creating specific test dataframes.**

### `execution/` and `portfolio/` (State Management)

*   **High Risk**: As mentioned, file-based state management is a major concern. It's not scalable or robust. A lightweight database like **SQLite** would be a massive improvement, providing transactions, typed columns, and easier querying without adding a heavy dependency.
*   **Maintainability**: The functions in `order_workflows.py` and `portfolio/migrate.py` are complex because they are manually managing relations between orders and positions. `fill_entry_order` creates a position, a stop order, and a TP order, and has to link them all manually with generated IDs. This is logic that a relational database would handle automatically via foreign keys and transactions.
*   **Testing**: Mocking the file system (`load_orders`, `save_positions`) would make unit tests possible, but it would hide the most significant risk: concurrency. True integration tests for this module would be flaky and difficult to write. Migrating to SQLite would simplify testing, as an in-memory database could be used for tests.

### `cli.py`

*   **Maintainability**: The `main` function is over 500 lines long, with deeply nested `if/elif` blocks for each command. This is a classic maintenance trap.
*   **Recommendation**: Refactor the CLI using a framework like `click` or `typer`. Each command (or group of commands) can be moved into its own function or module. This would break `cli.py` into smaller, more manageable pieces and separate the concerns of argument parsing from business logic execution. For example, a `run_command` function could be called from the CLI handler, containing just the logic from the `if args.command == "run":` block.

## 3. Summary of Key Recommendations

1.  **Migrate State Management to SQLite**:
    *   **Action**: Replace `orders.json` and `positions.json` with a single SQLite database file. Use `sqlalchemy` Core or a simple library to interact with it.
    *   **Benefit**: Provides ACID guarantees (transactions), data integrity (schemas, foreign keys), easier querying, and eliminates the need for file locks and manual data migration scripts. Radically improves robustness and testability.

2.  **Refactor the CLI**:
    *   **Action**: Adopt a modern CLI framework like `click` or `typer`. Break down the `main` function in `cli.py` into smaller, decorated functions corresponding to each command.
    *   **Benefit**: Improves maintainability, readability, and testability of the command-line interface.

3.  **Complete the Data Provider Abstraction**:
    *   **Action**: Refactor all calls to `yf.download` or the caching logic in `data/market_data.py` to go through the `MarketDataProvider` interface defined in `data/providers/`.
    *   **Benefit**: Creates a single, clean interface for data fetching, making it easier to add new providers or change configuration without impacting the rest of the application.

4.  **Enhance Backtester Testing**:
    *   **Action**: Create a dedicated suite of tests for `backtest/simulator.py` with small, hand-crafted `pd.DataFrame` inputs that target specific edge cases:
        *   Gaps through stops/take-profits.
        *   Breakeven logic activation.
        *   Trailing stop activation and movement.
        *   Time-based exits.
    *   **Benefit**: Increases confidence in the backtesting results, which are fundamental to the project's value. These should be integration-style tests on the function, not using mocks for the dataframe.

This review finds a well-architected project with a clear, logical data flow. Its primary weakness lies in its persistence layer, which introduces significant risks to data integrity and maintainability. Addressing this by migrating to a simple database like SQLite would be the single most impactful improvement.
