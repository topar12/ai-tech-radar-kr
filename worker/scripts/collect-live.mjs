import { collectOfficialFeedDataset } from "../src/collector.js";

const generatedAt = new Date().toISOString();
const collection = await collectOfficialFeedDataset({
  generatedAt,
  fetchFn: fetch,
  maxItemsPerFeed: 1
});

console.log(
  JSON.stringify(
    {
      generatedAt: collection.generatedAt,
      counts: {
        sources: collection.payload.sources.length,
        signals: collection.payload.signals.length,
        issues: collection.payload.issues.length,
        watchlists: collection.payload.watchlists.length
      },
      feeds: collection.details.feeds
    },
    null,
    2
  )
);
