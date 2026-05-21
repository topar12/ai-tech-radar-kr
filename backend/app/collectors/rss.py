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


def derive_categories(feed: FeedDefinition, entry: dict[str, Any]) -> list[str]:
    haystack = " ".join(
        [entry["title"], entry.get("summary", ""), " ".join(entry.get("tags", [])), feed.publisher]
    ).lower()
    categories = list(feed.categories)
    keyword_map = {
        "agents": ("agent", "assistant", "tool", "mcp", "workflow"),
        "infra": ("infra", "inference", "deployment", "serving", "chip", "latency", "runtime"),
        "open_source": ("open source", "opensource", "github", "community", "transformers", "library"),
        "research": ("research", "paper", "study", "benchmark", "science"),
        "business": ("enterprise", "company", "pricing", "adoption", "customer", "business"),
        "policy": ("policy", "safety", "government", "regulation", "security"),
        "models": ("model", "llm", "gpt", "gemma", "agentic", "reasoning"),
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
    if "open_source" in categories or "infra" in categories:
        audiences.append("developer")
    return ordered_unique(audiences, AUDIENCE_PRIORITY)


def derive_tags(feed: FeedDefinition, entry: dict[str, Any], categories: list[str]) -> list[str]:
    tags = [feed.id, feed.publisher.lower().replace(" ", "-")]
    for category in categories:
        tags.append(category)
    tags.extend(
        re.findall(r"[a-z0-9][a-z0-9\-\.]{2,24}", " ".join(entry.get("tags", [])).lower())
    )
    return ordered_unique(tags[:10], tuple())


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


def is_relevant_entry(feed: FeedDefinition, entry: dict[str, Any]) -> bool:
    if feed.id != "google-ai-blog":
        return True
    url = entry["url"].lower()
    haystack = " ".join([entry["title"], entry.get("summary", ""), " ".join(entry.get("tags", [])), url]).lower()
    if any(segment in url for segment in ("/technology/ai/", "/models-and-research/", "/developers-tools/")):
        return True
    keywords = (" ai ", "gemini", "model", "models", "research", "developer", "machine learning", "workspace")
    return any(keyword in haystack for keyword in keywords)


def compute_scores(feed: FeedDefinition, entry: dict[str, Any], categories: list[str], generated_at: str) -> dict[str, int | str]:
    published_at = parse_timestamp(entry["publishedAt"])
    collected_at = parse_timestamp(generated_at)
    age_hours = max(0.0, (collected_at - published_at).total_seconds() / 3600)
    freshness = max(0.0, 96.0 - age_hours)
    category_bonus = 4 if "agents" in categories or "models" in categories else 0
    research_bonus = 3 if "research" in categories else 0
    policy_risk_bonus = 8 if "policy" in categories else 0
    importance = clamp(int(feed.importance + freshness / 10 + category_bonus), 52, 95)
    velocity = clamp(int(feed.velocity + freshness / 6), 38, 95)
    practical_value = clamp(feed.practical_value + (4 if "infra" in categories else 0), 35, 95)
    korea_relevance = clamp(feed.korea_relevance + (5 if "open_source" in categories else 0), 30, 95)
    risk = clamp(feed.risk + policy_risk_bonus + (4 if "agents" in categories else 0) + research_bonus, 18, 95)
    direction = "rising" if age_hours <= 72 else "stable"
    return {
        "importance": importance,
        "velocity": velocity,
        "practicalValue": practical_value,
        "koreaRelevance": korea_relevance,
        "risk": risk,
        "direction": direction,
    }


def build_issue_summary(feed: FeedDefinition, entry: dict[str, Any], categories: list[str], audiences: list[str]) -> dict[str, str]:
    cleaned_summary = collapse_text(entry.get("summary", "")) or "공식 피드에서 새 업데이트가 확인됐다."
    if len(cleaned_summary) > 240:
        cleaned_summary = cleaned_summary[:237].rstrip() + "..."
    why_matters = f"{feed.publisher} 공식 채널 업데이트라서 신뢰도는 높고, {', '.join(categories[:2])} 흐름 판단에 바로 쓸 수 있다."
    who_affected = ", ".join(audiences[:4])
    next_action = "원문에서 릴리즈 범위와 실제 적용 대상을 먼저 확인한다."
    return {
        "whatHappened": cleaned_summary,
        "whyMatters": why_matters,
        "whoAffected": who_affected,
        "nextAction": next_action,
    }


def build_issue_records(feed: FeedDefinition, entry: dict[str, Any], generated_at: str) -> dict[str, dict[str, Any]]:
    categories = derive_categories(feed, entry)
    audiences = derive_audiences(feed, categories)
    tags = derive_tags(feed, entry, categories)
    record_hash = stable_hash(entry["url"])
    source_id = f"src-{feed.id}-{record_hash}"
    issue_id = f"issue-{feed.id}-{record_hash}"
    signal_id = f"sig-{feed.id}-{record_hash}"
    scores = compute_scores(feed, entry, categories, generated_at)
    summary = build_issue_summary(feed, entry, categories, audiences)
    conclusion = f"{feed.publisher} 공식 채널에서 새 업데이트가 확인됐다. 원문 확인 우선순위가 있는 항목이다."

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
        "issueId": issue_id,
        "sourceId": source_id,
        "type": derive_signal_type(categories),
        "title": f"{feed.publisher} 공식 피드 업데이트",
        "strength": scores["importance"],
        "velocity": scores["velocity"],
        "evidenceText": feed.feed_url,
    }
    issue = {
        "id": issue_id,
        "title": entry["title"],
        "conclusion": conclusion,
        "categories": categories,
        "tags": tags,
        "certainty": "confirmed",
        "importance": scores["importance"],
        "velocity": scores["velocity"],
        "practicalValue": scores["practicalValue"],
        "koreaRelevance": scores["koreaRelevance"],
        "risk": scores["risk"],
        "direction": scores["direction"],
        "audiences": audiences,
        "sourceIds": [source_id],
        "signalIds": [signal_id],
        "updatedAt": entry["publishedAt"],
        "summary": summary,
        "timeline": [
            f"{feed.publisher} 공식 피드 게시: {entry['publishedAt']}",
            f"AI Tech Radar 수집: {generated_at}",
            f"원문 URL: {entry['url']}",
        ],
        "validation": [
            f"공식 피드 URL 확인: {feed.feed_url}",
            f"원문 페이지 확인: {entry['url']}",
            f"게시 시각 확인: {entry['publishedAt']}",
        ],
    }
    return {"source": source, "signal": signal, "issue": issue}


def build_watchlists(issues: list[dict[str, Any]], publisher_map: dict[str, list[str]]) -> list[dict[str, Any]]:
    latest_issue_ids = [issue["id"] for issue in issues[:10]]
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
    for publisher, issue_ids in publisher_map.items():
        watchlists.append(
            {
                "id": f"wl-{publisher.lower().replace(' ', '-')}",
                "label": publisher,
                "kind": "publisher",
                "query": publisher.lower().replace(" ", "-"),
                "issueIds": issue_ids[:8],
                "change": f"{len(issue_ids)}건 수집",
            }
        )
    return watchlists


def collect_official_feed_dataset(generated_at: str) -> tuple[dict[str, list[dict[str, Any]]], dict[str, Any]]:
    settings = get_settings()
    seen_urls: set[str] = set()
    sources: list[dict[str, Any]] = []
    signals: list[dict[str, Any]] = []
    issues: list[dict[str, Any]] = []
    publisher_map: dict[str, list[str]] = {}
    feed_results: list[dict[str, Any]] = []

    for feed in OFFICIAL_FEEDS:
        try:
            xml_text = fetch_feed_xml(feed)
            raw_entries = parse_feed_entries(feed, xml_text)
            accepted = 0
            filtered = 0
            for entry in raw_entries:
                if accepted >= settings.collector_max_items_per_feed:
                    break
                if not is_relevant_entry(feed, entry):
                    filtered += 1
                    continue
                if entry["url"] in seen_urls:
                    continue
                seen_urls.add(entry["url"])
                records = build_issue_records(feed, entry, generated_at)
                sources.append(records["source"])
                signals.append(records["signal"])
                issues.append(records["issue"])
                publisher_map.setdefault(feed.publisher, []).append(records["issue"]["id"])
                accepted += 1
            feed_results.append(
                {
                    "id": feed.id,
                    "publisher": feed.publisher,
                    "feedUrl": feed.feed_url,
                    "status": "completed",
                    "fetchedEntries": len(raw_entries),
                    "filteredEntries": filtered,
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

    issues.sort(key=lambda issue: issue["updatedAt"], reverse=True)
    dataset = {
        "sources": sorted(sources, key=lambda source: source["publishedAt"], reverse=True),
        "signals": sorted(signals, key=lambda signal: (signal["strength"], signal["velocity"]), reverse=True),
        "issues": issues,
        "watchlists": build_watchlists(issues, publisher_map),
    }
    details = {
        "feeds": feed_results,
        "collectedIssueCount": len(issues),
        "collectedSourceCount": len(sources),
        "collectedSignalCount": len(signals),
        "collectedWatchlistCount": len(dataset["watchlists"]),
    }
    if not issues:
        raise RuntimeError("Official feed collection returned no issues.")
    return dataset, details
