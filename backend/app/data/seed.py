from copy import deepcopy


LABELS: dict[str, dict[str, str]] = {
    "categories": {
        "models": "Models",
        "agents": "Agents",
        "infra": "Infra",
        "open_source": "Open Source",
        "research": "Research",
        "business": "Business",
        "policy": "Policy",
    },
    "audienceLabels": {
        "developer": "개발자",
        "pm": "PM",
        "leader": "리더",
        "learner": "학습자",
        "researcher": "리서처",
        "founder": "창업자",
        "creator": "콘텐츠",
        "decision_maker": "의사결정",
    },
    "certaintyLabels": {
        "confirmed": "확정 발표",
        "early_report": "초기 신호",
        "inferred": "추정",
        "debated": "논쟁 중",
    },
    "directionLabels": {
        "rising": "급등",
        "stable": "유지",
        "cooling": "하락",
        "watch": "관찰",
    },
}

SEED_SOURCES: list[dict[str, object]] = [
    {
        "id": "api-src-official",
        "type": "official",
        "publisher": "공식 문서",
        "title": "Agent runtime production guidance",
        "url": "https://platform.openai.com/docs",
        "reliability": 5,
        "publishedAt": "2026-05-21T00:20:00Z",
    },
    {
        "id": "api-src-github",
        "type": "github",
        "publisher": "GitHub",
        "title": "AI agent repositories show sustained activity",
        "url": "https://github.com/topics/ai-agent",
        "reliability": 4,
        "publishedAt": "2026-05-21T01:10:00Z",
    },
]

SEED_SIGNALS: list[dict[str, object]] = [
    {
        "id": "api-sig-agent-ops",
        "issueId": "api-issue-agent-ops",
        "sourceId": "api-src-official",
        "type": "release",
        "title": "운영 기능과 권한 경계가 강조됨",
        "strength": 86,
        "velocity": 71,
        "evidenceText": "공식 문서와 개발자 커뮤니티에서 운영 안정성 언급이 반복됨",
    },
    {
        "id": "api-sig-github",
        "issueId": "api-issue-agent-ops",
        "sourceId": "api-src-github",
        "type": "repo_growth",
        "title": "에이전트 관련 저장소 활동 유지",
        "strength": 74,
        "velocity": 79,
        "evidenceText": "오픈소스 활동이 데모보다 운영 도구 중심으로 이어짐",
    },
]

SEED_ISSUES: list[dict[str, object]] = [
    {
        "id": "api-issue-agent-ops",
        "title": "API에서 내려온 에이전트 운영 계층 이슈",
        "conclusion": "실제 API 연결이 되면 이 카드처럼 샘플 데이터가 즉시 교체된다.",
        "categories": ["agents", "infra", "open_source"],
        "tags": ["agent", "runtime", "api-connected"],
        "certainty": "early_report",
        "importance": 91,
        "velocity": 79,
        "practicalValue": 84,
        "koreaRelevance": 68,
        "risk": 43,
        "direction": "rising",
        "audiences": ["developer", "pm", "leader"],
        "sourceIds": ["api-src-official", "api-src-github"],
        "signalIds": ["api-sig-agent-ops", "api-sig-github"],
        "updatedAt": "2026-05-21T02:30:00Z",
        "summary": {
            "whatHappened": "프론트엔드가 /api/bootstrap 응답을 받아 기존 mock 배열을 교체했다.",
            "whyMatters": "이제 수집기, DB, LLM 요약기를 붙여도 UI 코드를 크게 바꾸지 않아도 된다.",
            "whoAffected": "개발자, PM, AI 리서치 운영자",
            "nextAction": "수집 백엔드가 이 스키마로 데이터를 내보내도록 맞춘다.",
        },
        "timeline": [
            "정적 mock UI 구현",
            "API bootstrap 계약 추가",
            "실데이터 수집기와 점수화 파이프라인 연결 예정",
        ],
        "validation": [
            "GET /api/bootstrap 응답 스키마 확인",
            "CORS 헤더 확인",
            "카드, 상세, 검색, Watchlist 렌더링 확인",
        ],
    }
]

SEED_WATCHLISTS: list[dict[str, object]] = [
    {
        "id": "api-wl-agents",
        "label": "API 연결 확인",
        "kind": "keyword",
        "query": "api-connected",
        "issueIds": ["api-issue-agent-ops"],
        "change": "실시간 응답 사용 중",
    }
]


def build_seed_payload(generated_at: str) -> dict[str, object]:
    return {
        **deepcopy(LABELS),
        "sources": deepcopy(SEED_SOURCES),
        "signals": deepcopy(SEED_SIGNALS),
        "issues": deepcopy(SEED_ISSUES),
        "watchlists": deepcopy(SEED_WATCHLISTS),
        "generatedAt": generated_at,
    }
