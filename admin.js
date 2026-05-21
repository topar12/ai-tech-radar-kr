(function () {
  const DEFAULT_API_BASE = "https://api.lokana.kr";
  const TOKEN_SESSION_KEY = "lokana-admin-token-session";
  const API_SESSION_KEY = "lokana-admin-api-base-session";

  const refs = {};
  const state = {
    apiBaseUrl: initialApiBase(),
    token: sessionStorage.getItem(TOKEN_SESSION_KEY) || "",
    rememberSession: Boolean(sessionStorage.getItem(TOKEN_SESSION_KEY)),
    health: null,
    status: null,
    jobs: [],
    bootstrap: null,
    alerts: [],
    lastResult: null,
    loading: false,
    loadingJobs: false,
    activeAction: null,
    updatedAt: null
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    bindRefs();
    refs.apiBaseInput.value = state.apiBaseUrl;
    refs.adminTokenInput.value = state.token;
    refs.rememberSessionInput.checked = state.rememberSession;
    bindEvents();
    render();
    refreshAll();
  }

  function bindRefs() {
    [
      "apiBaseInput",
      "adminTokenInput",
      "rememberSessionInput",
      "checkConnectionButton",
      "clearTokenButton",
      "refreshButton",
      "refreshJobsButton",
      "collectButton",
      "rebuildButton",
      "clearOutputButton",
      "lastSyncLabel",
      "alertStack",
      "apiStatusValue",
      "apiStatusMeta",
      "storageStatusValue",
      "storageStatusMeta",
      "snapshotStatusValue",
      "snapshotStatusMeta",
      "jobStatusValue",
      "jobStatusMeta",
      "snapshotPill",
      "tokenStatePill",
      "previewCountPill",
      "snapshotPanel",
      "jobsList",
      "previewPanel",
      "outputLog",
      "confirmDialog",
      "confirmTitle",
      "confirmBody",
      "confirmCancelButton",
      "confirmRunButton",
      "toast"
    ].forEach((id) => {
      refs[id] = document.getElementById(id);
    });
  }

  function bindEvents() {
    refs.apiBaseInput.addEventListener("change", () => {
      state.apiBaseUrl = normalizeApiBase(refs.apiBaseInput.value);
      refs.apiBaseInput.value = state.apiBaseUrl;
      sessionStorage.setItem(API_SESSION_KEY, state.apiBaseUrl);
      refreshAll();
    });

    refs.adminTokenInput.addEventListener("input", () => {
      state.token = refs.adminTokenInput.value.trim();
      persistTokenPreference();
      render();
    });

    refs.adminTokenInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        refreshAll();
      }
    });

    refs.rememberSessionInput.addEventListener("change", () => {
      state.rememberSession = refs.rememberSessionInput.checked;
      persistTokenPreference();
      render();
    });

    refs.checkConnectionButton.addEventListener("click", refreshAll);
    refs.refreshButton.addEventListener("click", refreshAll);
    refs.refreshJobsButton.addEventListener("click", refreshJobsOnly);
    refs.clearTokenButton.addEventListener("click", clearToken);
    refs.collectButton.addEventListener("click", () => runAdminAction("collect"));
    refs.rebuildButton.addEventListener("click", () => runAdminAction("rebuild"));
    refs.clearOutputButton.addEventListener("click", () => {
      state.lastResult = null;
      renderOutput();
    });
  }

  function initialApiBase() {
    const params = new URLSearchParams(window.location.search);
    const queryApi = params.get("api");
    const sessionApi = sessionStorage.getItem(API_SESSION_KEY);
    const runtimeApi = window.LOKANA_API_BASE_URL || window.RADAR_API_BASE_URL || "";
    return normalizeApiBase(queryApi || sessionApi || runtimeApi || DEFAULT_API_BASE);
  }

  function normalizeApiBase(value) {
    const raw = String(value || "").trim();
    if (!raw) return DEFAULT_API_BASE;
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return withProtocol.replace(/\/+$/, "");
  }

  function persistTokenPreference() {
    if (state.rememberSession && state.token) {
      sessionStorage.setItem(TOKEN_SESSION_KEY, state.token);
      return;
    }
    sessionStorage.removeItem(TOKEN_SESSION_KEY);
  }

  function clearToken() {
    state.token = "";
    state.rememberSession = false;
    refs.adminTokenInput.value = "";
    refs.rememberSessionInput.checked = false;
    sessionStorage.removeItem(TOKEN_SESSION_KEY);
    showToast("관리자 토큰을 이 탭에서 지웠습니다.");
    render();
  }

  async function refreshAll() {
    state.loading = true;
    state.alerts = [];
    render();

    const healthResult = await settle(() => requestJson("/health"));
    const bootstrapResult = await settle(() => requestJson("/api/bootstrap"));

    state.health = healthResult.ok ? healthResult.value : null;
    state.bootstrap = bootstrapResult.ok ? bootstrapResult.value : null;

    if (!healthResult.ok) pushAlert("error", `API 상태 확인 실패: ${formatError(healthResult.error)}`);
    if (!bootstrapResult.ok) pushAlert("error", `공개 데이터 확인 실패: ${formatError(bootstrapResult.error)}`);

    if (hasToken()) {
      const statusResult = await settle(() => requestJson("/api/admin/status", { admin: true }));
      const jobsResult = await settle(() => requestJson("/api/admin/jobs?limit=10", { admin: true }));

      state.status = statusResult.ok ? statusResult.value : null;
      state.jobs = jobsResult.ok ? jobsResult.value.jobs || [] : [];

      if (!statusResult.ok) pushAlert("error", `관리자 상태 확인 실패: ${formatError(statusResult.error)}`);
      if (!jobsResult.ok) pushAlert("error", `작업 목록 확인 실패: ${formatError(jobsResult.error)}`);
    } else {
      state.status = null;
      state.jobs = [];
      pushAlert("warn", "Admin token을 넣으면 D1 테이블 수, 최근 작업, 수동 작업 버튼이 활성화됩니다.");
    }

    if (isInsecureRemoteApi()) {
      pushAlert("warn", "운영 토큰은 HTTPS API에서만 사용하는 것이 안전합니다. 로컬 테스트가 아니라면 API 주소를 https로 바꾸세요.");
    }

    state.loading = false;
    state.updatedAt = new Date();
    render();
  }

  async function refreshJobsOnly() {
    if (!hasToken()) {
      showToast("작업 목록은 Admin token이 있어야 볼 수 있습니다.");
      return;
    }

    state.loadingJobs = true;
    renderJobs();
    const jobsResult = await settle(() => requestJson("/api/admin/jobs?limit=10", { admin: true }));
    state.loadingJobs = false;

    if (jobsResult.ok) {
      state.jobs = jobsResult.value.jobs || [];
      state.updatedAt = new Date();
      showToast("최근 작업을 새로 불러왔습니다.");
    } else {
      pushAlert("error", `작업 목록 확인 실패: ${formatError(jobsResult.error)}`);
    }
    render();
  }

  async function runAdminAction(kind) {
    if (!hasToken()) {
      showToast("Admin token을 먼저 입력하세요.");
      refs.adminTokenInput.focus();
      return;
    }

    const config = actionConfig(kind);
    const confirmed = await confirmAction(config);
    if (!confirmed) return;

    state.activeAction = kind;
    state.alerts = [];
    render();

    const result = await settle(() => requestJson(config.path, { method: "POST", admin: true }));
    state.activeAction = null;

    if (result.ok) {
      state.lastResult = {
        title: config.doneTitle,
        at: new Date().toISOString(),
        body: result.value
      };
      showToast(config.doneToast);
      await refreshAll();
    } else {
      state.lastResult = {
        title: `${config.doneTitle} 실패`,
        at: new Date().toISOString(),
        body: errorToPlainObject(result.error)
      };
      pushAlert("error", `${config.doneTitle} 실패: ${formatError(result.error)}`);
      render();
    }
  }

  function actionConfig(kind) {
    if (kind === "collect") {
      return {
        path: "/api/admin/collect",
        title: "외부 소스를 다시 수집할까요?",
        body: "공식 RSS/Atom을 호출한 뒤 D1 테이블과 공개 스냅샷을 갱신합니다. 외부 소스 응답 상태에 따라 일부 피드가 비어 있을 수 있습니다.",
        runLabel: "수집 실행",
        doneTitle: "외부 소스 수집",
        doneToast: "수집 작업이 끝났습니다."
      };
    }
    return {
      path: "/api/admin/rebuild-snapshot",
      title: "스냅샷을 다시 만들까요?",
      body: "현재 D1 테이블에 들어 있는 데이터를 기준으로 공개 bootstrap 스냅샷만 새로 만듭니다. 외부 소스는 다시 읽지 않습니다.",
      runLabel: "재생성 실행",
      doneTitle: "스냅샷 재생성",
      doneToast: "스냅샷 재생성이 끝났습니다."
    };
  }

  function confirmAction(config) {
    if (!refs.confirmDialog || typeof refs.confirmDialog.showModal !== "function") {
      return Promise.resolve(window.confirm(`${config.title}\n\n${config.body}`));
    }

    refs.confirmTitle.textContent = config.title;
    refs.confirmBody.textContent = config.body;
    refs.confirmRunButton.textContent = config.runLabel;

    return new Promise((resolve) => {
      const cleanup = () => {
        refs.confirmCancelButton.onclick = null;
        refs.confirmRunButton.onclick = null;
        refs.confirmDialog.removeEventListener("cancel", onCancel);
      };
      const finish = (value) => {
        cleanup();
        refs.confirmDialog.close();
        resolve(value);
      };
      const onCancel = (event) => {
        event.preventDefault();
        finish(false);
      };

      refs.confirmCancelButton.onclick = () => finish(false);
      refs.confirmRunButton.onclick = () => finish(true);
      refs.confirmDialog.addEventListener("cancel", onCancel);
      refs.confirmDialog.showModal();
    });
  }

  async function requestJson(path, options = {}) {
    const url = new URL(path, `${state.apiBaseUrl}/`);
    const headers = {
      Accept: "application/json"
    };

    if (options.admin) {
      headers["X-Admin-Token"] = state.token;
    }

    const response = await fetch(url.toString(), {
      method: options.method || "GET",
      headers
    });
    const text = await response.text();
    const body = parseJson(text);

    if (!response.ok) {
      const error = new Error(body?.message || body?.error || `HTTP ${response.status}`);
      error.status = response.status;
      error.body = body;
      throw error;
    }

    return body;
  }

  function parseJson(text) {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  }

  async function settle(callback) {
    try {
      return { ok: true, value: await callback() };
    } catch (error) {
      return { ok: false, error };
    }
  }

  function pushAlert(type, message) {
    state.alerts.push({ type, message });
  }

  function render() {
    renderTopbar();
    renderAlerts();
    renderStats();
    renderSnapshot();
    renderActions();
    renderJobs();
    renderPreview();
    renderOutput();
    renderButtons();
  }

  function renderTopbar() {
    refs.lastSyncLabel.textContent = state.updatedAt
      ? `마지막 확인 ${formatTime(state.updatedAt)}`
      : "아직 확인 전";
  }

  function renderAlerts() {
    refs.alertStack.innerHTML = state.alerts
      .map((alert) => `<div class="alert ${escapeHtml(alert.type)}">${escapeHtml(alert.message)}</div>`)
      .join("");
  }

  function renderStats() {
    const health = state.health;
    const snapshot = latestSnapshot();
    const latestJob = state.status?.latestJob || state.jobs[0] || null;
    const bootstrapCounts = countsFromBootstrap(state.bootstrap);

    refs.apiStatusValue.textContent = health?.ok ? "정상" : state.loading ? "확인 중" : "미확인";
    refs.apiStatusMeta.textContent = health
      ? `${health.service || "api"} · ${health.phase || "phase"}`
      : state.loading
        ? `${state.apiBaseUrl}/health`
        : "연결 확인을 실행하세요.";

    refs.storageStatusValue.textContent = health?.d1Configured ? "D1 연결" : health ? "Sample" : "미확인";
    refs.storageStatusMeta.textContent = health
      ? `${health.storage || "unknown"} · CORS ${health.corsConfigured ? "설정" : "기본"}`
      : "Cloudflare Worker 상태";

    refs.snapshotStatusValue.textContent = snapshot?.generatedAt ? relativeTime(snapshot.generatedAt) : "미확인";
    refs.snapshotStatusMeta.textContent = snapshot?.generatedAt
      ? formatDate(snapshot.generatedAt)
      : bootstrapCounts.issues
        ? `공개 이슈 ${bootstrapCounts.issues}개`
        : "최신 스냅샷 대기";

    refs.jobStatusValue.textContent = latestJob
      ? jobStatusLabel(latestJob.status)
      : adminReady()
        ? "작업 없음"
        : hasToken()
          ? "확인 필요"
          : "토큰 필요";
    refs.jobStatusMeta.textContent = latestJob
      ? `${jobKindLabel(latestJob.kind)} · ${formatDate(latestJob.startedAt)}`
      : adminReady()
        ? "최근 작업 기록이 비어 있습니다."
        : hasToken()
          ? "연결 확인으로 토큰을 검증하세요."
          : "관리자 토큰 입력 후 확인";
  }

  function renderSnapshot() {
    const snapshot = latestSnapshot();
    const counts = snapshot?.counts || countsFromBootstrap(state.bootstrap);
    const hasCounts = Object.values(counts).some((count) => Number(count) > 0);

    refs.snapshotPill.textContent = snapshot?.generatedAt ? "공개 중" : hasCounts ? "bootstrap 확인" : "대기";
    refs.snapshotPill.className = `status-pill ${snapshot?.generatedAt || hasCounts ? "ok" : "muted"}`;

    if (!snapshot && !hasCounts) {
      refs.snapshotPanel.innerHTML = emptyState(state.loading ? "데이터를 확인하는 중입니다." : "아직 스냅샷 정보를 불러오지 않았습니다.");
      return;
    }

    refs.snapshotPanel.innerHTML = `
      <div class="snapshot-meta">
        ${metaItem("Snapshot ID", snapshot?.id || "bootstrap")}
        ${metaItem("생성 시각", snapshot?.generatedAt ? formatDate(snapshot.generatedAt) : formatDate(state.bootstrap?.generatedAt))}
        ${metaItem("Created", snapshot?.createdAt ? formatDate(snapshot.createdAt) : "공개 payload 기준")}
        ${metaItem("API", state.apiBaseUrl)}
      </div>
      <div class="counts-row" aria-label="데이터 수">
        ${countChip("Sources", counts.sources ?? counts.sourceCount)}
        ${countChip("Signals", counts.signals ?? counts.signalCount)}
        ${countChip("Issues", counts.issues ?? counts.issueCount)}
        ${countChip("Watchlists", counts.watchlists ?? counts.watchlistCount)}
      </div>
    `;
  }

  function renderActions() {
    refs.tokenStatePill.textContent = adminReady() ? "토큰 확인" : hasToken() ? "확인 필요" : "토큰 필요";
    refs.tokenStatePill.className = `status-pill ${adminReady() ? "ok" : hasToken() ? "warn" : "muted"}`;

    refs.collectButton.classList.toggle("is-loading", state.activeAction === "collect");
    refs.rebuildButton.classList.toggle("is-loading", state.activeAction === "rebuild");
    refs.collectButton.querySelector("b").textContent = state.activeAction === "collect" ? "진행 중" : "실행";
    refs.rebuildButton.querySelector("b").textContent = state.activeAction === "rebuild" ? "진행 중" : "실행";
  }

  function renderJobs() {
    if (state.loadingJobs) {
      refs.jobsList.innerHTML = emptyState("최근 작업을 불러오는 중입니다.");
      return;
    }

    if (!hasToken()) {
      refs.jobsList.innerHTML = emptyState("Admin token을 입력하면 최근 수집, 재생성, 실패 작업을 확인할 수 있습니다.");
      return;
    }

    if (!adminReady()) {
      refs.jobsList.innerHTML = emptyState("관리자 상태 확인에 성공하면 최근 작업 목록이 표시됩니다.");
      return;
    }

    if (!state.jobs.length) {
      refs.jobsList.innerHTML = emptyState(state.loading ? "작업 목록을 확인하는 중입니다." : "최근 작업 기록이 없습니다.");
      return;
    }

    refs.jobsList.innerHTML = state.jobs.map((job) => `
      <article class="job-row">
        <div>
          <span>${escapeHtml(jobKindLabel(job.kind))}</span>
          <strong>${escapeHtml(job.id || "job")}</strong>
        </div>
        <div>
          <span>${escapeHtml(formatDate(job.startedAt))}</span>
          <p>${escapeHtml(jobSummaryText(job))}</p>
        </div>
        <span class="status-pill job-status ${statusClass(job.status)}">${escapeHtml(jobStatusLabel(job.status))}</span>
      </article>
    `).join("");
  }

  function renderPreview() {
    const issues = Array.isArray(state.bootstrap?.issues) ? state.bootstrap.issues : [];
    const sources = Array.isArray(state.bootstrap?.sources) ? state.bootstrap.sources : [];
    const generatedAt = state.bootstrap?.generatedAt;

    refs.previewCountPill.textContent = issues.length ? `${issues.length} issues` : "대기";
    refs.previewCountPill.className = `status-pill ${issues.length ? "ok" : "muted"}`;

    if (!issues.length) {
      refs.previewPanel.innerHTML = emptyState(state.loading ? "공개 데이터를 불러오는 중입니다." : "공개 데이터가 아직 없습니다.");
      return;
    }

    const topIssues = issues.slice(0, 3).map((issue) => previewItem(
      issue.title,
      issue.conclusion || issue.summary?.whyMatters || "요약 없음",
      `${issue.certainty || "signal"} · ${issue.importance || 0}점`
    ));
    const sourceItem = previewItem(
      "소스 상태",
      sources.slice(0, 3).map((source) => source.publisher).join(", ") || "소스 없음",
      `${sources.length} sources`
    );
    const generatedItem = previewItem(
      "생성 시각",
      generatedAt ? formatDate(generatedAt) : "생성 시각 없음",
      "bootstrap"
    );

    refs.previewPanel.innerHTML = [...topIssues, sourceItem, generatedItem].join("");
  }

  function renderOutput() {
    if (!state.lastResult) {
      refs.outputLog.textContent = "아직 실행 결과가 없습니다.";
      return;
    }

    refs.outputLog.textContent = `${state.lastResult.title}\n${formatDate(state.lastResult.at)}\n\n${JSON.stringify(state.lastResult.body, null, 2)}`;
  }

  function renderButtons() {
    const busy = state.loading || Boolean(state.activeAction);
    refs.checkConnectionButton.disabled = busy;
    refs.refreshButton.disabled = busy;
    refs.refreshJobsButton.disabled = busy || !adminReady();
    refs.collectButton.disabled = busy || !adminReady();
    refs.rebuildButton.disabled = busy || !adminReady();
  }

  function latestSnapshot() {
    if (state.status?.latestSnapshot) return state.status.latestSnapshot;
    if (state.bootstrap?.generatedAt) {
      return {
        id: "public-bootstrap",
        generatedAt: state.bootstrap.generatedAt,
        counts: countsFromBootstrap(state.bootstrap)
      };
    }
    return null;
  }

  function countsFromBootstrap(payload) {
    if (!payload) return { sources: 0, signals: 0, issues: 0, watchlists: 0 };
    return {
      sources: arrayCount(payload.sources),
      signals: arrayCount(payload.signals),
      issues: arrayCount(payload.issues),
      watchlists: arrayCount(payload.watchlists)
    };
  }

  function arrayCount(value) {
    return Array.isArray(value) ? value.length : 0;
  }

  function hasToken() {
    return Boolean(state.token);
  }

  function adminReady() {
    return hasToken() && state.status?.ok === true;
  }

  function isInsecureRemoteApi() {
    return state.apiBaseUrl.startsWith("http://") && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(state.apiBaseUrl);
  }

  function metaItem(label, value) {
    return `<div class="meta-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "-")}</strong></div>`;
  }

  function countChip(label, value) {
    return `<div class="count-chip"><b>${escapeHtml(formatNumber(value || 0))}</b><small>${escapeHtml(label)}</small></div>`;
  }

  function previewItem(title, body, meta) {
    return `
      <article class="preview-item">
        <span>${escapeHtml(meta || "")}</span>
        <strong>${escapeHtml(title || "제목 없음")}</strong>
        <p>${escapeHtml(body || "요약 없음")}</p>
      </article>
    `;
  }

  function emptyState(message) {
    return `<div class="empty-state">${escapeHtml(message)}</div>`;
  }

  function jobSummaryText(job) {
    const summary = job.summary || {};
    const parts = [];

    if (summary.counts) {
      const counts = summary.counts;
      parts.push(`sources ${counts.sourceCount ?? counts.sources ?? 0}, issues ${counts.issueCount ?? counts.issues ?? 0}`);
    }
    if (Number.isFinite(Number(summary.feedCount))) parts.push(`feeds ${summary.feedCount}`);
    if (Number.isFinite(Number(summary.failedFeedCount)) && Number(summary.failedFeedCount) > 0) parts.push(`failed feeds ${summary.failedFeedCount}`);
    if (summary.rebuiltFrom) parts.push(`rebuilt from ${summary.rebuiltFrom}`);
    if (summary.error) parts.push(`error: ${summary.error}`);
    if (job.snapshotId) parts.push(`snapshot ${shortId(job.snapshotId)}`);

    return parts.join(" · ") || "작업 상세 요약이 없습니다.";
  }

  function jobKindLabel(kind) {
    const labels = {
      collect_official_feeds: "외부 소스 수집",
      rebuild_snapshot: "스냅샷 재생성"
    };
    return labels[kind] || kind || "작업";
  }

  function jobStatusLabel(status) {
    const labels = {
      completed: "완료",
      partial: "부분 완료",
      failed: "실패",
      running: "진행 중"
    };
    return labels[status] || status || "미확인";
  }

  function statusClass(status) {
    if (status === "completed") return "ok";
    if (status === "failed") return "error";
    if (status === "partial") return "warn";
    return "muted";
  }

  function formatError(error) {
    const status = error?.status ? `HTTP ${error.status} · ` : "";
    return `${status}${error?.message || String(error)}`;
  }

  function errorToPlainObject(error) {
    return {
      status: error?.status || null,
      message: error?.message || String(error),
      body: error?.body || null
    };
  }

  function formatDate(value) {
    if (!value) return "-";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("ko-KR", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  function formatTime(value) {
    const date = value instanceof Date ? value : new Date(value);
    return new Intl.DateTimeFormat("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(date);
  }

  function relativeTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "미확인";
    const diffMinutes = Math.round((Date.now() - date.getTime()) / 60000);
    if (Math.abs(diffMinutes) < 1) return "방금";
    if (diffMinutes < 60) return `${diffMinutes}분 전`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 48) return `${diffHours}시간 전`;
    return `${Math.round(diffHours / 24)}일 전`;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("ko-KR").format(Number(value || 0));
  }

  function shortId(value) {
    const text = String(value || "");
    return text.length > 18 ? `${text.slice(0, 10)}...${text.slice(-6)}` : text;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function showToast(message) {
    refs.toast.textContent = message;
    refs.toast.classList.add("show");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => refs.toast.classList.remove("show"), 2800);
  }
})();
