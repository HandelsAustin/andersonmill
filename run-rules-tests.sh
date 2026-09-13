#!/bin/bash
# Firestore Rules Test Runner
# Start emulator, run tests, then tear down

set -e

echo "Starting Firestore Emulator..."
firebase emulators:start --only firestore &
EMULATOR_PID=$!
# `set -e` would otherwise kill this script (and leak the emulator process)
# the instant the test command below returns non-zero, before the manual
# `kill` a few lines down ever ran. The trap guarantees cleanup on any exit —
# success, test failure, or Ctrl-C — not just the happy path.
trap 'kill $EMULATOR_PID 2>/dev/null || true' EXIT

# Wait for emulator to start
for i in {1..15}; do
  if command -v nc >/dev/null 2>&1; then
    nc -z localhost 8080 && break
  else
    curl -s http://localhost:8080 >/dev/null 2>&1 && break
  fi
  echo "Waiting for Firestore emulator to start... ($i/15)"
  sleep 1
done

echo "Running Firestore rules tests..."
set +e
node tests/rules-unit-tests.js
TEST_RESULT=$?
set -e

exit $TEST_RESULT
