# Agent Testing Infrastructure

This directory contains comprehensive testing for the chat agents in our application.

## Overview

The testing infrastructure consists of two main components:

1. **Unit Tests (Jest)**: Tests individual agents and their functionality in isolation.
2. **Functional API Tests**: Tests the complete flow through the API endpoints.

## Running Tests

### Agent Unit Tests

To run agent-specific unit tests:

```bash
npm run test:agents
```

These tests verify that individual agents respond correctly to various inputs.

### Functional API Tests

To run functional API tests (requires a running server):

```bash
npm run test:functional
```

These tests simulate real user interactions with the API endpoints.

### All Tests

To run both unit and functional tests:

```bash
npm run test:all
```

## Test Structure

- `agent.spec.ts`: Contains Jest tests for all agents (time, weather, research, document)
- Shell scripts in the `/scripts` directory automate the test process

## Adding New Tests

When adding a new agent:

1. Add unit tests for the agent in `agent.spec.ts`
2. Add a functional test case in `run-functional-tests.sh`
3. Run the tests to verify functionality

## Debugging Failed Tests

- Check agent-specific test output for detailed error messages
- Verify that agents are properly registered in the AgentRegistry
- Check for any console error output in the server logs
