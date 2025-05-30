package event

import (
	"fmt"
)

// TestResult represents the result of a test execution
type TestResult struct {
	Package string  // Package path
	Test    string  // Test name
	Passed  bool    // Whether the test passed
	Elapsed float64 // Test duration in seconds
	Output  string  // Test output
	Error   string  // Error message if failed
	File    string  // Source file containing the test
	Line    int     // Line number of the test function
}

// FileEvent represents a file system change event
type FileEvent struct {
	Path string // Path to the changed file
	Op   string // Operation type (create, write, remove)
}

// RunnerEvent represents an event from the test runner
type RunnerEvent struct {
	Package string     // Package being tested
	Test    string     // Test being run (empty for package)
	Status  string     // Status (started, running, completed)
	Results []TestResult // Results if completed
}

// ErrorEvent represents an error that occurred during operation
type ErrorEvent struct {
	Err error
}

func (e ErrorEvent) Error() string {
	return fmt.Sprintf("%v", e.Err)
}

// TreeNode represents a node in the test tree (package/test)
type TreeNode struct {
	Title    string       // Node name (package/test name)
	Children []*TreeNode // Child nodes
	Expanded bool         // Whether the node is expanded in the UI
	Level    int          // Nesting level
	Parent   *TreeNode    // Parent node reference
	Coverage float64      // Test coverage percentage
	Passed   *bool        // Whether test passed, nil if not a test
	Duration float64      // Test duration
	Error    string       // Error message if test failed
}

// BoolPtr returns a pointer to a boolean value
func BoolPtr(b bool) *bool {
	return &b
}
