# Module Documentation Process Guide

This guide outlines the process for documenting a module in `src/swing_screener/`.

---

## Overview

Each module documentation should include:
1. **README.md** - Main documentation file with overview and quick usage guidance
2. **Example notebooks** - Self-contained Jupyter notebooks (`.ipynb`) demonstrating usage

---

## Step-by-Step Process

### Step 1: Explore the Module

1. List all Python files in the module:
   ```bash
   glob src/swing_screener/<module_name>/**/*.py
   ```

2. Find existing documentation:
   ```bash
   glob src/swing_screener/<module_name>/**/*.md
   ```

3. Read each Python file to understand:
   - What the module does
   - Public functions/classes and their purpose
   - Configuration options
   - Dependencies
   - Public API exposed by the module (especially exports from `__init__.py`)

### Step 2: Analyze and Plan

Create a table summarizing the implementation:

| File | Purpose | Key Functions/Classes |
|------|---------|----------------------|
| file.py | what it does | func1, func2, ClassName |

Create an API coverage matrix:

| Public API | Notebook | Section |
|------------|----------|---------|
| module_fn | examples/basics.ipynb | "Basic Usage" |

Identify and confirm:
- Main entry points
- Configuration classes
- Core abstractions
- Any existing docs to merge
- Any API that must be covered by examples

### Step 3: Draft Documentation Plan

For each module, plan:

**1. README.md should contain:**
- 1-2 sentence module overview
- 3-5 quick usage code snippets (most common workflows)
- List of submodules
- Reference to any existing docs
- Link to the example notebooks and what each notebook covers

**2. Example notebooks to create:**
- Use Jupyter notebooks (`.ipynb`) only, not Python scripts
- Implement notebooks using the `jupyter-notebook` skill workflow/templates
- Put notebooks in `src/swing_screener/<module>/examples/`
- Ensure notebooks **collectively cover all exposed/public module APIs**
- Include strong markdown explanations:
  - What problem the section solves
  - Why each API is used
  - Expected inputs/outputs and caveats
  - How the pieces connect in the module design
- Keep cells small and runnable in sequence
- Handle errors or unavailable external dependencies gracefully

**3. Optional `__init__.py` updates:**
- Add exports for commonly used functions
- Only if it makes imports cleaner

---

## Important Notes

1. **No API reference tables** - The code already has docstrings
2. **Examples in module folder** - Put notebooks in `src/swing_screener/<module>/examples/`
3. **Self-contained examples** - Each notebook should run independently (or clearly state prerequisites)
4. **Merge existing docs** - Check for existing MD files first
5. **Keep it concise** - README for quick start, notebooks for deeper walkthroughs
