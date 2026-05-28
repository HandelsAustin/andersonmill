#!/bin/bash
# Firestore Rules Test Runner
# Start emulator, run tests, then tear down

set -e

echo "Starting Firestore Emulator..."
firebase emulators:start --only firestore &
EMULATOR_PID=$!

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
node tests/firestore-rules-test.js

TEST_RESULT=$?

echo "Stopping Emulator..."
kill $EMULATOR_PID 2>/dev/null || true

exit $TEST_RESULT
