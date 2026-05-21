export async function readLatestSnapshot(env = {}) {
  if (!env.DB || typeof env.DB.prepare !== "function") {
    return null;
  }

  let row;
  try {
    row = await env.DB
      .prepare(
        `SELECT id, generated_at, payload_json
         FROM snapshots
         ORDER BY generated_at DESC
         LIMIT 1`
      )
      .first();
  } catch (error) {
    console.warn(JSON.stringify({
      event: "lokana.d1_snapshot_read_failed",
      message: error instanceof Error ? error.message : String(error)
    }));
    return null;
  }

  if (!row?.payload_json) {
    return null;
  }

  return {
    id: row.id,
    generatedAt: row.generated_at,
    payload: JSON.parse(row.payload_json)
  };
}

export function hasD1(env = {}) {
  return Boolean(env.DB && typeof env.DB.prepare === "function");
}
