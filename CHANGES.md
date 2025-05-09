# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Initial project scaffolding following Go best practices (`cmd/`, `internal/`, etc.)
- Added `.gitignore`, `LICENSE`, and CI/CD setup
- Implemented file watcher with recursive `fsnotify` support
- Exclusion of `vendor/`, hidden, and symlinked directories
- TDD-driven watcher tests for file change detection, exclusion, and edge cases
- Implemented event debouncer supporting per-package buffering and quiet period
- TDD-driven debouncer tests for rapid, single, and overlapping events
- Pre-commit hooks and linting configuration
- **Phase 3: Go Test Runner**
  - Comprehensive TDD-driven runner tests for: correct package execution, stdout/stderr capture, error handling, build errors, real-time output, and goroutine pipeline integration
  - Runner implementation using `os/exec` for `go test -json`, robust output streaming with `bufio.Scanner`, and per-test rerun support
  - Utilities for running `go version`, `go env`, `go list`, `go mod tidy`, and `go fmt`
  - Cleaned up debug/test output and improved test reliability
- **Phase 3.3/3.4: Output Parser Initiated**
  - Added `parser.go` with `TestEvent` struct for `go test -json` output
  - Implemented `ParseTestEvents` for reading/parsing JSON event streams
  - Added TDD tests for parsing simple event streams, tracking all event types (start, run, pass, fail, output), extracting file/line info from failure output, collecting test durations/output lines, and handling edge cases (build errors, panics, timeouts)
  - Implemented `GroupTestEvents` and tests to group events by package and test name
- **Phase 4.1: UI/Controller Tests (MVP CLI UI)**
  - All UI/controller tests for the MVP CLI UI are implemented and passing:
    - Color summary output (ANSI)
    - Keybindings (Enter, f, q)
    - Failure filtering mode
    - Code context for failed tests
    - UI updates on each run
    - Clipboard copy of failed test info ('c' key)
    - Interactive test selection and copying ('C' key, space)
  - Minimal custom implementation (no external TUI framework yet), ready for further CLI/TUI development.
- **Phase 4.2.1–4.2.4: CLI UI MVP**
  - CLI UI MVP now includes summary, color, icons, interactive controls, code context for failures, and channel-based communication between UI and runner/controller.
  - Event-driven updates and responsive UI loop implemented.
  - Clipboard integration for test failures is next.

### Changed
- Updated `ROADMAP.md` to reflect completed Phase 3.1 and 3.2 milestones and next steps
- Refactored runner and utility code for maintainability and extensibility

### Fixed
- Cleaned up test log output and removed obsolete debug code
- Resolved all runner test flakiness and output issues

---

---
