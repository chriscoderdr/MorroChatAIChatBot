# MorroChatAI Testing Infrastructure

This document outlines the testing infrastructure for the MorroChatAI application.

## Testing Architecture

The testing infrastructure is designed to ensure all agents, agent routing, and tools work as expected. Tests can be easily run whenever changes are made to the codebase.

### Key Components

1. **Agent Unit Tests**: Tests individual agents in isolation
2. **Integration Tests**: Tests interactions between agents and services
3. **Functional API Tests**: Tests complete API workflows using curl

## Test Scripts

All tests can be run using the following npm commands:

| Command | Description |
|---------|-------------|
| `npm run test:agents` | Runs the agent unit tests |
| `npm run test:functional` | Runs functional API tests (requires running server) |
| `npm run test:all` | Runs all tests sequentially |

## Script Locations

- **Agent Unit Tests**: `/src/chat/agents/tests/agent.spec.ts`
- **Test Scripts**: `/scripts/run-agent-tests.sh`, `/scripts/run-functional-tests.sh`, `/scripts/run-all-tests.sh`

## Adding New Tests

When adding new functionality:

1. Add unit tests in the appropriate test file
2. Update functional tests to cover the new functionality
3. Run all tests to verify nothing breaks

## Continuous Integration

It's recommended to run these tests:
- Before committing changes
- As part of a CI/CD pipeline
- After deploying to a new environment

## Troubleshooting

If tests fail:
1. Check the specific agent implementation
2. Verify environmental configuration
3. Check API endpoint responses
4. Review agent logs for thought process leakage

## Test Coverage

The testing suite covers:
- Time Agent
- Weather Agent
- Research Agent (including follow-up capability)
- Document Agent
- Topic Filtering
- Agent Routing Logic
