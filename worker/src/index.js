import { collectJobStatus, collectOfficialFeedDataset } from "./collector.js";
import { hasD1, persistCollectedSnapshot, persistFailedJob } from "./db.js";
import { handleRequest } from "./routes.js";

async function scheduledCollect(env, scheduledTime) {
  const generatedAt = new Date(scheduledTime || Date.now()).toISOString();
  if (!hasD1(env)) {
    console.warn(
      JSON.stringify({
        event: "lokana.scheduled_collect_skipped",
        reason: "d1_not_configured",
        generatedAt
      })
    );
    return;
  }

  try {
    const collection = await collectOfficialFeedDataset({ env, fetchFn: fetch, generatedAt });
    const status = collectJobStatus(collection.details);
    const result = await persistCollectedSnapshot(env, collection, status);
    console.log(
      JSON.stringify({
        event: "lokana.scheduled_collect_completed",
        status: result.status,
        snapshotId: result.snapshotId,
        counts: result.counts
      })
    );
  } catch (error) {
    await persistFailedJob(env, "collect_official_feeds", generatedAt, error).catch((jobError) => {
      console.warn(
        JSON.stringify({
          event: "lokana.scheduled_collect_failed_job_write_failed",
          message: jobError instanceof Error ? jobError.message : String(jobError)
        })
      );
    });
    console.warn(
      JSON.stringify({
        event: "lokana.scheduled_collect_failed",
        message: error instanceof Error ? error.message : String(error)
      })
    );
  }
}

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(scheduledCollect(env, event.scheduledTime));
  }
};
