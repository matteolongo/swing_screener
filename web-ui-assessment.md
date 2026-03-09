## Web UI Code Assessment Report

### 1. Misplaced Logic

*   **Finding:** UI components in `src/pages` are overly complex, containing significant business logic, data fetching, and state management. This violates the principle of separation of concerns, making components difficult to test, maintain, and reuse.
*   **Examples:**
    *   `DailyReview.tsx`: Contains logic for filtering candidates, handling watch/unwatch actions, and managing UI state for modals and collapsible sections. It also defines multiple large sub-components.
    *   `Intelligence.tsx`: Manages complex state for configuration, jobs, and symbol sets. It includes logic for running intelligence analysis and CRUD operations for symbol sets.
*   **Recommendation:**
    *   Extract business logic into custom hooks (e.g., `useDailyReviewLogic`) or dedicated service/helper files within the `src/features` directory.
    *   Move large sub-components (`CandidatesTable`, `UpdateStopTable`, etc.) into their own files under `src/components/domain/`.
    *   Use a state management library (like the existing Zustand stores) more effectively to manage complex component state.

### 2. Hardcoded Values

*   **Finding:** The application contains hardcoded configuration and data that should be externalized. This makes the application inflexible and requires code changes for simple data modifications.
*   **Examples:**
    *   `Intelligence.tsx`: Hardcoded `PROVIDER_MODELS` and `PROVIDER_DEFAULTS` for LLM providers.
    *   `Onboarding.tsx`: Hardcoded `STEPS` for the onboarding flow.
    *   `DailyReview.tsx`: Use of `DEFAULT_CONFIG` and a hardcoded media query.
*   **Recommendation:**
    *   Externalize configuration like LLM providers and models to a configuration file (e.g., a JSON or YAML file) or fetch it from an API.
    *   Move the onboarding steps data to a separate file (e.g., `src/content/onboarding.ts`) or load it from a CMS or API if it needs to be highly dynamic.

### 3. Potential Dead Code

*   **Finding:** The large file sizes and complexity of the components suggest that there may be unused variables, functions, or imports. There are also a number of `README.md` files in the subdirectories that may not be necessary. The `test_api.sh` file also seems out of place for a web UI.
*   **Recommendation:**
    *   Run a code analysis tool like `eslint` with the `no-unused-vars` rule enabled, or a specialized tool like `ts-prune` to identify and remove dead code. This will improve code clarity and reduce bundle size.
    *   Review the necessity of the `README.md` files in the subdirectories and the `test_api.sh` file.
