import "dotenv/config";

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.AUTH_SECRET ??= "integration-test-secret-0123456789";
// Deterministic fake prices (dev/test only) instead of the real data provider.
delete process.env.FINNHUB_API_KEY;
process.env.FAKE_MARKET_DATA = "1";
delete process.env.ABLY_API_KEY;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
