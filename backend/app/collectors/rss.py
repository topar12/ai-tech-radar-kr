from __future__ import annotations

import hashlib
import re
import ssl
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html import unescape
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from xml.etree import ElementTree

from app.settings import get_settings


@dataclass(frozen=True)
class FeedDefinition:
    id: str
    publisher: str
    home_url: str
    feed_url: str
    source_type: str
    reliability: int
    categories: tuple[str, ...]
    audiences: tuple[str, ...]
    practical_value: int
    korea_relevance: int
    risk: int
    importance: int
    velocity: int


OFFICIAL_FEEDS: tuple[FeedDefinition, ...] = (
    FeedDefinition(
        id="openai-news",
        publisher="OpenAI",
        home_url="https://openai.com/blog",
        feed_url="https://openai.com/news/rss.xml",
        source_type="official",
        reliability=5,
        categories=("models", "agents", "business"),
        audiences=("developer", "pm", "leader"),
        practical_value=86,
        korea_relevance=62,
        risk=42,
        importance=82,
        velocity=76,
    ),
    FeedDefinition(
        id="huggingface-blog",
        publisher="Hugging Face",
        home_url="https://huggingface.co/blog",
        feed_url="https://huggingface.co/blog/feed.xml",
        source_type="official",
        reliability=4,
        categories=("models", "open_source", "research"),
        audiences=("developer", "researcher", "learner"),
        practical_value=83,
        korea_relevance=67,
        risk=36,
        importance=78,
        velocity=72,
    ),
    FeedDefinition(
        id="google-ai-blog",
        publisher="Google AI",
        home_url="https://blog.google/technology/ai/",
        feed_url="https://blog.google/technology/ai/rss/",
        source_type="official",
        reliability=5,
        categories=("models", "research", "infra"),
        audiences=("developer", "researcher", "leader"),
        practical_value=80,
        korea_relevance=60,
        risk=38,
        importance=79,
        velocity=70,
    ),
)

CATEGORY_PRIORITY = ("models", "agents", "infra", "open_source", "research", "business", "policy")
AUDIENCE_PRIORITY = (
    "developer",
    "pm",
    "leader",
    "learner",
    "researcher",
    "founder",
    "creator",
    "decision_maker",
)
AUDIENCE_LABELS = {
    "developer": "개발자",
    "pm": "PM",
    "leader": "리더",
    "learner": "학습자",
    "researcher": "리서처",
    "founder": "창업자",
    "creator": "콘텐츠",
    "decision_maker": "의사결정",
}
STOPWORDS = {
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
    "using",
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
    "things",
}
GENERIC_KEYWORDS = {
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
    "business",
}


def clamp(value: int, lower: int, upper: int) -> int:
    return max(lower, min(upper, value))


def local_name(tag: str) -> str:
    return tag.split("}", 1)[-1]


def collapse_text(value: str) -> str:
    text = re.sub(r"<[^>]+>", " ", value or "")
    text = re.sub(r"\s+", " ", unescape(text)).strip()
    return text


def stable_hash(value: str) -> str:
    return hashlib.sha1(value.encode("utf-8")).hexdigest()[:12]


def parse_timestamp(raw_value: str) -> datetime:
    value = (raw_value or "").strip()
    if not value:
        return datetime.now(timezone.utc)
    try:
        parsed = parsedate_to_datetime(value)
    except (TypeError, ValueError, IndexError):
        cleaned = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(cleaned)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def isoformat_utc(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def request_context() -> ssl.SSLContext:
    settings = get_settings()
    cert_file = Path(settings.ssl_cert_file)
    if cert_file.exists():
        return ssl.create_default_context(cafile=str(cert_file))
    return ssl.create_default_context()


def fetch_feed_xml(feed: FeedDefinition) -> str:
    settings = get_settings()
    request = urllib.request.Request(
        feed.feed_url,
        headers={
            "User-Agent": "localai-radar/0.1 (+https://github.com/topar12/ai-tech-radar-kr)",
            "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.1",
        },
    )
    with urllib.request.urlopen(
        request,
        timeout=settings.collector_timeout_seconds,
        context=request_context(),
    ) as response:
        return response.read().decode("utf-8", "ignore")


def first_text(element: ElementTree.Element, *names: str) -> str:
    wanted = set(names)
    for child in list(element):
        if local_name(child.tag) in wanted:
            if child.text:
                return child.text.strip()
            for descendant in child.itertext():
                if descendant.strip():
                    return descendant.strip()
    return ""


def all_texts(element: ElementTree.Element, name: str) -> list[str]:
    values: list[str] = []
    for child in list(element):
        if local_name(child.tag) != name:
            continue
        if child.text and child.text.strip():
            values.append(child.text.strip())
    return values


def atom_link(entry: ElementTree.Element) -> str:
    for child in list(entry):
        if local_name(child.tag) != "link":
            continue
        href = child.attrib.get("href", "").strip()
        rel = child.attrib.get("rel", "alternate").strip()
        if href and rel in {"alternate", ""}:
            return href
    for child in list(entry):
        if local_name(child.tag) == "link" and child.attrib.get("href", "").strip():
            return child.attrib["href"].strip()
    return ""


def atom_categories(entry: ElementTree.Element) -> list[str]:
    tags: list[str] = []
    for child in list(entry):
        if local_name(child.tag) != "category":
            continue
        term = child.attrib.get("term", "").strip()
        if term:
            tags.append(term)
    return tags


def parse_feed_entries(feed: FeedDefinition, xml_text: str) -> list[dict[str, Any]]:
    root = ElementTree.fromstring(xml_text)
    root_name = local_name(root.tag)
    entries: list[dict[str, Any]] = []

    if root_name == "rss":
        channel = next((child for child in list(root) if local_name(child.tag) == "channel"), None)
        if channel is None:
            return entries
        for item in list(channel):
            if local_name(item.tag) != "item":
                continue
            title = collapse_text(first_text(item, "title"))
            link = first_text(item, "link")
            summary = collapse_text(first_text(item, "description", "encoded", "content", "summary"))
            published_at = parse_timestamp(first_text(item, "pubDate", "updated", "published", "date"))
            tags = [collapse_text(tag) for tag in all_texts(item, "category")]
            if title and link:
                entries.append(
                    {
                        "title": title,
                        "url": link.strip(),
                        "summary": summary,
                        "publishedAt": isoformat_utc(published_at),
                        "tags": [tag for tag in tags if tag],
                    }
                )
        return entries

    if root_name == "feed":
        for entry in list(root):
            if local_name(entry.tag) != "entry":
                continue
            title = collapse_text(first_text(entry, "title"))
            link = atom_link(entry)
            summary = collapse_text(first_text(entry, "summary", "content"))
            published_at = parse_timestamp(first_text(entry, "updated", "published"))
            tags = [collapse_text(tag) for tag in atom_categories(entry)]
            if title and link:
                entries.append(
                    {
                        "title": title,
                        "url": link.strip(),
                        "summary": summary,
                        "publishedAt": isoformat_utc(published_at),
                        "tags": [tag for tag in tags if tag],
                    }
                )
        return entries

    raise ValueError(f"Unsupported feed root: {root.tag}")


def ordered_unique(values: list[str], priority: tuple[str, ...]) -> list[str]:
    seen = set()
    ordered = [value for value in priority if value in values and not (value in seen or seen.add(value))]
    for value in values:
        if value not in seen:
            ordered.append(value)
            seen.add(value)
    return ordered


def tokenize_topic_text(value: str) -> list[str]:
    normalized = value.lower().replace("i/o", " io ").replace("&", " and ")
    tokens = re.findall(r"[a-z0-9][a-z0-9\.\-]{1,24}", normalized)
    cleaned: list[str] = []
    for token in tokens:
        token = token.strip(".")
        if token in STOPWORDS:
            continue
        if len(token) <= 2 and token not in {"io", "ml"}:
            continue
        cleaned.append(token)
    return cleaned


def derive_categories(feed: FeedDefinition, entry: dict[str, Any]) -> list[str]:
    haystack = " ".join(
        [entry["title"], entry.get("summary", ""), " ".join(entry.get("tags", [])), feed.publisher]
    ).lower()
    categories = list(feed.categories)
    keyword_map = {
        "agents": ("agent", "assistant", "tool", "mcp", "workflow", "codex"),
        "infra": ("infra", "inference", "deployment", "serving", "chip", "latency", "runtime", "beam"),
        "open_source": ("open source", "opensource", "github", "community", "transformers", "library"),
        "research": ("research", "paper", "study", "benchmark", "science", "geometry"),
        "business": ("enterprise", "company", "pricing", "adoption", "customer", "business", "countries"),
        "policy": ("policy", "safety", "government", "regulation", "security"),
        "models": ("model", "llm", "gpt", "gemma", "agentic", "reasoning", "reranker", "ocr"),
    }
    for category, keywords in keyword_map.items():
        if any(keyword in haystack for keyword in keywords):
            categories.append(category)
    return ordered_unique(categories, CATEGORY_PRIORITY)


def derive_audiences(feed: FeedDefinition, categories: list[str]) -> list[str]:
    audiences = list(feed.audiences)
    if "business" in categories or "policy" in categories:
        audiences.extend(["pm", "leader", "decision_maker"])
    if "research" in categories:
        audiences.extend(["researcher", "learner"])
    if "open_source" in categories or "infra" in categories or "agents" in categories:
        audiences.append("developer")
    return ordered_unique(audiences, AUDIENCE_PRIORITY)


def derive_tags(feed: FeedDefinition, entry: dict[str, Any], categories: list[str]) -> list[str]:
    tags = [feed.id, feed.publisher.lower().replace(" ", "-")]
    for category in categories:
        tags.append(category)
    tags.extend(re.findall(r"[a-z0-9][a-z0-9\-\.]{2,24}", " ".join(entry.get("tags", [])).lower()))
    return ordered_unique(tags[:12], tuple())


def derive_signal_type(categories: list[str]) -> str:
    if "policy" in categories:
        return "policy"
    if "research" in categories:
        return "paper"
    if "agents" in categories:
        return "release"
    if "open_source" in categories:
        return "repo_growth"
    if "infra" in categories:
        return "analysis"
    return "update"


def derive_topic_tokens(feed: FeedDefinition, entry: dict[str, Any]) -> list[str]:
    title = entry["title"].replace("I/O", "IO").replace("I/O", "IO")
    parsed = urlparse(entry["url"])
    path_hint = parsed.path.replace("/", " ").replace("-", " ")
    combined = " ".join([title, entry.get("summary", ""), " ".join(entry.get("tags", [])), path_hint])
    tokens = tokenize_topic_text(combined)
    filtered = [token for token in tokens if token not in GENERIC_KEYWORDS and token not in feed.publisher.lower().split()]
    special_tokens: list[str] = []
    if "io" in filtered and "2026" in filtered:
        special_tokens.append("io-2026")
    if "codex" in filtered:
        special_tokens.append("codex")
    if "gemini" in filtered:
        special_tokens.append("gemini")
    if "singapore" in filtered:
        special_tokens.append("singapore")
    seen: set[str] = set()
    ordered: list[str] = []
    for token in [*special_tokens, *filtered]:
        if token not in seen:
            ordered.append(token)
            seen.add(token)
    return ordered[:8]


def derive_primary_topic(tokens: list[str]) -> str:
    if not tokens:
        return "official-update"
    for token in tokens:
        if token not in {"2025", "2026", "2027"}:
            return token
    return tokens[0]


def is_relevant_entry(feed: FeedDefinition, entry: dict[str, Any]) -> bool:
    if feed.id != "google-ai-blog":
        return True
    url = entry["url"].lower()
    haystack = " ".join([entry["title"], entry.get("summary", ""), " ".join(entry.get("tags", [])), url]).lower()
    positive_url_segments = (
        "/technology/ai/",
        "/models-and-research/",
        "/developers-tools/",
    )
    if any(segment in url for segment in positive_url_segments):
        return True
    if any(
        bad in haystack
        for bad in (
            "community investments",
            "energy programs",
            "global network",
            "google.org",
            "missouri",
        )
    ):
        return False
    strong_keywords = ("gemini", "model", "models", "research", "developer", "machine learning", "workspace", "beam")
    return any(keyword in haystack for keyword in strong_keywords)


def compute_entry_signal_scores(
    feed: FeedDefinition,
    entry: dict[str, Any],
    categories: list[str],
    generated_at: str,
) -> dict[str, int | str]:
    published_at = parse_timestamp(entry["publishedAt"])
    collected_at = parse_timestamp(generated_at)
    age_hours = max(0.0, (collected_at - published_at).total_seconds() / 3600)
    freshness = max(0.0, 96.0 - age_hours)
    source_strength = feed.reliability * 8
    category_bonus = 4 if "agents" in categories or "models" in categories else 0
    research_bonus = 4 if "research" in categories else 0
    importance = clamp(int(feed.importance * 0.55 + source_strength + freshness / 4 + category_bonus), 48, 94)
    velocity = clamp(int(feed.velocity * 0.65 + freshness / 3 + len(categories) * 2), 36, 94)
    practical_value = clamp(feed.practical_value + (5 if "infra" in categories or "agents" in categories else 0), 34, 95)
    korea_relevance = clamp(feed.korea_relevance + (6 if "open_source" in categories else 0), 28, 95)
    risk = clamp(feed.risk + (8 if "policy" in categories else 0) + research_bonus, 18, 95)
    direction = "rising" if age_hours <= 72 else "stable"
    return {
        "importance": importance,
        "velocity": velocity,
        "practicalValue": practical_value,
        "koreaRelevance": korea_relevance,
        "risk": risk,
        "direction": direction,
    }


def build_entry_record(feed: FeedDefinition, entry: dict[str, Any], generated_at: str) -> dict[str, Any]:
    categories = derive_categories(feed, entry)
    audiences = derive_audiences(feed, categories)
    tags = derive_tags(feed, entry, categories)
    topic_tokens = derive_topic_tokens(feed, entry)
    record_hash = stable_hash(entry["url"])
    source_id = f"src-{feed.id}-{record_hash}"
    signal_id = f"sig-{feed.id}-{record_hash}"
    entry_scores = compute_entry_signal_scores(feed, entry, categories, generated_at)
    source = {
        "id": source_id,
        "type": feed.source_type,
        "publisher": feed.publisher,
        "title": entry["title"],
        "url": entry["url"],
        "reliability": feed.reliability,
        "publishedAt": entry["publishedAt"],
    }
    signal = {
        "id": signal_id,
        "issueId": "",
        "sourceId": source_id,
        "type": derive_signal_type(categories),
        "title": f"{feed.publisher} 공식 피드 업데이트",
        "strength": entry_scores["importance"],
        "velocity": entry_scores["velocity"],
        "evidenceText": feed.feed_url,
    }
    return {
        "feed": feed,
        "entry": entry,
        "source": source,
        "signal": signal,
        "categories": categories,
        "audiences": audiences,
        "tags": tags,
        "topicTokens": topic_tokens,
        "primaryTopic": derive_primary_topic(topic_tokens),
        "entryScores": entry_scores,
    }


def cluster_similarity(left: dict[str, Any], right: dict[str, Any]) -> float:
    left_tokens = set(left["topicTokens"])
    right_tokens = set(right["topicTokens"])
    if not left_tokens or not right_tokens:
        return 0.0
    overlap = len(left_tokens & right_tokens)
    union = len(left_tokens | right_tokens)
    score = overlap / union if union else 0.0
    if overlap >= 2:
        score += 0.18
    if left["primaryTopic"] == right["primaryTopic"]:
        score += 0.2
    if left["feed"].publisher == right["feed"].publisher and overlap >= 1:
        score += 0.08
    return score


def cluster_records(records: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    clusters: list[list[dict[str, Any]]] = []
    sorted_records = sorted(records, key=lambda record: record["source"]["publishedAt"], reverse=True)
    for record in sorted_records:
        best_index = -1
        best_score = 0.0
        for index, cluster in enumerate(clusters):
            score = max(cluster_similarity(record, existing) for existing in cluster)
            if score > best_score:
                best_index = index
                best_score = score
        if best_index >= 0 and best_score >= 0.45:
            clusters[best_index].append(record)
        else:
            clusters.append([record])
    return clusters


def select_cluster_title(cluster: list[dict[str, Any]]) -> str:
    ranked = sorted(
        cluster,
        key=lambda record: (
            -record["source"]["reliability"],
            record["source"]["publishedAt"],
            len(record["source"]["title"]),
        ),
    )
    title = ranked[0]["source"]["title"]
    if len(cluster) == 1:
        return title
    return f"{title} 외 {len(cluster) - 1}건"


def aggregate_cluster_scores(cluster: list[dict[str, Any]], categories: list[str], audiences: list[str], generated_at: str) -> dict[str, int | str]:
    strengths = [record["signal"]["strength"] for record in cluster]
    velocities = [record["signal"]["velocity"] for record in cluster]
    published_times = [parse_timestamp(record["source"]["publishedAt"]) for record in cluster]
    generated_time = parse_timestamp(generated_at)
    newest_age_hours = min(max(0.0, (generated_time - published).total_seconds() / 3600) for published in published_times)
    publisher_count = len({record["source"]["publisher"] for record in cluster})
    source_count = len(cluster)
    category_diversity = len(categories)
    avg_strength = sum(strengths) / len(strengths)
    avg_velocity = sum(velocities) / len(velocities)

    importance = clamp(int(avg_strength * 0.72 + publisher_count * 6 + (source_count - 1) * 5 + category_diversity * 2), 50, 96)
    velocity = clamp(int(avg_velocity * 0.68 + (96 - newest_age_hours) / 3 + (source_count - 1) * 4), 35, 96)
    practical_value = clamp(
        int(
            42
            + importance * 0.32
            + (6 if "agents" in categories or "infra" in categories else 0)
            + (5 if publisher_count > 1 else 0)
        ),
        35,
        95,
    )
    korea_relevance = clamp(
        int(
            34
            + (8 if "open_source" in categories else 0)
            + (6 if "business" in categories else 0)
            + (4 if "policy" in categories else 0)
            + len(audiences) * 2
        ),
        28,
        95,
    )
    risk = clamp(
        int(
            18
            + max(strengths) * 0.25
            + (8 if "policy" in categories else 0)
            + (6 if "agents" in categories else 0)
            + (4 if publisher_count > 1 else 0)
        ),
        16,
        95,
    )
    direction = "rising" if newest_age_hours <= 72 else "stable"
    return {
        "importance": importance,
        "velocity": velocity,
        "practicalValue": practical_value,
        "koreaRelevance": korea_relevance,
        "risk": risk,
        "direction": direction,
    }


def build_cluster_summary(cluster: list[dict[str, Any]], categories: list[str], audiences: list[str]) -> dict[str, str]:
    primary = max(cluster, key=lambda record: (record["signal"]["strength"], record["source"]["publishedAt"]))
    publishers = ordered_unique([record["source"]["publisher"] for record in cluster], tuple())
    audience_text = ", ".join(AUDIENCE_LABELS.get(audience, audience) for audience in audiences[:4])
    if len(cluster) == 1:
        cleaned_summary = collapse_text(primary["entry"].get("summary", "")) or "공식 피드에서 새 업데이트가 확인됐다."
        if len(cleaned_summary) > 240:
            cleaned_summary = cleaned_summary[:237].rstrip() + "..."
        why_matters = f"{primary['source']['publisher']} 공식 채널 업데이트라서 신뢰도는 높고, {', '.join(categories[:2])} 흐름 판단에 바로 쓸 수 있다."
        next_action = "원문에서 릴리즈 범위와 실제 적용 대상을 먼저 확인한다."
        return {
            "whatHappened": cleaned_summary,
            "whyMatters": why_matters,
            "whoAffected": audience_text,
            "nextAction": next_action,
        }
    main_topic = primary["primaryTopic"].replace("-", " ")
    what_happened = f"{', '.join(publishers[:2])} 등 {len(cluster)}개 공식 출처에서 {main_topic} 관련 업데이트가 묶여 포착됐다."
    why_matters = f"출처가 여러 개라 단일 발표보다 흐름 신호로 보기 좋고, {', '.join(categories[:3])} 판단 정확도를 높여준다."
    next_action = "출처별 강조점이 같은지 비교하고, 실제 제품 변화인지 단순 행사 묶음인지 구분한다."
    return {
        "whatHappened": what_happened,
        "whyMatters": why_matters,
        "whoAffected": audience_text,
        "nextAction": next_action,
    }


def build_cluster_issue(cluster: list[dict[str, Any]], generated_at: str) -> dict[str, Any]:
    categories = ordered_unique(
        [category for record in cluster for category in record["categories"]],
        CATEGORY_PRIORITY,
    )
    audiences = ordered_unique(
        [audience for record in cluster for audience in record["audiences"]],
        AUDIENCE_PRIORITY,
    )
    tags = ordered_unique([tag for record in cluster for tag in record["tags"]], tuple())
    source_ids = [record["source"]["id"] for record in cluster]
    signal_ids = [record["signal"]["id"] for record in cluster]
    updated_at = max(record["source"]["publishedAt"] for record in cluster)
    issue_hash = stable_hash("|".join(sorted(source_ids)))
    issue_id = f"issue-{issue_hash}"
    scores = aggregate_cluster_scores(cluster, categories, audiences, generated_at)
    summary = build_cluster_summary(cluster, categories, audiences)
    publishers = ordered_unique([record["source"]["publisher"] for record in cluster], tuple())
    conclusion = (
        f"{', '.join(publishers[:2])} 공식 채널에서 같은 흐름의 업데이트가 확인됐다."
        if len(cluster) > 1
        else f"{publishers[0]} 공식 채널에서 새 업데이트가 확인됐다. 원문 확인 우선순위가 있는 항목이다."
    )
    timeline = [f"{record['source']['publisher']} 게시: {record['source']['publishedAt']}" for record in cluster[:4]]
    timeline.append(f"AI Tech Radar 수집/클러스터링: {generated_at}")
    validation = [f"공식 피드 확인: {record['feed'].feed_url}" for record in cluster[:4]]
    validation.extend([f"원문 페이지 확인: {record['source']['url']}" for record in cluster[:3]])

    for record in cluster:
        record["signal"]["issueId"] = issue_id

    return {
        "id": issue_id,
        "title": select_cluster_title(cluster),
        "conclusion": conclusion,
        "categories": categories,
        "tags": tags[:12],
        "certainty": "confirmed",
        "importance": scores["importance"],
        "velocity": scores["velocity"],
        "practicalValue": scores["practicalValue"],
        "koreaRelevance": scores["koreaRelevance"],
        "risk": scores["risk"],
        "direction": scores["direction"],
        "audiences": audiences,
        "sourceIds": source_ids,
        "signalIds": signal_ids,
        "updatedAt": updated_at,
        "summary": summary,
        "timeline": timeline,
        "validation": validation,
    }


def build_watchlists(issues: list[dict[str, Any]], publisher_issue_map: dict[str, list[str]]) -> list[dict[str, Any]]:
    latest_issues = sorted(issues, key=lambda issue: issue["updatedAt"], reverse=True)
    latest_issue_ids = [issue["id"] for issue in latest_issues[:10]]
    cross_source_ids = [issue["id"] for issue in issues if len(issue["sourceIds"]) > 1]
    watchlists = [
        {
            "id": "wl-official-latest",
            "label": "최근 공식 피드",
            "kind": "curated",
            "query": "official-latest",
            "issueIds": latest_issue_ids,
            "change": f"{len(latest_issue_ids)}건 추적 중",
        }
    ]
    if cross_source_ids:
        watchlists.append(
            {
                "id": "wl-cross-source",
                "label": "교차 출처 이슈",
                "kind": "clustered",
                "query": "cross-source",
                "issueIds": cross_source_ids[:8],
                "change": f"{len(cross_source_ids)}건 교차 확인",
            }
        )
    for publisher, issue_ids in sorted(publisher_issue_map.items()):
        deduped_ids = ordered_unique(issue_ids, tuple())[:8]
        watchlists.append(
            {
                "id": f"wl-{publisher.lower().replace(' ', '-')}",
                "label": publisher,
                "kind": "publisher",
                "query": publisher.lower().replace(" ", "-"),
                "issueIds": deduped_ids,
                "change": f"{len(deduped_ids)}건 수집",
            }
        )
    return watchlists


def collect_official_feed_dataset(generated_at: str) -> tuple[dict[str, list[dict[str, Any]]], dict[str, Any]]:
    settings = get_settings()
    seen_urls: set[str] = set()
    entry_records: list[dict[str, Any]] = []
    feed_results: list[dict[str, Any]] = []

    for feed in OFFICIAL_FEEDS:
        try:
            xml_text = fetch_feed_xml(feed)
            raw_entries = parse_feed_entries(feed, xml_text)
            accepted = 0
            filtered = 0
            duplicates = 0
            for entry in raw_entries:
                if accepted >= settings.collector_max_items_per_feed:
                    break
                if not is_relevant_entry(feed, entry):
                    filtered += 1
                    continue
                if entry["url"] in seen_urls:
                    duplicates += 1
                    continue
                seen_urls.add(entry["url"])
                entry_records.append(build_entry_record(feed, entry, generated_at))
                accepted += 1
            feed_results.append(
                {
                    "id": feed.id,
                    "publisher": feed.publisher,
                    "feedUrl": feed.feed_url,
                    "status": "completed",
                    "fetchedEntries": len(raw_entries),
                    "filteredEntries": filtered,
                    "duplicateEntries": duplicates,
                    "acceptedEntries": accepted,
                }
            )
        except Exception as exc:
            feed_results.append(
                {
                    "id": feed.id,
                    "publisher": feed.publisher,
                    "feedUrl": feed.feed_url,
                    "status": "failed",
                    "error": str(exc),
                }
            )

    clusters = cluster_records(entry_records)
    issues: list[dict[str, Any]] = []
    publisher_issue_map: dict[str, list[str]] = {}
    signals: list[dict[str, Any]] = []
    sources: list[dict[str, Any]] = []

    for cluster in clusters:
        issue = build_cluster_issue(cluster, generated_at)
        issues.append(issue)
        for record in cluster:
            signals.append(record["signal"])
            sources.append(record["source"])
            publisher_issue_map.setdefault(record["source"]["publisher"], []).append(issue["id"])

    issues.sort(key=lambda issue: (issue["importance"], issue["velocity"], issue["updatedAt"]), reverse=True)
    signals.sort(key=lambda signal: (signal["strength"], signal["velocity"]), reverse=True)
    sources.sort(key=lambda source: source["publishedAt"], reverse=True)
    watchlists = build_watchlists(issues, publisher_issue_map)
    multi_source_issue_count = sum(1 for issue in issues if len(issue["sourceIds"]) > 1)
    dataset = {
        "sources": sources,
        "signals": signals,
        "issues": issues,
        "watchlists": watchlists,
    }
    details = {
        "feeds": feed_results,
        "collectedSourceCount": len(sources),
        "collectedSignalCount": len(signals),
        "collectedWatchlistCount": len(watchlists),
        "rawEntryCount": len(entry_records),
        "clusteredIssueCount": len(issues),
        "multiSourceIssueCount": multi_source_issue_count,
    }
    if not issues:
        raise RuntimeError("Official feed collection returned no issues.")
    return dataset, details
