import { buildBootstrapLabels } from "./bootstrap-data.js";
import { maybeSummarizeIssuesWithMimo } from "./mimo.js";

export const OFFICIAL_FEEDS = [
  {
    id: "openai-news",
    publisher: "OpenAI",
    homeUrl: "https://openai.com/blog",
    feedUrl: "https://openai.com/news/rss.xml",
    sourceType: "official",
    reliability: 5,
    categories: ["models", "agents", "business"],
    audiences: ["developer", "pm", "leader"],
    practicalValue: 86,
    koreaRelevance: 62,
    risk: 42,
    importance: 82,
    velocity: 76
  },
  {
    id: "huggingface-blog",
    publisher: "Hugging Face",
    homeUrl: "https://huggingface.co/blog",
    feedUrl: "https://huggingface.co/blog/feed.xml",
    sourceType: "official",
    reliability: 4,
    categories: ["models", "open_source", "research"],
    audiences: ["developer", "researcher", "learner"],
    practicalValue: 83,
    koreaRelevance: 67,
    risk: 36,
    importance: 78,
    velocity: 72
  },
  {
    id: "google-ai-blog",
    publisher: "Google AI",
    homeUrl: "https://blog.google/technology/ai/",
    feedUrl: "https://blog.google/technology/ai/rss/",
    sourceType: "official",
    reliability: 5,
    categories: ["models", "research", "infra"],
    audiences: ["developer", "researcher", "leader"],
    practicalValue: 80,
    koreaRelevance: 60,
    risk: 38,
    importance: 79,
    velocity: 70
  }
];

const CATEGORY_PRIORITY = ["models", "agents", "infra", "open_source", "research", "business", "policy"];
const AUDIENCE_PRIORITY = [
  "developer",
  "pm",
  "leader",
  "learner",
  "researcher",
  "founder",
  "creator",
  "decision_maker"
];
const AUDIENCE_LABELS = {
  developer: "개발자",
  pm: "PM",
  leader: "리더",
  learner: "학습자",
  researcher: "리서처",
  founder: "창업자",
  creator: "콘텐츠",
  decision_maker: "의사결정"
};
const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "into",
  "our",
  "your",
  "their",
  "they",
  "them",
  "you",
  "are",
  "how",
  "why",
  "what",
  "when",
  "where",
  "while",
  "using",
  "used",
  "over",
  "under",
  "have",
  "has",
  "had",
  "more",
  "most",
  "less",
  "latest",
  "introducing",
  "introduce",
  "announcing",
  "announced",
  "announce",
  "new",
  "next",
  "phase",
  "update",
  "updates",
  "official",
  "news",
  "blog",
  "article",
  "articles",
  "openai",
  "google",
  "hugging",
  "face",
  "googleai",
  "team",
  "teams",
  "family",
  "running",
  "https",
  "http",
  "image",
  "words",
  "ready",
  "set",
  "shared",
  "making",
  "helpful",
  "everyone",
  "everything",
  "see",
  "things"
]);
const GENERIC_KEYWORDS = new Set([
  "ai",
  "models",
  "model",
  "system",
  "systems",
  "platform",
  "platforms",
  "technology",
  "technologies",
  "company",
  "companies",
  "research",
  "business"
]);
const DEFAULT_MAX_ITEMS_PER_FEED = 4;
const DEFAULT_TIMEOUT_SECONDS = 15;
const MAX_FEED_BYTES = 600_000;

function clamp(value, lower, upper) {
  return Math.max(lower, Math.min(upper, value));
}

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function stripCdata(value) {
  return String(value || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

function decodeEntities(value) {
  return stripCdata(value)
    .replace(/&#(\d+);/g, (_, code) => safeCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => safeCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function safeCodePoint(codePoint) {
  if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
    return "";
  }
  return String.fromCodePoint(codePoint);
}

function collapseText(value) {
  return decodeEntities(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tagPattern(name) {
  return name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractBlocks(xmlText, tagName) {
  const tag = tagPattern(tagName);
  const pattern = new RegExp(`<(?:[\\w-]+:)?${tag}\\b[^>]*>[\\s\\S]*?<\\/(?:[\\w-]+:)?${tag}>`, "gi");
  return xmlText.match(pattern) || [];
}

function firstTagText(block, names) {
  for (const name of names) {
    const tag = tagPattern(name);
    const pattern = new RegExp(`<(?:[\\w-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}>`, "i");
    const match = block.match(pattern);
    if (match?.[1]) {
      return collapseText(match[1]);
    }
  }
  return "";
}

function allTagTexts(block, name) {
  const tag = tagPattern(name);
  const pattern = new RegExp(`<(?:[\\w-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}>`, "gi");
  return Array.from(block.matchAll(pattern), (match) => collapseText(match[1])).filter(Boolean);
}

function tagAttribute(block, tagName, attrName) {
  const tag = tagPattern(tagName);
  const attr = tagPattern(attrName);
  const pattern = new RegExp(`<(?:[\\w-]+:)?${tag}\\b[^>]*\\s${attr}=["']([^"']+)["'][^>]*>`, "i");
  const match = block.match(pattern);
  return match?.[1] ? decodeEntities(match[1]).trim() : "";
}

function atomLink(block) {
  const linkBlocks = block.match(/<(?:[\w-]+:)?link\b[^>]*>/gi) || [];
  for (const linkBlock of linkBlocks) {
    const rel = tagAttribute(linkBlock, "link", "rel") || "alternate";
    const href = tagAttribute(linkBlock, "link", "href");
    if (href && (rel === "alternate" || rel === "")) {
      return href;
    }
  }
  return tagAttribute(block, "link", "href") || firstTagText(block, ["link"]);
}

function atomCategories(block) {
  const categoryBlocks = block.match(/<(?:[\w-]+:)?category\b[^>]*>/gi) || [];
  return categoryBlocks.map((category) => tagAttribute(category, "category", "term")).filter(Boolean);
}

function parseTimestamp(value, fallback = new Date()) {
  const rawValue = String(value || "").trim();
  if (!rawValue) {
    return fallback;
  }
  const parsed = new Date(rawValue);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function isoformatUtc(value) {
  return value.toISOString().replace(".000Z", "Z");
}

export function parseFeedEntries(feed, xmlText, generatedAt = new Date().toISOString()) {
  const fallbackDate = parseTimestamp(generatedAt);
  const trimmedXml = String(xmlText || "").trim();
  const isAtom = /<feed\b/i.test(trimmedXml);
  const entries = [];

  if (isAtom) {
    for (const entry of extractBlocks(trimmedXml, "entry")) {
      const title = firstTagText(entry, ["title"]);
      const url = atomLink(entry);
      const summary = firstTagText(entry, ["summary", "content"]);
      const publishedAt = parseTimestamp(firstTagText(entry, ["updated", "published"]), fallbackDate);
      if (title && url) {
        entries.push({
          title,
          url,
          summary,
          publishedAt: isoformatUtc(publishedAt),
          tags: atomCategories(entry)
        });
      }
    }
    return entries;
  }

  for (const item of extractBlocks(trimmedXml, "item")) {
    const title = firstTagText(item, ["title"]);
    const url = firstTagText(item, ["link"]) || firstTagText(item, ["guid"]);
    const summary = firstTagText(item, ["description", "encoded", "content", "summary"]);
    const publishedAt = parseTimestamp(firstTagText(item, ["pubDate", "updated", "published", "date"]), fallbackDate);
    if (title && url) {
      entries.push({
        title,
        url,
        summary,
        publishedAt: isoformatUtc(publishedAt),
        tags: allTagTexts(item, "category")
      });
    }
  }
  return entries;
}

function orderedUnique(values, priority = []) {
  const seen = new Set();
  const ordered = [];
  for (const value of priority) {
    if (values.includes(value) && !seen.has(value)) {
      ordered.push(value);
      seen.add(value);
    }
  }
  for (const value of values) {
    if (!seen.has(value)) {
      ordered.push(value);
      seen.add(value);
    }
  }
  return ordered;
}

function tokenizeTopicText(value) {
  const normalized = String(value || "").toLowerCase().replace(/i\/o/g, " io ").replace(/&/g, " and ");
  const tokens = normalized.match(/[a-z0-9][a-z0-9.-]{1,24}/g) || [];
  return tokens
    .map((token) => token.replace(/\.+$/g, ""))
    .filter((token) => token && !STOPWORDS.has(token))
    .filter((token) => token.length > 2 || token === "io" || token === "ml");
}

function deriveCategories(feed, entry) {
  const haystack = [entry.title, entry.summary || "", (entry.tags || []).join(" "), feed.publisher].join(" ").toLowerCase();
  const categories = [...feed.categories];
  const keywordMap = {
    agents: ["agent", "assistant", "tool", "mcp", "workflow", "codex"],
    infra: ["infra", "inference", "deployment", "serving", "chip", "latency", "runtime", "beam"],
    open_source: ["open source", "opensource", "github", "community", "transformers", "library"],
    research: ["research", "paper", "study", "benchmark", "science", "geometry"],
    business: ["enterprise", "company", "pricing", "adoption", "customer", "business", "countries"],
    policy: ["policy", "safety", "government", "regulation", "security"],
    models: ["model", "llm", "gpt", "gemma", "agentic", "reasoning", "reranker", "ocr"]
  };

  for (const [category, keywords] of Object.entries(keywordMap)) {
    if (keywords.some((keyword) => haystack.includes(keyword))) {
      categories.push(category);
    }
  }

  return orderedUnique(categories, CATEGORY_PRIORITY);
}

function deriveAudiences(feed, categories) {
  const audiences = [...feed.audiences];
  if (categories.includes("business") || categories.includes("policy")) {
    audiences.push("pm", "leader", "decision_maker");
  }
  if (categories.includes("research")) {
    audiences.push("researcher", "learner");
  }
  if (categories.includes("open_source") || categories.includes("infra") || categories.includes("agents")) {
    audiences.push("developer");
  }
  return orderedUnique(audiences, AUDIENCE_PRIORITY);
}

function deriveTags(feed, entry, categories) {
  const tags = [feed.id, feed.publisher.toLowerCase().replace(/\s+/g, "-"), ...categories];
  const feedTags = (entry.tags || []).join(" ").toLowerCase().match(/[a-z0-9][a-z0-9-.]{2,24}/g) || [];
  return orderedUnique([...tags, ...feedTags]).slice(0, 12);
}

function deriveSignalType(categories) {
  if (categories.includes("policy")) return "policy";
  if (categories.includes("research")) return "paper";
  if (categories.includes("agents")) return "release";
  if (categories.includes("open_source")) return "repo_growth";
  if (categories.includes("infra")) return "analysis";
  return "update";
}

function deriveTopicTokens(feed, entry) {
  const url = new URL(entry.url, feed.homeUrl);
  const pathHint = url.pathname.replace(/\//g, " ").replace(/-/g, " ");
  const combined = [entry.title.replace(/I\/O/g, "IO"), entry.summary || "", (entry.tags || []).join(" "), pathHint].join(" ");
  const publisherTokens = new Set(feed.publisher.toLowerCase().split(/\s+/g));
  const filtered = tokenizeTopicText(combined).filter((token) => !GENERIC_KEYWORDS.has(token) && !publisherTokens.has(token));
  const specialTokens = [];
  if (filtered.includes("io") && filtered.includes("2026")) specialTokens.push("io-2026");
  if (filtered.includes("codex")) specialTokens.push("codex");
  if (filtered.includes("gemini")) specialTokens.push("gemini");
  if (filtered.includes("singapore")) specialTokens.push("singapore");
  return orderedUnique([...specialTokens, ...filtered]).slice(0, 8);
}

function derivePrimaryTopic(tokens) {
  if (!tokens.length) return "official-update";
  return tokens.find((token) => !["2025", "2026", "2027"].includes(token)) || tokens[0];
}

function isRelevantEntry(feed, entry) {
  if (feed.id !== "google-ai-blog") {
    return true;
  }
  const url = entry.url.toLowerCase();
  const haystack = [entry.title, entry.summary || "", (entry.tags || []).join(" "), url].join(" ").toLowerCase();
  if (["/technology/ai/", "/models-and-research/", "/developers-tools/"].some((segment) => url.includes(segment))) {
    return true;
  }
  if (["community investments", "energy programs", "global network", "google.org", "missouri"].some((bad) => haystack.includes(bad))) {
    return false;
  }
  return ["gemini", "model", "models", "research", "developer", "machine learning", "workspace", "beam"].some((keyword) =>
    haystack.includes(keyword)
  );
}

function computeEntrySignalScores(feed, entry, categories, generatedAt) {
  const publishedAt = parseTimestamp(entry.publishedAt);
  const collectedAt = parseTimestamp(generatedAt);
  const ageHours = Math.max(0, (collectedAt.getTime() - publishedAt.getTime()) / 3_600_000);
  const freshness = Math.max(0, 96 - ageHours);
  const sourceStrength = feed.reliability * 8;
  const categoryBonus = categories.includes("agents") || categories.includes("models") ? 4 : 0;
  const researchBonus = categories.includes("research") ? 4 : 0;

  return {
    importance: clamp(Math.trunc(feed.importance * 0.55 + sourceStrength + freshness / 4 + categoryBonus), 48, 94),
    velocity: clamp(Math.trunc(feed.velocity * 0.65 + freshness / 3 + categories.length * 2), 36, 94),
    practicalValue: clamp(feed.practicalValue + (categories.includes("infra") || categories.includes("agents") ? 5 : 0), 34, 95),
    koreaRelevance: clamp(feed.koreaRelevance + (categories.includes("open_source") ? 6 : 0), 28, 95),
    risk: clamp(feed.risk + (categories.includes("policy") ? 8 : 0) + researchBonus, 18, 95),
    direction: ageHours <= 72 ? "rising" : "stable"
  };
}

function buildEntryRecord(feed, entry, generatedAt) {
  const categories = deriveCategories(feed, entry);
  const audiences = deriveAudiences(feed, categories);
  const tags = deriveTags(feed, entry, categories);
  const topicTokens = deriveTopicTokens(feed, entry);
  const recordHash = stableHash(entry.url);
  const sourceId = `src-${feed.id}-${recordHash}`;
  const signalId = `sig-${feed.id}-${recordHash}`;
  const entryScores = computeEntrySignalScores(feed, entry, categories, generatedAt);
  const source = {
    id: sourceId,
    type: feed.sourceType,
    publisher: feed.publisher,
    title: entry.title,
    url: entry.url,
    reliability: feed.reliability,
    publishedAt: entry.publishedAt
  };
  const signal = {
    id: signalId,
    issueId: "",
    sourceId,
    type: deriveSignalType(categories),
    title: `${feed.publisher} 공식 피드 업데이트`,
    strength: entryScores.importance,
    velocity: entryScores.velocity,
    evidenceText: feed.feedUrl
  };

  return {
    feed,
    entry,
    source,
    signal,
    categories,
    audiences,
    tags,
    topicTokens,
    primaryTopic: derivePrimaryTopic(topicTokens),
    entryScores
  };
}

function clusterSimilarity(left, right) {
  const leftTokens = new Set(left.topicTokens);
  const rightTokens = new Set(right.topicTokens);
  if (!leftTokens.size || !rightTokens.size) return 0;
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  let score = union ? overlap / union : 0;
  if (overlap >= 2) score += 0.18;
  if (left.primaryTopic === right.primaryTopic) score += 0.2;
  if (left.feed.publisher === right.feed.publisher && overlap >= 1) score += 0.08;
  return score;
}

function clusterRecords(records) {
  const clusters = [];
  const sortedRecords = [...records].sort((left, right) => right.source.publishedAt.localeCompare(left.source.publishedAt));
  for (const record of sortedRecords) {
    let bestIndex = -1;
    let bestScore = 0;
    clusters.forEach((cluster, index) => {
      const score = Math.max(...cluster.map((existing) => clusterSimilarity(record, existing)));
      if (score > bestScore) {
        bestIndex = index;
        bestScore = score;
      }
    });
    if (bestIndex >= 0 && bestScore >= 0.45) {
      clusters[bestIndex].push(record);
    } else {
      clusters.push([record]);
    }
  }
  return clusters;
}

function selectClusterTitle(cluster) {
  const ranked = [...cluster].sort((left, right) => {
    const reliabilityDelta = right.source.reliability - left.source.reliability;
    if (reliabilityDelta) return reliabilityDelta;
    const dateDelta = left.source.publishedAt.localeCompare(right.source.publishedAt);
    if (dateDelta) return dateDelta;
    return left.source.title.length - right.source.title.length;
  });
  const title = ranked[0].source.title;
  return cluster.length === 1 ? title : `${title} 외 ${cluster.length - 1}건`;
}

function aggregateClusterScores(cluster, categories, audiences, generatedAt) {
  const strengths = cluster.map((record) => record.signal.strength);
  const velocities = cluster.map((record) => record.signal.velocity);
  const generatedTime = parseTimestamp(generatedAt);
  const newestAgeHours = Math.min(
    ...cluster.map((record) => Math.max(0, (generatedTime.getTime() - parseTimestamp(record.source.publishedAt).getTime()) / 3_600_000))
  );
  const publisherCount = new Set(cluster.map((record) => record.source.publisher)).size;
  const sourceCount = cluster.length;
  const avgStrength = strengths.reduce((sum, value) => sum + value, 0) / strengths.length;
  const avgVelocity = velocities.reduce((sum, value) => sum + value, 0) / velocities.length;
  const importance = clamp(Math.trunc(avgStrength * 0.72 + publisherCount * 6 + (sourceCount - 1) * 5 + categories.length * 2), 50, 96);
  const velocity = clamp(Math.trunc(avgVelocity * 0.68 + (96 - newestAgeHours) / 3 + (sourceCount - 1) * 4), 35, 96);
  const practicalValue = clamp(
    Math.trunc(42 + importance * 0.32 + (categories.includes("agents") || categories.includes("infra") ? 6 : 0) + (publisherCount > 1 ? 5 : 0)),
    35,
    95
  );
  const koreaRelevance = clamp(
    Math.trunc(
      34 +
        (categories.includes("open_source") ? 8 : 0) +
        (categories.includes("business") ? 6 : 0) +
        (categories.includes("policy") ? 4 : 0) +
        audiences.length * 2
    ),
    28,
    95
  );
  const risk = clamp(
    Math.trunc(
      18 +
        Math.max(...strengths) * 0.25 +
        (categories.includes("policy") ? 8 : 0) +
        (categories.includes("agents") ? 6 : 0) +
        (publisherCount > 1 ? 4 : 0)
    ),
    16,
    95
  );
  return {
    importance,
    velocity,
    practicalValue,
    koreaRelevance,
    risk,
    direction: newestAgeHours <= 72 ? "rising" : "stable"
  };
}

function buildClusterSummary(cluster, categories, audiences) {
  const primary = [...cluster].sort((left, right) => right.signal.strength - left.signal.strength || right.source.publishedAt.localeCompare(left.source.publishedAt))[0];
  const publishers = orderedUnique(cluster.map((record) => record.source.publisher));
  const audienceText = audiences
    .slice(0, 4)
    .map((audience) => AUDIENCE_LABELS[audience] || audience)
    .join(", ");

  if (cluster.length === 1) {
    const cleanedSummary = (collapseText(primary.entry.summary) || "공식 피드에서 새 업데이트가 확인됐다.").slice(0, 240);
    return {
      whatHappened: cleanedSummary,
      whyMatters: `${primary.source.publisher} 공식 채널 업데이트라서 신뢰도는 높고, ${categories.slice(0, 2).join(", ")} 흐름 판단에 바로 쓸 수 있다.`,
      whoAffected: audienceText,
      nextAction: "원문에서 릴리즈 범위와 실제 적용 대상을 먼저 확인한다."
    };
  }

  const mainTopic = primary.primaryTopic.replace(/-/g, " ");
  return {
    whatHappened: `${publishers.slice(0, 2).join(", ")} 등 ${cluster.length}개 공식 출처에서 ${mainTopic} 관련 업데이트가 묶여 포착됐다.`,
    whyMatters: `출처가 여러 개라 단일 발표보다 흐름 신호로 보기 좋고, ${categories.slice(0, 3).join(", ")} 판단 정확도를 높여준다.`,
    whoAffected: audienceText,
    nextAction: "출처별 강조점이 같은지 비교하고, 실제 제품 변화인지 단순 행사 묶음인지 구분한다."
  };
}

function buildClusterIssue(cluster, generatedAt) {
  const categories = orderedUnique(cluster.flatMap((record) => record.categories), CATEGORY_PRIORITY);
  const audiences = orderedUnique(cluster.flatMap((record) => record.audiences), AUDIENCE_PRIORITY);
  const tags = orderedUnique(cluster.flatMap((record) => record.tags)).slice(0, 12);
  const sourceIds = cluster.map((record) => record.source.id);
  const signalIds = cluster.map((record) => record.signal.id);
  const updatedAt = cluster.map((record) => record.source.publishedAt).sort().at(-1);
  const issueId = `issue-${stableHash(sourceIds.slice().sort().join("|"))}`;
  const scores = aggregateClusterScores(cluster, categories, audiences, generatedAt);
  const publishers = orderedUnique(cluster.map((record) => record.source.publisher));

  for (const record of cluster) {
    record.signal.issueId = issueId;
  }

  return {
    id: issueId,
    title: selectClusterTitle(cluster),
    conclusion:
      cluster.length > 1
        ? `${publishers.slice(0, 2).join(", ")} 공식 채널에서 같은 흐름의 업데이트가 확인됐다.`
        : `${publishers[0]} 공식 채널에서 새 업데이트가 확인됐다. 원문 확인 우선순위가 있는 항목이다.`,
    categories,
    tags,
    certainty: "confirmed",
    importance: scores.importance,
    velocity: scores.velocity,
    practicalValue: scores.practicalValue,
    koreaRelevance: scores.koreaRelevance,
    risk: scores.risk,
    direction: scores.direction,
    audiences,
    sourceIds,
    signalIds,
    updatedAt,
    summary: buildClusterSummary(cluster, categories, audiences),
    timeline: [
      ...cluster.slice(0, 4).map((record) => `${record.source.publisher} 게시: ${record.source.publishedAt}`),
      `Lokana 수집/클러스터링: ${generatedAt}`
    ],
    validation: [
      ...cluster.slice(0, 4).map((record) => `공식 피드 확인: ${record.feed.feedUrl}`),
      ...cluster.slice(0, 3).map((record) => `원문 페이지 확인: ${record.source.url}`)
    ]
  };
}

function buildWatchlists(issues, publisherIssueMap) {
  const latestIssueIds = [...issues]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 10)
    .map((issue) => issue.id);
  const crossSourceIds = issues.filter((issue) => issue.sourceIds.length > 1).map((issue) => issue.id);
  const watchlists = [
    {
      id: "wl-official-latest",
      label: "최근 공식 피드",
      kind: "curated",
      query: "official-latest",
      issueIds: latestIssueIds,
      change: `${latestIssueIds.length}건 추적 중`
    }
  ];

  if (crossSourceIds.length) {
    watchlists.push({
      id: "wl-cross-source",
      label: "교차 출처 이슈",
      kind: "clustered",
      query: "cross-source",
      issueIds: crossSourceIds.slice(0, 8),
      change: `${crossSourceIds.length}건 교차 확인`
    });
  }

  for (const [publisher, issueIds] of Object.entries(publisherIssueMap).sort(([left], [right]) => left.localeCompare(right))) {
    const dedupedIds = orderedUnique(issueIds).slice(0, 8);
    watchlists.push({
      id: `wl-${publisher.toLowerCase().replace(/\s+/g, "-")}`,
      label: publisher,
      kind: "publisher",
      query: publisher.toLowerCase().replace(/\s+/g, "-"),
      issueIds: dedupedIds,
      change: `${dedupedIds.length}건 수집`
    });
  }

  return watchlists;
}

function collectorSettingNumber(value, fallback, lower, upper) {
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

async function fetchFeedXml(feed, fetchFn, timeoutSeconds) {
  const response = await fetchFn(feed.feedUrl, {
    headers: {
      "User-Agent": "lokana-worker/0.1 (+https://github.com/topar12/ai-tech-radar-kr)",
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.1"
    },
    signal: timeoutSignal(timeoutSeconds)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentLength = Number(response.headers?.get?.("content-length") || 0);
  if (contentLength > MAX_FEED_BYTES) {
    throw new Error(`Feed too large: ${contentLength} bytes`);
  }

  const text = await response.text();
  if (text.length > MAX_FEED_BYTES) {
    throw new Error(`Feed too large: ${text.length} chars`);
  }
  return text;
}

function buildPayload(dataset, generatedAt) {
  return {
    ...buildBootstrapLabels(),
    sources: dataset.sources,
    signals: dataset.signals,
    issues: dataset.issues,
    watchlists: dataset.watchlists,
    generatedAt
  };
}

export async function collectOfficialFeedDataset(options = {}) {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const feeds = options.feeds || OFFICIAL_FEEDS;
  const fetchFn = options.fetchFn || fetch;
  const maxItemsPerFeed = collectorSettingNumber(
    options.maxItemsPerFeed ?? options.env?.COLLECTOR_MAX_ITEMS_PER_FEED,
    DEFAULT_MAX_ITEMS_PER_FEED,
    1,
    12
  );
  const timeoutSeconds = collectorSettingNumber(
    options.timeoutSeconds ?? options.env?.COLLECTOR_TIMEOUT_SECONDS,
    DEFAULT_TIMEOUT_SECONDS,
    3,
    60
  );
  const seenUrls = new Set();
  const entryRecords = [];
  const feedResults = [];

  for (const feed of feeds) {
    try {
      const xmlText = await fetchFeedXml(feed, fetchFn, timeoutSeconds);
      const rawEntries = parseFeedEntries(feed, xmlText, generatedAt);
      let accepted = 0;
      let filtered = 0;
      let duplicates = 0;

      for (const entry of rawEntries) {
        if (accepted >= maxItemsPerFeed) break;
        if (!isRelevantEntry(feed, entry)) {
          filtered += 1;
          continue;
        }
        if (seenUrls.has(entry.url)) {
          duplicates += 1;
          continue;
        }
        seenUrls.add(entry.url);
        entryRecords.push(buildEntryRecord(feed, entry, generatedAt));
        accepted += 1;
      }

      feedResults.push({
        id: feed.id,
        publisher: feed.publisher,
        feedUrl: feed.feedUrl,
        status: "completed",
        fetchedEntries: rawEntries.length,
        filteredEntries: filtered,
        duplicateEntries: duplicates,
        acceptedEntries: accepted
      });
    } catch (error) {
      feedResults.push({
        id: feed.id,
        publisher: feed.publisher,
        feedUrl: feed.feedUrl,
        status: "failed",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const clusters = clusterRecords(entryRecords);
  const issues = [];
  const signals = [];
  const sources = [];
  const publisherIssueMap = {};

  for (const cluster of clusters) {
    const issue = buildClusterIssue(cluster, generatedAt);
    issues.push(issue);
    for (const record of cluster) {
      signals.push(record.signal);
      sources.push(record.source);
      publisherIssueMap[record.source.publisher] ||= [];
      publisherIssueMap[record.source.publisher].push(issue.id);
    }
  }

  issues.sort((left, right) => right.importance - left.importance || right.velocity - left.velocity || right.updatedAt.localeCompare(left.updatedAt));
  signals.sort((left, right) => right.strength - left.strength || right.velocity - left.velocity);
  sources.sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));

  const mimoSummary = await maybeSummarizeIssuesWithMimo({
    env: options.env,
    issues,
    sources,
    fetchFn
  });
  issues.splice(0, issues.length, ...mimoSummary.issues);

  const watchlists = buildWatchlists(issues, publisherIssueMap);
  const dataset = { sources, signals, issues, watchlists };
  const details = {
    feeds: feedResults,
    summarizer: mimoSummary.details,
    collectedSourceCount: sources.length,
    collectedSignalCount: signals.length,
    collectedWatchlistCount: watchlists.length,
    rawEntryCount: entryRecords.length,
    clusteredIssueCount: issues.length,
    multiSourceIssueCount: issues.filter((issue) => issue.sourceIds.length > 1).length
  };

  if (!issues.length) {
    throw new Error("Official feed collection returned no issues.");
  }

  return {
    dataset,
    payload: buildPayload(dataset, generatedAt),
    details,
    generatedAt
  };
}

export function collectJobStatus(details = {}) {
  const feeds = Array.isArray(details.feeds) ? details.feeds : [];
  const hasFailedFeed = feeds.some((feed) => feed.status !== "completed");
  const hasEmptyFeed = feeds.some((feed) => feed.status === "completed" && Number(feed.acceptedEntries || 0) === 0);
  const summarizerStatus = details.summarizer?.status;
  const hasSummaryWarning = summarizerStatus === "failed" || summarizerStatus === "partial";
  return hasFailedFeed || hasEmptyFeed || hasSummaryWarning ? "completed_with_warnings" : "completed";
}
