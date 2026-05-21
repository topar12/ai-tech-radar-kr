const labels = {
  categories: {
    models: "Models",
    agents: "Agents",
    infra: "Infra",
    open_source: "Open Source",
    research: "Research",
    business: "Business",
    policy: "Policy"
  },
  audienceLabels: {
    developer: "개발자",
    pm: "PM",
    leader: "리더",
    learner: "학습자",
    researcher: "리서처",
    founder: "창업자",
    creator: "콘텐츠",
    decision_maker: "의사결정"
  },
  certaintyLabels: {
    confirmed: "확정 발표",
    early_report: "초기 신호",
    inferred: "추정",
    debated: "논쟁 중"
  },
  directionLabels: {
    rising: "급등",
    stable: "유지",
    cooling: "하락",
    watch: "관찰"
  }
};

export function buildBootstrapLabels() {
  return structuredClone(labels);
}

const sampleBootstrap = {
  ...labels,
  sources: [
    {
      id: "worker-src-official",
      type: "official",
      publisher: "공식 문서",
      title: "Cloudflare Worker bootstrap contract",
      url: "https://developers.cloudflare.com/workers/",
      reliability: 5,
      publishedAt: "2026-05-21T00:20:00Z"
    },
    {
      id: "worker-src-d1",
      type: "official",
      publisher: "Cloudflare D1",
      title: "D1-backed snapshot read model planned",
      url: "https://developers.cloudflare.com/d1/",
      reliability: 5,
      publishedAt: "2026-05-21T01:10:00Z"
    }
  ],
  signals: [
    {
      id: "worker-sig-api",
      issueId: "worker-issue-free-api",
      sourceId: "worker-src-official",
      type: "migration",
      title: "FastAPI 호환 bootstrap endpoint가 Worker에서 먼저 열림",
      strength: 82,
      velocity: 68,
      evidenceText: "Cloudflare Worker가 /api/bootstrap 응답 계약을 유지한다."
    },
    {
      id: "worker-sig-d1",
      issueId: "worker-issue-free-api",
      sourceId: "worker-src-d1",
      type: "storage_plan",
      title: "다음 단계에서 D1 snapshot 1행 읽기 구조로 전환 예정",
      strength: 76,
      velocity: 62,
      evidenceText: "F2에서 SQLite seed/schema를 D1 migration으로 옮긴다."
    }
  ],
  issues: [
    {
      id: "worker-issue-free-api",
      title: "Cloudflare 무료 구조용 Worker API",
      conclusion: "프론트는 같은 /api/bootstrap 계약으로 Worker 또는 D1 snapshot 응답을 읽을 수 있다.",
      categories: ["infra", "open_source", "business"],
      tags: ["cloudflare", "worker", "free-tier", "bootstrap"],
      certainty: "confirmed",
      importance: 88,
      velocity: 64,
      practicalValue: 86,
      koreaRelevance: 72,
      risk: 34,
      direction: "rising",
      audiences: ["developer", "pm", "leader", "founder"],
      sourceIds: ["worker-src-official", "worker-src-d1"],
      signalIds: ["worker-sig-api", "worker-sig-d1"],
      updatedAt: "2026-05-21T02:30:00Z",
      summary: {
        whatHappened: "Render 백엔드와 별도로 Cloudflare Worker API 골격이 추가됐다.",
        whyMatters: "무료 운영 전환의 첫 관문인 프론트-API 계약을 먼저 고정할 수 있다.",
        whoAffected: "Lokana 운영자와 개발자",
        nextAction: "D1 snapshot을 먼저 읽고, 없을 때만 sample 응답으로 돌아간다."
      },
      timeline: [
        "FastAPI /api/bootstrap 계약 확정",
        "Cloudflare Worker F1 골격 추가",
        "D1 migration과 collector 포팅 예정"
      ],
      validation: [
        "Worker fetch handler 로컬 smoke 확인",
        "프론트 필수 배열과 label dictionary 포함",
        "CORS preflight 응답 확인"
      ]
    }
  ],
  watchlists: [
    {
      id: "worker-wl-free-tier",
      label: "무료 운영 전환",
      kind: "keyword",
      query: "cloudflare free-tier",
      issueIds: ["worker-issue-free-api"],
      change: "Worker API 골격 준비"
    }
  ]
};

export function buildSampleBootstrap(generatedAt = new Date().toISOString()) {
  const payload = structuredClone(sampleBootstrap);
  payload.generatedAt = generatedAt;
  payload.sources = payload.sources.map((source) => ({
    ...source,
    publishedAt: generatedAt
  }));
  payload.issues = payload.issues.map((issue) => ({
    ...issue,
    updatedAt: generatedAt
  }));
  return payload;
}
