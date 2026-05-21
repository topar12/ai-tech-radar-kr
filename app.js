const categories = {
  models: "Models",
  agents: "Agents",
  infra: "Infra",
  open_source: "Open Source",
  research: "Research",
  business: "Business",
  policy: "Policy"
};

const audienceLabels = {
  developer: "개발자",
  pm: "PM",
  leader: "리더",
  learner: "학습자",
  researcher: "리서처",
  founder: "창업자",
  creator: "콘텐츠",
  decision_maker: "의사결정"
};

const certaintyLabels = {
  confirmed: "확정 발표",
  early_report: "초기 신호",
  inferred: "추정",
  debated: "논쟁 중"
};

const directionLabels = {
  rising: "급등",
  stable: "유지",
  cooling: "하락",
  watch: "관찰"
};

const sources = [
  {
    id: "src-official-agent-runtime",
    type: "official",
    publisher: "공식 문서",
    title: "Agent runtime tooling update",
    url: "https://platform.openai.com/docs",
    reliability: 5,
    publishedAt: "2026-05-21T00:20:00Z"
  },
  {
    id: "src-github-agent-runtime",
    type: "github",
    publisher: "GitHub",
    title: "agent-runtime repositories gain activity",
    url: "https://github.com/topics/ai-agent",
    reliability: 4,
    publishedAt: "2026-05-21T01:10:00Z"
  },
  {
    id: "src-hf-local-model",
    type: "huggingface",
    publisher: "Hugging Face",
    title: "Compact Korean-capable model variants trend",
    url: "https://huggingface.co/models",
    reliability: 4,
    publishedAt: "2026-05-20T22:40:00Z"
  },
  {
    id: "src-hn-browser-agent",
    type: "community",
    publisher: "Hacker News",
    title: "Browser agents discussion rises",
    url: "https://news.ycombinator.com/",
    reliability: 3,
    publishedAt: "2026-05-21T02:00:00Z"
  },
  {
    id: "src-arxiv-recursive-reasoning",
    type: "paper",
    publisher: "arXiv",
    title: "Small recursive reasoning systems",
    url: "https://arxiv.org/",
    reliability: 4,
    publishedAt: "2026-05-20T20:10:00Z"
  },
  {
    id: "src-policy-korea-ai",
    type: "media",
    publisher: "정책 브리핑",
    title: "Korean AI governance draft discussion",
    url: "https://www.msit.go.kr/",
    reliability: 3,
    publishedAt: "2026-05-20T12:00:00Z"
  },
  {
    id: "src-infra-chiplet",
    type: "analysis",
    publisher: "분석 리포트",
    title: "Inference infra shifts to memory and routing",
    url: "https://www.semianalysis.com/",
    reliability: 4,
    publishedAt: "2026-05-20T16:30:00Z"
  }
];

const signals = [
  {
    id: "sig-agent-release",
    issueId: "issue-agent-runtime",
    sourceId: "src-official-agent-runtime",
    type: "release",
    title: "공식 런타임 기능 추가",
    strength: 88,
    velocity: 64,
    evidenceText: "도구 호출, 권한, 관측성 기능이 릴리즈 노트에서 반복 언급됨"
  },
  {
    id: "sig-agent-stars",
    issueId: "issue-agent-runtime",
    sourceId: "src-github-agent-runtime",
    type: "repo_growth",
    title: "관련 레포 활동 증가",
    strength: 78,
    velocity: 86,
    evidenceText: "24시간 기준 스타와 이슈 활동이 동시에 증가"
  },
  {
    id: "sig-local-hf",
    issueId: "issue-local-llm",
    sourceId: "src-hf-local-model",
    type: "model",
    title: "소형 모델 다운로드 증가",
    strength: 74,
    velocity: 82,
    evidenceText: "한국어 대응 소형 모델과 양자화 버전의 관심이 증가"
  },
  {
    id: "sig-browser-community",
    issueId: "issue-browser-agents",
    sourceId: "src-hn-browser-agent",
    type: "community_buzz",
    title: "브라우저 에이전트 토론 확산",
    strength: 68,
    velocity: 90,
    evidenceText: "데모 성공보다 보안과 권한 경계에 대한 댓글이 많음"
  },
  {
    id: "sig-reasoning-paper",
    issueId: "issue-recursive-reasoning",
    sourceId: "src-arxiv-recursive-reasoning",
    type: "paper",
    title: "작은 추론 구조 논문 신호",
    strength: 70,
    velocity: 58,
    evidenceText: "대형 모델 확장 대신 구조적 추론 효율을 다루는 논문이 재등장"
  },
  {
    id: "sig-policy-korea",
    issueId: "issue-korea-policy",
    sourceId: "src-policy-korea-ai",
    type: "policy",
    title: "국내 AI 거버넌스 논의",
    strength: 62,
    velocity: 52,
    evidenceText: "기업 도입과 공공 조달에 영향을 줄 수 있는 정책 논의"
  },
  {
    id: "sig-infra-memory",
    issueId: "issue-inference-infra",
    sourceId: "src-infra-chiplet",
    type: "analysis",
    title: "추론 인프라 병목 이동",
    strength: 79,
    velocity: 66,
    evidenceText: "GPU 성능보다 메모리, 라우팅, 배치 전략 언급이 늘어남"
  }
];

const issues = [
  {
    id: "issue-agent-runtime",
    title: "에이전트 경쟁이 프레임워크에서 운영 계층으로 이동",
    conclusion: "단순 데모보다 배포, 권한, 관측성이 선택 기준이 되고 있다.",
    categories: ["agents", "infra", "open_source"],
    tags: ["agent", "runtime", "observability"],
    certainty: "early_report",
    importance: 92,
    velocity: 82,
    practicalValue: 88,
    koreaRelevance: 64,
    risk: 42,
    direction: "rising",
    audiences: ["developer", "pm", "leader"],
    sourceIds: ["src-official-agent-runtime", "src-github-agent-runtime"],
    signalIds: ["sig-agent-release", "sig-agent-stars"],
    updatedAt: "2026-05-21T02:30:00Z",
    summary: {
      whatHappened: "공식 도구 업데이트와 GitHub 활동 증가가 동시에 나타났다.",
      whyMatters: "팀 도입에서는 모델 성능보다 운영 안정성과 통제 가능성이 더 중요해진다.",
      whoAffected: "개발자, PM, 사내 AI TF, SaaS 운영팀",
      nextAction: "기존 에이전트 PoC에 로깅, 권한, 비용 추적 항목을 추가한다."
    },
    timeline: [
      "공식 릴리즈에서 런타임 관리 기능이 강조됨",
      "관련 오픈소스 저장소 활동이 24시간 기준 증가",
      "커뮤니티 토론이 데모에서 운영 리스크로 이동"
    ],
    validation: [
      "라이선스와 권한 모델을 먼저 확인",
      "장기 실행 작업의 실패 복구를 테스트",
      "관측성 로그와 비용 추적이 API 단위로 가능한지 검증"
    ]
  },
  {
    id: "issue-local-llm",
    title: "로컬 LLM은 취미에서 업무 보조 레이어로 이동 중",
    conclusion: "작은 모델과 양자화 배포가 내부 문서 처리, 보조 코딩, 비공개 데이터 작업에 맞아가고 있다.",
    categories: ["models", "open_source"],
    tags: ["local-llm", "quantization", "privacy"],
    certainty: "confirmed",
    importance: 84,
    velocity: 78,
    practicalValue: 82,
    koreaRelevance: 76,
    risk: 35,
    direction: "rising",
    audiences: ["developer", "leader", "learner"],
    sourceIds: ["src-hf-local-model"],
    signalIds: ["sig-local-hf"],
    updatedAt: "2026-05-21T01:30:00Z",
    summary: {
      whatHappened: "Hugging Face에서 소형 모델, 양자화 모델, 한국어 대응 변형의 관심이 증가했다.",
      whyMatters: "외부 API로 보내기 어려운 문서와 로그를 사내 환경에서 다룰 가능성이 커진다.",
      whoAffected: "개발자, 보안 민감 조직, 데이터팀, 학습자",
      nextAction: "업무 문서 20개로 로컬 모델의 요약 품질과 응답 지연을 짧게 비교한다."
    },
    timeline: [
      "양자화 모델 다운로드 증가",
      "로컬 추론 UI와 런타임 도구가 쉬워짐",
      "보안 민감 워크플로우에서 관심 증가"
    ],
    validation: [
      "한국어 장문 요약 품질 확인",
      "실제 장비에서 응답 지연 측정",
      "라이선스가 상업적 사용을 허용하는지 확인"
    ]
  },
  {
    id: "issue-browser-agents",
    title: "브라우저 에이전트는 자동화보다 권한 설계가 병목",
    conclusion: "클릭 자동화 자체보다 계정, 결제, 개인정보 경계를 어떻게 막는지가 핵심 쟁점이다.",
    categories: ["agents", "business", "policy"],
    tags: ["browser-agent", "security", "automation"],
    certainty: "debated",
    importance: 81,
    velocity: 90,
    practicalValue: 66,
    koreaRelevance: 70,
    risk: 78,
    direction: "watch",
    audiences: ["pm", "leader", "developer", "researcher"],
    sourceIds: ["src-hn-browser-agent"],
    signalIds: ["sig-browser-community"],
    updatedAt: "2026-05-21T02:05:00Z",
    summary: {
      whatHappened: "브라우저 조작형 에이전트 데모와 커뮤니티 토론이 동시에 늘었다.",
      whyMatters: "업무 자동화 잠재력은 크지만 계정 오남용과 데이터 노출 리스크가 제품화를 늦춘다.",
      whoAffected: "PM, 자동화 도입팀, 보안팀, 운영팀",
      nextAction: "읽기 전용 작업과 결제/삭제 작업을 분리한 권한 시나리오부터 설계한다."
    },
    timeline: [
      "브라우저 조작 데모 확산",
      "HN 토론에서 보안과 권한 경계 우려 증가",
      "기업 도입 기준이 기능보다 통제 가능성으로 이동"
    ],
    validation: [
      "민감 페이지 접근 차단 테스트",
      "사람 승인 단계 설계",
      "실패 로그와 세션 격리 검증"
    ]
  },
  {
    id: "issue-recursive-reasoning",
    title: "작은 추론 구조가 대형 모델 확장 대안으로 재부상",
    conclusion: "모델 크기만 키우는 대신 반복 추론 구조와 훈련 방식이 다시 주목받고 있다.",
    categories: ["research", "models"],
    tags: ["reasoning", "architecture", "paper"],
    certainty: "early_report",
    importance: 76,
    velocity: 58,
    practicalValue: 46,
    koreaRelevance: 52,
    risk: 48,
    direction: "watch",
    audiences: ["researcher", "learner", "developer"],
    sourceIds: ["src-arxiv-recursive-reasoning"],
    signalIds: ["sig-reasoning-paper"],
    updatedAt: "2026-05-20T23:00:00Z",
    summary: {
      whatHappened: "작은 모델의 반복 추론 구조를 다루는 논문 신호가 늘었다.",
      whyMatters: "추론 비용과 모델 크기 경쟁의 부담을 줄이는 연구 방향이 될 수 있다.",
      whoAffected: "연구자, ML 엔지니어, 학습자",
      nextAction: "논문 코드를 재현하기보다 문제 설정과 평가 지표가 현실적인지 먼저 본다."
    },
    timeline: [
      "논문 신호 포착",
      "커뮤니티에서 작은 추론 구조 관심 증가",
      "코드 공개 여부와 재현성 확인 필요"
    ],
    validation: [
      "벤치마크가 실제 업무 문제와 연결되는지 확인",
      "코드 공개와 학습 비용 확인",
      "대형 모델 대비 이점이 어느 조건에서만 나타나는지 확인"
    ]
  },
  {
    id: "issue-korea-policy",
    title: "국내 AI 도입 논의가 기술보다 거버넌스 기준으로 이동",
    conclusion: "공공과 기업 도입에서 모델 성능보다 책임, 데이터 처리, 감사 가능성이 더 자주 언급된다.",
    categories: ["policy", "business"],
    tags: ["korea", "governance", "compliance", "규제", "정책"],
    certainty: "inferred",
    importance: 73,
    velocity: 52,
    practicalValue: 62,
    koreaRelevance: 94,
    risk: 68,
    direction: "stable",
    audiences: ["leader", "pm", "researcher"],
    sourceIds: ["src-policy-korea-ai"],
    signalIds: ["sig-policy-korea"],
    updatedAt: "2026-05-20T18:40:00Z",
    summary: {
      whatHappened: "국내 AI 활용 논의에서 책임성과 감사 가능성 관련 키워드가 늘었다.",
      whyMatters: "공공, 금융, 교육 영역에서는 기능보다 도입 절차와 증빙이 먼저 필요해진다.",
      whoAffected: "의사결정자, PM, 공공/금융 도입팀",
      nextAction: "AI 기능 기획서에 데이터 처리, 책임 주체, 로그 보관 항목을 추가한다."
    },
    timeline: [
      "국내 정책 논의 증가",
      "기업 도입 체크리스트에 책임성과 로그 항목 추가",
      "공공 조달과 규정 준수 이슈로 확장 가능"
    ],
    validation: [
      "도입 산업별 규정 차이 확인",
      "개인정보 처리 위탁 구조 확인",
      "모델 출력 로그의 보관과 삭제 정책 검증"
    ]
  },
  {
    id: "issue-inference-infra",
    title: "추론 인프라 경쟁은 GPU 성능에서 메모리와 라우팅으로 확장",
    conclusion: "모델 호출량이 늘수록 비용 병목은 칩 하나가 아니라 배치, 캐시, 라우팅 설계에서 발생한다.",
    categories: ["infra", "business"],
    tags: ["inference", "routing", "cost"],
    certainty: "early_report",
    importance: 79,
    velocity: 66,
    practicalValue: 74,
    koreaRelevance: 58,
    risk: 38,
    direction: "rising",
    audiences: ["developer", "leader"],
    sourceIds: ["src-infra-chiplet"],
    signalIds: ["sig-infra-memory"],
    updatedAt: "2026-05-20T17:30:00Z",
    summary: {
      whatHappened: "추론 비용 최적화 논의가 모델 선택에서 라우팅과 캐시 전략으로 이동하고 있다.",
      whyMatters: "AI 기능이 제품 내부에 깊게 들어가면 토큰 단가보다 운영 설계가 비용을 좌우한다.",
      whoAffected: "개발자, CTO, SaaS 운영팀",
      nextAction: "모델별 비용표보다 요청 유형별 라우팅 정책과 캐시 가능성을 먼저 정의한다."
    },
    timeline: [
      "추론 호출량 증가",
      "비용 최적화 논의가 라우팅과 캐시로 이동",
      "제품팀 단위 비용 관측 필요성 증가"
    ],
    validation: [
      "요청 유형별 모델 라우팅 기준 정의",
      "캐시 가능한 질의와 불가능한 질의 분리",
      "팀별 비용 대시보드 필요성 확인"
    ]
  }
];

const watchlists = [
  { id: "wl-agent", label: "에이전트 프레임워크", kind: "keyword", query: "agent runtime", issueIds: ["issue-agent-runtime", "issue-browser-agents"], change: "2개 이슈 업데이트" },
  { id: "wl-local", label: "로컬 LLM", kind: "keyword", query: "local llm", issueIds: ["issue-local-llm"], change: "HF 신호 급등" },
  { id: "wl-policy", label: "국내 AI 규제", kind: "keyword", query: "korea policy", issueIds: ["issue-korea-policy"], change: "관찰 유지" }
];

const dataConnection = {
  source: "mock",
  generatedAt: "2026-05-21T05:20:00Z",
  baseUrl: "",
  error: ""
};

const state = {
  selectedIssueId: issues[0].id,
  activeTab: "overview",
  role: "all",
  sortBy: "priority",
  query: "",
  expanded: new Set(),
  saved: new Set(JSON.parse(localStorage.getItem("radarSavedIssues") || "[]")),
  hidden: new Set(JSON.parse(localStorage.getItem("radarHiddenIssues") || "[]"))
};

const $ = (selector) => document.querySelector(selector);

function byId(list, id) {
  return list.find((item) => item.id === id);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function persistState() {
  localStorage.setItem("radarSavedIssues", JSON.stringify([...state.saved]));
  localStorage.setItem("radarHiddenIssues", JSON.stringify([...state.hidden]));
}

function replaceDictionary(target, next) {
  Object.keys(target).forEach((key) => delete target[key]);
  Object.assign(target, next);
}

function replaceList(target, next) {
  target.splice(0, target.length, ...next);
}

function configuredApiBaseUrl() {
  const params = new URLSearchParams(window.location.search);
  return (
    params.get("api") ||
    localStorage.getItem("radarApiBaseUrl") ||
    window.RADAR_API_BASE_URL ||
    ""
  ).trim().replace(/\/$/, "");
}

function validateApiPayload(payload) {
  const requiredLists = ["sources", "signals", "issues", "watchlists"];
  const missing = requiredLists.filter((key) => !Array.isArray(payload?.[key]));
  if (missing.length) {
    throw new Error(`Missing list fields: ${missing.join(", ")}`);
  }
  if (!payload.categories || typeof payload.categories !== "object") {
    throw new Error("Missing categories dictionary");
  }
  return payload;
}

async function loadRemoteRadarData() {
  const baseUrl = configuredApiBaseUrl();
  dataConnection.baseUrl = baseUrl;
  if (!baseUrl) return;

  try {
    const response = await fetch(`${baseUrl}/api/bootstrap`, {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = validateApiPayload(await response.json());

    replaceDictionary(categories, payload.categories);
    if (payload.audienceLabels) replaceDictionary(audienceLabels, payload.audienceLabels);
    if (payload.certaintyLabels) replaceDictionary(certaintyLabels, payload.certaintyLabels);
    if (payload.directionLabels) replaceDictionary(directionLabels, payload.directionLabels);
    replaceList(sources, payload.sources);
    replaceList(signals, payload.signals);
    replaceList(issues, payload.issues);
    replaceList(watchlists, payload.watchlists);

    dataConnection.source = "api";
    dataConnection.generatedAt = payload.generatedAt || new Date().toISOString();
    dataConnection.error = "";
  } catch (error) {
    dataConnection.source = "mock";
    dataConnection.error = error.message;
  }
}

function formatDataStatusTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function updateDataStatus() {
  const status = $("#dataStatus");
  if (!status) return;
  const time = formatDataStatusTime(dataConnection.generatedAt);
  if (dataConnection.source === "api") {
    status.textContent = `API 연결 · ${time || "방금"} 기준`;
    return;
  }
  status.textContent = dataConnection.error
    ? `샘플 데이터 · API 연결 실패: ${dataConnection.error}`
    : `샘플 데이터 · ${time || "오늘"} 기준`;
}

function scoreFor(issue) {
  const key = {
    priority: "importance",
    velocity: "velocity",
    practical: "practicalValue",
    korea: "koreaRelevance"
  }[state.sortBy] || "importance";
  return issue[key];
}

function matchesQuery(issue) {
  if (!state.query.trim()) return true;
  const q = state.query.trim().toLowerCase();
  const haystack = [
    issue.title,
    issue.conclusion,
    issue.summary.whatHappened,
    issue.summary.whyMatters,
    issue.tags.join(" "),
    issue.categories.map((c) => categories[c]).join(" ")
  ].join(" ").toLowerCase();
  return haystack.includes(q);
}

function matchesRole(issue) {
  if (state.query.trim()) return true;
  if (state.role === "all") return true;
  return issue.audiences.includes(state.role);
}

function visibleIssues() {
  return issues
    .filter((issue) => !state.hidden.has(issue.id))
    .filter(matchesRole)
    .filter(matchesQuery)
    .sort((a, b) => scoreFor(b) - scoreFor(a));
}

function sourceSummary(issue) {
  const grouped = issue.sourceIds.reduce((acc, sourceId) => {
    const source = byId(sources, sourceId);
    if (!source) return acc;
    const label = {
      official: "공식",
      github: "GitHub",
      huggingface: "HF",
      community: "커뮤니티",
      paper: "논문",
      media: "언론",
      analysis: "분석"
    }[source.type] || source.type;
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(grouped).map(([label, count]) => `${label} ${count}`).join(" · ");
}

function renderIssueList() {
  const list = $("#issueList");
  const items = visibleIssues();
  if (!items.length) {
    list.innerHTML = `<div class="issue-card"><strong>조건에 맞는 이슈가 없습니다.</strong><p class="detail-summary">검색어나 필터를 줄이면 더 넓은 레이더를 볼 수 있습니다.</p></div>`;
    return;
  }

  list.innerHTML = items.map((issue) => {
    const expanded = state.expanded.has(issue.id);
    const selected = state.selectedIssueId === issue.id;
    const saved = state.saved.has(issue.id);
    return `
      <article class="issue-card ${expanded ? "expanded" : ""} ${selected ? "selected" : ""}" data-issue-id="${issue.id}">
        <div class="issue-header">
          <button class="issue-title-button" type="button" data-select="${issue.id}">
            <h3>${escapeHtml(issue.title)}</h3>
            <p>${escapeHtml(issue.conclusion)}</p>
          </button>
          <div class="score-block">
            <strong>${scoreFor(issue)}</strong>
            <span>${state.sortBy === "priority" ? "중요도" : "현재 점수"}</span>
          </div>
        </div>
        <div class="badge-row">
          <span class="badge ${issue.direction}">${directionLabels[issue.direction]}</span>
          <span class="badge ${issue.certainty}">${certaintyLabels[issue.certainty]}</span>
          ${issue.koreaRelevance >= 70 ? `<span class="badge confirmed">국내 영향</span>` : ""}
          ${issue.risk >= 65 ? `<span class="badge risk">검증 필요</span>` : ""}
          ${issue.categories.slice(0, 3).map((category) => `<span class="badge">${categories[category]}</span>`).join("")}
        </div>
        <div class="source-row">
          <span>${sourceSummary(issue)}</span>
          <span>영향 대상: ${issue.audiences.slice(0, 3).map((a) => audienceLabels[a]).join(", ")}</span>
        </div>
        <div class="why-panel">
          <div class="why-item"><b>무슨 일</b><span>${escapeHtml(issue.summary.whatHappened)}</span></div>
          <div class="why-item"><b>왜 중요</b><span>${escapeHtml(issue.summary.whyMatters)}</span></div>
          <div class="why-item"><b>지금 할 일</b><span>${escapeHtml(issue.summary.nextAction)}</span></div>
        </div>
        <div class="action-row">
          <button class="why-button" type="button" data-expand="${issue.id}">${expanded ? "접기" : "왜 중요"}</button>
          <button class="card-action" type="button" data-save="${issue.id}">${saved ? "저장됨" : "저장"}</button>
          <button class="card-action" type="button" data-watch="${issue.id}">관심 등록</button>
          <button class="card-action" type="button" data-hide="${issue.id}">숨기기</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderWatchlist() {
  $("#watchlistList").innerHTML = watchlists.map((watch) => `
    <button class="watch-item" type="button" data-watchlist="${watch.id}">
      <strong>${escapeHtml(watch.label)}</strong>
      <span>${escapeHtml(watch.change)}</span>
    </button>
  `).join("");
}

function renderRadar() {
  const totals = Object.keys(categories).map((category) => {
    const related = issues.filter((issue) => issue.categories.includes(category));
    const average = related.length
      ? Math.round(related.reduce((sum, issue) => sum + issue.velocity, 0) / related.length)
      : 0;
    const top = related.slice().sort((a, b) => b.velocity - a.velocity)[0];
    return { category, average, top };
  });

  $("#radarGrid").innerHTML = totals.map(({ category, average, top }) => `
    <button class="radar-lane" type="button" data-radar-category="${category}">
      <h3>${categories[category]}</h3>
      <div class="lane-meter"><span style="width:${average}%"></span></div>
      <p>${top ? escapeHtml(top.conclusion) : "아직 강한 변화 신호가 없습니다."}</p>
    </button>
  `).join("");
}

function renderBriefing() {
  const items = visibleIssues().slice(0, 4);
  $("#briefingList").innerHTML = items.map((issue, index) => `
    <details class="briefing-item" ${index === 0 ? "open" : ""}>
      <summary>${index + 1}. ${escapeHtml(issue.title)}</summary>
      <div class="briefing-body">
        <div class="why-item"><b>결론</b><span>${escapeHtml(issue.conclusion)}</span></div>
        <div class="why-item"><b>이유</b><span>${escapeHtml(issue.summary.whyMatters)}</span></div>
        <div class="why-item"><b>행동</b><span>${escapeHtml(issue.summary.nextAction)}</span></div>
      </div>
    </details>
  `).join("");
}

function renderDetail() {
  const issue = byId(issues, state.selectedIssueId) || visibleIssues()[0] || issues[0];
  if (!issue) {
    $("#detailState").textContent = "데이터 없음";
    $("#detail-title").textContent = "표시할 이슈가 없습니다";
    $("#detailSummary").textContent = "API 응답에 issues 배열이 비어 있습니다.";
    $("#trustStrip").innerHTML = "";
    $("#detailContent").innerHTML = "";
    return;
  }
  state.selectedIssueId = issue.id;

  $("#detailState").textContent = `${directionLabels[issue.direction]} · ${certaintyLabels[issue.certainty]}`;
  $("#detail-title").textContent = issue.conclusion;
  $("#detailSummary").textContent = issue.title;
  $("#saveSelectedButton").textContent = state.saved.has(issue.id) ? "★" : "☆";

  const officialCount = issue.sourceIds
    .map((id) => byId(sources, id))
    .filter((source) => source && source.type === "official").length;

  $("#trustStrip").innerHTML = `
    <div class="trust-item"><b>${issue.sourceIds.length}개</b><span>묶인 출처</span></div>
    <div class="trust-item"><b>${officialCount ? "있음" : "없음"}</b><span>공식 출처</span></div>
    <div class="trust-item"><b>${issue.risk}</b><span>리스크 점수</span></div>
    <div class="trust-item"><b>${issue.koreaRelevance}</b><span>국내 관련성</span></div>
  `;

  document.querySelectorAll(".detail-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === state.activeTab);
  });

  const content = {
    overview: `
      <div class="detail-block"><b>무슨 일</b><p>${escapeHtml(issue.summary.whatHappened)}</p></div>
      <div class="detail-block"><b>왜 중요</b><p>${escapeHtml(issue.summary.whyMatters)}</p></div>
      <div class="detail-block"><b>누가 영향</b><p>${escapeHtml(issue.summary.whoAffected)}</p></div>
      <div class="detail-block"><b>지금 할 일</b><p>${escapeHtml(issue.summary.nextAction)}</p></div>
    `,
    evidence: renderEvidence(issue),
    timeline: `
      <div class="detail-block"><b>흐름</b><ul>${issue.timeline.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>
    `,
    actions: `
      <div class="detail-block"><b>실사용 검증</b><ul>${issue.validation.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>
      <div class="detail-block"><b>다음 행동</b><p>${escapeHtml(issue.summary.nextAction)}</p></div>
    `
  };
  $("#detailContent").innerHTML = content[state.activeTab] || content.overview;
}

function renderEvidence(issue) {
  const issueSignals = issue.signalIds.map((id) => byId(signals, id)).filter(Boolean);
  const issueSources = issue.sourceIds.map((id) => byId(sources, id)).filter(Boolean);
  return `
    <div class="detail-block">
      <b>신호</b>
      <ul>${issueSignals.map((signal) => `<li>${escapeHtml(signal.title)} · 강도 ${signal.strength} · 확산 ${signal.velocity}</li>`).join("")}</ul>
    </div>
    <div class="detail-block">
      <b>출처</b>
      <ul>${issueSources.map((source) => `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.publisher)}</a> · ${escapeHtml(source.title)}</li>`).join("")}</ul>
    </div>
  `;
}

function renderSearchResults() {
  const query = state.query.trim();
  const matches = visibleIssues().slice(0, 4);
  const label = query || "현재 레이더";
  $("#searchResults").innerHTML = `
    <div class="result-group">
      <strong>${escapeHtml(label)} 관련 이슈 ${matches.length}개</strong>
      ${matches.map((issue) => `<button type="button" data-select="${issue.id}">${escapeHtml(issue.title)}</button>`).join("") || "<span>검색 결과가 없습니다.</span>"}
    </div>
    <div class="result-group">
      <strong>기술/용어</strong>
      ${[...new Set(matches.flatMap((issue) => issue.tags))].slice(0, 5).map((tag) => `<button type="button" data-query="${tag}">#${escapeHtml(tag)} 알림 받기</button>`).join("") || "<span>관련 키워드 없음</span>"}
    </div>
    <div class="result-group">
      <strong>원문</strong>
      ${matches.slice(0, 2).flatMap((issue) => issue.sourceIds.map((id) => byId(sources, id))).filter(Boolean).slice(0, 4).map((source) => `<button type="button" data-source-url="${escapeHtml(source.url)}">${escapeHtml(source.publisher)} · ${escapeHtml(source.title)}</button>`).join("") || "<span>원문 없음</span>"}
    </div>
  `;
}

function renderAll() {
  updateDataStatus();
  renderIssueList();
  renderWatchlist();
  renderRadar();
  renderBriefing();
  renderDetail();
  renderSearchResults();
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 1900);
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("button, a");
  if (!target) return;

  if (target.dataset.select) {
    state.selectedIssueId = target.dataset.select;
    state.activeTab = "overview";
    renderAll();
    $("#detail-title").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  if (target.dataset.expand) {
    const id = target.dataset.expand;
    state.expanded.has(id) ? state.expanded.delete(id) : state.expanded.add(id);
    renderIssueList();
  }

  if (target.dataset.save) {
    const id = target.dataset.save;
    state.saved.has(id) ? state.saved.delete(id) : state.saved.add(id);
    persistState();
    renderAll();
    showToast(state.saved.has(id) ? "저장했습니다. 주간 브리핑에 반영됩니다." : "저장을 해제했습니다.");
  }

  if (target.dataset.watch) {
    showToast("관심 등록됨. 큰 변화가 있을 때만 알려줍니다.");
  }

  if (target.dataset.hide) {
    state.hidden.add(target.dataset.hide);
    persistState();
    renderAll();
    showToast("숨겼습니다. 비슷한 이슈는 덜 보여줍니다.");
  }

  if (target.dataset.tab) {
    state.activeTab = target.dataset.tab;
    renderDetail();
  }

  if (target.dataset.role) {
    state.role = target.dataset.role;
    document.querySelectorAll("[data-role]").forEach((button) => button.classList.toggle("active", button.dataset.role === state.role));
    renderAll();
  }

  if (target.dataset.sort) {
    state.sortBy = target.dataset.sort;
    document.querySelectorAll("[data-sort]").forEach((button) => button.classList.toggle("active", button.dataset.sort === state.sortBy));
    renderAll();
  }

  if (target.dataset.watchlist) {
    const watch = byId(watchlists, target.dataset.watchlist);
    if (watch) {
      state.query = watch.query.split(" ")[0];
      $("#globalSearch").value = state.query;
      renderAll();
      showToast(`${watch.label} 관련 변화만 좁혀봤습니다.`);
    }
  }

  if (target.dataset.radarCategory) {
    const category = target.dataset.radarCategory;
    state.query = categories[category];
    $("#globalSearch").value = state.query;
    renderAll();
  }

  if (target.dataset.query) {
    state.query = target.dataset.query;
    $("#globalSearch").value = state.query;
    renderAll();
    showToast("검색어 알림 후보에 추가했습니다.");
  }

  if (target.dataset.sourceUrl) {
    window.open(target.dataset.sourceUrl, "_blank", "noreferrer");
  }

  if (target.id === "resetFiltersButton") {
    state.role = "all";
    state.sortBy = "priority";
    state.query = "";
    $("#globalSearch").value = "";
    document.querySelectorAll("[data-role]").forEach((button) => button.classList.toggle("active", button.dataset.role === "all"));
    document.querySelectorAll("[data-sort]").forEach((button) => button.classList.toggle("active", button.dataset.sort === "priority"));
    renderAll();
  }

  if (target.id === "briefingButton") {
    document.querySelector("#briefing").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (target.id === "saveSelectedButton") {
    const id = state.selectedIssueId;
    state.saved.has(id) ? state.saved.delete(id) : state.saved.add(id);
    persistState();
    renderAll();
    showToast(state.saved.has(id) ? "선택 이슈를 저장했습니다." : "선택 이슈 저장을 해제했습니다.");
  }

  if (target.id === "manageWatchlistButton") {
    showToast("Watchlist 관리는 다음 단계에서 설정 화면으로 확장합니다.");
  }
});

$("#globalSearch").addEventListener("input", (event) => {
  state.query = event.target.value;
  renderAll();
});

async function initRadarApp() {
  await loadRemoteRadarData();
  if (!byId(issues, state.selectedIssueId)) {
    state.selectedIssueId = issues[0]?.id || "";
  }
  renderAll();
}

initRadarApp();
