/**
 * Token bucket rate limiter for MCP HTTP transport.
 * Tracks tokens per key (API key or IP address) in memory.
 */

interface BucketState {
    tokens: number;
    lastRefill: number;
}

export class TokenBucket {
    private buckets = new Map<string, BucketState>();
    private readonly tokensPerMinute: number;
    private readonly burstSize: number;

    constructor(perMinute: number, burst: number) {
        this.tokensPerMinute = perMinute;
        this.burstSize = burst;
    }

    /**
     * Try to consume one token for the given key.
     * @returns true if token available, false if rate limited
     */
    tryConsume(key: string): boolean {
        const now = Date.now();
        let state = this.buckets.get(key);

        if (!state) {
            // First request from this key
            state = {
                tokens: this.burstSize - 1, // Consume one token
                lastRefill: now,
            };
            this.buckets.set(key, state);
            return true;
        }

        // Calculate tokens to add based on elapsed time
        const elapsedMs = now - state.lastRefill;
        const tokensToAdd = (elapsedMs / 60000) * this.tokensPerMinute;
        state.tokens = Math.min(this.burstSize, state.tokens + tokensToAdd);
        state.lastRefill = now;

        // Try to consume a token
        if (state.tokens >= 1) {
            state.tokens -= 1;
            return true;
        }

        // Rate limited
        return false;
    }
}
