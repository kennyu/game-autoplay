# Concurrency and Parallel Execution

## Current State

**Tests run sequentially (one at a time).**

- Each test waits for the previous one to complete
- One browser session per test
- Total time = sum of all individual test times

## Concurrency Options

### Option 1: Parallel Test Execution

Run multiple test files simultaneously:

```typescript
// Example: Run all tests in parallel
const tests = [
  () => runTest('test/basic-test.ts'),
  () => runTest('test/browser-test.ts'),
  () => runTest('test/detector-test.ts'),
];

await Promise.all(tests.map(test => test()));
```

**Pros:**
- Faster overall execution
- Better resource utilization
- Can test multiple games simultaneously

**Cons:**
- Higher API usage (Browserbase + OpenAI)
- More complex error handling
- Console output can interleave

### Option 2: Parallel Batch Processing

Test multiple game URLs concurrently:

```typescript
// Example: Test 3 games in parallel
const urls = [
  'https://game1.com',
  'https://game2.com',
  'https://game3.com',
];

const results = await Promise.all(
  urls.map(url => runGameTest(url))
);
```

**Pros:**
- Much faster for batch testing
- Efficient resource usage
- Better for CI/CD pipelines

**Cons:**
- Requires rate limiting
- Higher costs (concurrent Browserbase sessions)
- Need to manage session limits

### Option 3: Keep Sequential (Current)

**Pros:**
- Simple and predictable
- Easier debugging
- Lower API costs
- No rate limiting concerns

**Cons:**
- Slower overall execution
- Not optimal for large batches

## Browserbase Concurrency Limits

Browserbase supports concurrent sessions, but check your plan limits:
- **Free tier**: Usually 1-2 concurrent sessions
- **Paid tiers**: Varies (e.g., 5, 10, 20+ concurrent sessions)

## Implementation Example

If you want to add concurrent execution, here's how:

```typescript
// src/batch/concurrent-executor.ts
export class ConcurrentBatchExecutor {
  async executeBatch(urls: string[], maxConcurrency: number = 3) {
    const results: AgentState[] = [];
    
    // Process in batches to respect concurrency limit
    for (let i = 0; i < urls.length; i += maxConcurrency) {
      const batch = urls.slice(i, i + maxConcurrency);
      
      const batchResults = await Promise.all(
        batch.map(url => runGameTest(url))
      );
      
      results.push(...batchResults);
    }
    
    return results;
  }
}
```

## Recommendations

1. **For Development/Testing**: Keep sequential (easier debugging)
2. **For CI/CD**: Use limited concurrency (2-3 parallel tests)
3. **For Production Batch**: Use controlled concurrency with rate limiting

## Adding Concurrency

To enable concurrent execution:

1. **Modify test scripts** to run in parallel
2. **Add batch executor** with concurrency control
3. **Implement rate limiting** to respect API limits
4. **Add progress tracking** for parallel execution
5. **Handle errors gracefully** (don't stop all tests if one fails)

Would you like me to implement concurrent execution? I can:
- Add a concurrent batch executor
- Modify test scripts to support parallel execution
- Add configuration for max concurrency
- Implement proper error handling and progress tracking




