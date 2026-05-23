const DEFAULT_MIMO_API_URL = "https://api.xiaomimimo.com/v1/chat/completions";
const DEFAULT_MIMO_MODEL = "mimo-v2.5";
const DEFAULT_SUMMARY_LANGUAGE = "ko";
const DEFAULT_MAX_ISSUES = 12;
const DEFAULT_TIMEOUT_SECONDS = 30;
const DEFAULT_MAX_COMPLETION_TOKENS = 4096;

function clamp(value, lower, upper) {
  return Math.max(lower, Math.min(upper, value));
}

function settingNumber(value, fallback, lower, upper) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return clamp(Math.trunc(parsed), lower, upper);
}

function timeoutSignal(timeoutSeconds) {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(timeoutSeconds * 1000);
  }
  return undefined;
}

function mimoConfig(env = {}) {
  const apiKey = typeof env.MIMO_API_KEY === "string" ? env.MIMO_API_KEY.trim() : "";
  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    apiUrl: typeof env.MIMO_API_URL === "string" && env.MIMO_API_URL.trim()
      ? env.MIMO_API_URL.trim()
      : DEFAULT_MIMO_API_URL,
    model: typeof env.MIMO_MODEL === "string" && env.MIMO_MODEL.trim()
      ? env.MIMO_MODEL.trim()
      : DEFAULT_MIMO_MODEL,
    language: typeof env.MIMO_SUMMARY_LANGUAGE === "string" && env.MIMO_SUMMARY_LANGUAGE.trim()
      ? env.MIMO_SUMMARY_LANGUAGE.trim()
      : DEFAULT_SUMMARY_LANGUAGE,
    maxIssues: settingNumber(env.MIMO_SUMMARY_MAX_ISSUES, DEFAULT_MAX_ISSUES, 1, 24),
    timeoutSeconds: settingNumber(env.MIMO_TIMEOUT_SECONDS, DEFAULT_TIMEOUT_SECONDS, 5, 120),
    maxCompletionTokens: settingNumber(env.MIMO_MAX_COMPLETION_TOKENS, DEFAULT_MAX_COMPLETION_TOKENS, 512, 8192)
  };
}

function sourceContext(issue, sourceMap) {
  return issue.sourceIds.slice(0, 4).map((sourceId) => {
    const source = sourceMap.get(sourceId);
    return source
      ? {
          publisher: source.publisher,
          title: source.title,
          url: source.url,
          publishedAt: source.publishedAt
        }
      : { publisher: "unknown", title: "unknown", url: "", publishedAt: "" };
  });
}

function issuePayload(issue, sourceMap) {
  return {
    issueId: issue.id,
    title: issue.title,
    conclusion: issue.conclusion,
    categories: issue.categories,
    audiences: issue.audiences,
    updatedAt: issue.updatedAt,
    currentSummary: issue.summary,
    sources: sourceContext(issue, sourceMap)
  };
}

function systemPrompt(language) {
  const korean = language.toLowerCase().startsWith("ko");
  if (korean) {
    return [
      "You rewrite AI tech radar issues into concise factual Korean JSON.",
      "Return JSON only.",
      "Do not use markdown, code fences, or commentary.",
      "Do not invent facts that are not present in the input.",
      "Keep the tone analytical, calm, and operator-friendly.",
      "For each issue, produce:",
      "- conclusion: one sentence",
      "- summary.whatHappened: one or two short sentences",
      "- summary.whyMatters: one short sentence",
      "- summary.whoAffected: one short sentence in Korean",
      "- summary.nextAction: one short sentence",
      "Preserve nuance and stay conservative when evidence is thin."
    ].join(" ");
  }

  return [
    "You rewrite AI tech radar issues into concise factual JSON.",
    "Return JSON only with no markdown or commentary.",
    "Do not invent facts that are not present in the input.",
    "Keep the tone analytical and operator-friendly."
  ].join(" ");
}

function userPrompt(issues) {
  return JSON.stringify({
    task: "Rewrite the issue conclusion and summary fields. Keep the same issueId values.",
    outputSchema: {
      issues: [
        {
          issueId: "string",
          conclusion: "string",
          summary: {
            whatHappened: "string",
            whyMatters: "string",
            whoAffected: "string",
            nextAction: "string"
          }
        }
      ]
    },
    issues
  });
}

function stripFence(text) {
  return String(text || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractJson(text) {
  const cleaned = stripFence(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("MiMo returned non-JSON summary content.");
  }
}

function normalizedSummaryFields(summary = {}) {
  return {
    whatHappened: String(summary.whatHappened || "").trim(),
    whyMatters: String(summary.whyMatters || "").trim(),
    whoAffected: String(summary.whoAffected || "").trim(),
    nextAction: String(summary.nextAction || "").trim()
  };
}

function applySummaryPatch(issue, patch) {
  const normalized = normalizedSummaryFields(patch.summary);
  if (!patch.conclusion || Object.values(normalized).some((value) => !value)) {
    return issue;
  }

  return {
    ...issue,
    conclusion: String(patch.conclusion).trim(),
    summary: normalized
  };
}

async function requestMimoSummary(config, payloadIssues, fetchFn) {
  const response = await fetchFn(config.apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    signal: timeoutSignal(config.timeoutSeconds),
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "system",
          content: systemPrompt(config.language)
        },
        {
          role: "user",
          content: userPrompt(payloadIssues)
        }
      ],
      max_completion_tokens: config.maxCompletionTokens,
      temperature: 0.3,
      top_p: 0.95,
      stream: false,
      thinking: {
        type: "disabled"
      }
    })
  });

  const rawText = await response.text();
  let responseBody = null;
  try {
    responseBody = rawText ? JSON.parse(rawText) : null;
  } catch {
    responseBody = { raw: rawText };
  }

  if (!response.ok) {
    const message = responseBody?.error?.message || responseBody?.message || `HTTP ${response.status}`;
    throw new Error(`MiMo summary request failed: ${message}`);
  }

  const content = responseBody?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("MiMo summary response was empty.");
  }

  return extractJson(content);
}

export async function maybeSummarizeIssuesWithMimo(options = {}) {
  const config = mimoConfig(options.env);
  const issues = Array.isArray(options.issues) ? options.issues : [];
  const sources = Array.isArray(options.sources) ? options.sources : [];
  const fetchFn = options.fetchFn || fetch;

  if (!config) {
    return {
      issues,
      details: {
        provider: "xiaomi-mimo",
        status: "skipped",
        reason: "missing_api_key"
      }
    };
  }

  if (!issues.length) {
    return {
      issues,
      details: {
        provider: "xiaomi-mimo",
        model: config.model,
        status: "skipped",
        reason: "no_issues"
      }
    };
  }

  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  const targetIssues = issues.slice(0, config.maxIssues);

  try {
    const parsed = await requestMimoSummary(
      config,
      targetIssues.map((issue) => issuePayload(issue, sourceMap)),
      fetchFn
    );
    const summaryEntries = Array.isArray(parsed?.issues) ? parsed.issues : [];
    const patchMap = new Map(summaryEntries.map((entry) => [entry.issueId, entry]));
    const updatedIssues = issues.map((issue) => {
      const patch = patchMap.get(issue.id);
      return patch ? applySummaryPatch(issue, patch) : issue;
    });
    const summarizedIssueCount = updatedIssues.filter((issue, index) => issues[index] !== issue).length;

    return {
      issues: updatedIssues,
      details: {
        provider: "xiaomi-mimo",
        model: config.model,
        status: summarizedIssueCount ? "completed" : "partial",
        summarizedIssueCount,
        requestedIssueCount: targetIssues.length
      }
    };
  } catch (error) {
    return {
      issues,
      details: {
        provider: "xiaomi-mimo",
        model: config.model,
        status: "failed",
        requestedIssueCount: targetIssues.length,
        error: error instanceof Error ? error.message : String(error)
      }
    };
  }
}
