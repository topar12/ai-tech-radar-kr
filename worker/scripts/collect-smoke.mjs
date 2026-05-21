import { collectJobStatus, collectOfficialFeedDataset, OFFICIAL_FEEDS } from "../src/collector.js";
import { persistCollectedSnapshot } from "../src/db.js";

const generatedAt = "2026-05-21T12:00:00Z";
const feedXml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Mock AI Feed</title>
    <item>
      <title>OpenAI launches agent workflow runtime</title>
      <link>https://example.com/openai-agent-runtime</link>
      <description>Official release notes describe a new agent runtime for developers.</description>
      <pubDate>Thu, 21 May 2026 09:00:00 GMT</pubDate>
      <category>agents</category>
      <category>developers</category>
    </item>
    <item>
      <title>OpenAI model evaluation update</title>
      <link>https://example.com/openai-model-eval</link>
      <description>New model evaluation data and practical deployment guidance.</description>
      <pubDate>Thu, 21 May 2026 08:00:00 GMT</pubDate>
      <category>models</category>
    </item>
  </channel>
</rss>`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function mockFetch() {
  return new Response(feedXml, {
    status: 200,
    headers: {
      "content-type": "application/rss+xml"
    }
  });
}

function fakeStatement(sql, collector) {
  return {
    sql,
    values: [],
    bind(...values) {
      this.values = values;
      return this;
    },
    async run() {
      collector.executed.push({ sql, values: this.values });
      return { success: true };
    }
  };
}

function fakeD1() {
  const collector = {
    executed: [],
    prepared: []
  };
  return {
    collector,
    prepare(sql) {
      collector.prepared.push(sql);
      return fakeStatement(sql, collector);
    },
    async batch(statements) {
      for (const statement of statements) {
        await statement.run();
      }
      return statements.map(() => ({ success: true }));
    }
  };
}

const collection = await collectOfficialFeedDataset({
  generatedAt,
  feeds: [OFFICIAL_FEEDS[0]],
  fetchFn: mockFetch,
  maxItemsPerFeed: 2
});

assert(collection.payload.generatedAt === generatedAt, "generatedAt should be carried into payload");
assert(collection.payload.sources.length === 2, "collector should create two sources");
assert(collection.payload.signals.length === 2, "collector should create two signals");
assert(collection.payload.issues.length >= 1, "collector should create at least one issue");
assert(collection.details.feeds[0].status === "completed", "mock feed should complete");
assert(collectJobStatus(collection.details) === "completed", "completed feed should produce completed status");

const DB = fakeD1();
const persisted = await persistCollectedSnapshot({ DB }, collection, collectJobStatus(collection.details));
assert(persisted.status === "completed", "persist status should be completed");
assert(persisted.counts.sourceCount === 2, "persist counts should include sources");
assert(DB.collector.executed.some((entry) => entry.sql.includes("INSERT INTO snapshots")), "persist should insert snapshot");
assert(DB.collector.executed.some((entry) => entry.sql.includes("INSERT INTO jobs")), "persist should insert job");

console.log("Lokana Worker collect smoke passed.");
