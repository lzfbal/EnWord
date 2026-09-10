let words = [];
let queue = [];
let currentIndex = 0;
let mode = "zh2en";
let totalChecked = 0;
let totalCorrect = 0;
let answeredThisRound = false;
let currentSessionType = "none";
let sessionTargetCount = 0;
let sessionCompletedCount = 0;
let sessionWordMastery = new Map();
const sessionSnapshots = {
  study: null,
  review: null,
  quiz: null,
};
let progressById = new Map();
let selectedFilterTags = new Set();
let managerStatusFilter = "all";
let managerLearningSort = "time";
let currentSentenceTask = null;
let sentenceTaskRequestId = 0;
let customSentenceZhText = "";
let popFirstAttemptJudged = false;
let popRetryScheduled = false;
let popHadWrongAttempt = false;

const REVIEW_INTERVALS_DAYS = [1, 3, 7, 15, 30];
const REVIEW_SESSION_LIMIT = 30;
const SESSION_STATE_STORAGE_KEY = "enword.sessionState.v1";

const API_PROGRESS_URL = "/api/progress";

const progressEl = document.getElementById("progress");
const scoreEl = document.getElementById("score");
const promptLabelEl = document.getElementById("promptLabel");
const promptTextEl = document.getElementById("promptText");
const answerInputEl = document.getElementById("answerInput");
const resultEl = document.getElementById("result");
const correctAnswerEl = document.getElementById("correctAnswer");
const checkLoadingEl = document.getElementById("checkLoading");
const checkBtn = document.getElementById("checkBtn");
const showBtn = document.getElementById("showBtn");
const nextBtn = document.getElementById("nextBtn");
const markMasteredBtn = document.getElementById("markMasteredBtn");
const exampleBtn = document.getElementById("exampleBtn");
const studySynonymBtn = document.getElementById("studySynonymBtn");
const tabStudyBtn = document.getElementById("tabStudyBtn");
const tabManagerBtn = document.getElementById("tabManagerBtn");
const tabFavoritesBtn = document.getElementById("tabFavoritesBtn");
const tabCompareFavoritesBtn = document.getElementById("tabCompareFavoritesBtn");
const tabSynonymFavoritesBtn = document.getElementById("tabSynonymFavoritesBtn");
const studyControlsPanelEl = document.getElementById("studyControlsPanel");
const statusPanelEl = document.getElementById("statusPanel");
const filterPanelEl = document.getElementById("filterPanel");
const startStudyBtn = document.getElementById("startStudyBtn");
const startReviewBtn = document.getElementById("startReviewBtn");
const startQuizBtn = document.getElementById("startQuizBtn");
const resetSessionBtn = document.getElementById("resetSessionBtn");
const endSessionBtn = document.getElementById("endSessionBtn");
const hiddenModeBtn = document.getElementById("hiddenModeBtn");
const exitHiddenModeBtn = document.getElementById("exitHiddenModeBtn");
const closeManagerBtn = document.getElementById("closeManagerBtn");
const closeFavoritesBtn = document.getElementById("closeFavoritesBtn");
const favoriteSentenceBtn = document.getElementById("favoriteSentenceBtn");
const sentenceDifficultyWrapEl = document.getElementById("sentenceDifficultyWrap");
const sentenceTranslatePanelEl = document.getElementById("sentenceTranslatePanel");
const customSentenceInputEl = document.getElementById("customSentenceInput");
const translateSentenceBtn = document.getElementById("translateSentenceBtn");
const favoriteTranslatedSentenceBtn = document.getElementById("favoriteTranslatedSentenceBtn");
const customSentenceResultEl = document.getElementById("customSentenceResult");
const sessionCountEl = document.getElementById("sessionCount");
const sentenceDifficultyEl = document.getElementById("sentenceDifficulty");
const newCountEl = document.getElementById("newCount");
const learningCountEl = document.getElementById("learningCount");
const masteredCountEl = document.getElementById("masteredCount");
const dueCountEl = document.getElementById("dueCount");
const filteredCountEl = document.getElementById("filteredCount");
const sessionTypeTextEl = document.getElementById("sessionTypeText");
const searchInputEl = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const filterTagsEl = document.getElementById("filterTags");
const searchMetaEl = document.getElementById("searchMeta");
const searchResultsEl = document.getElementById("searchResults");
const searchSuggestEl = document.getElementById("searchSuggest");
const comparePanelEl = document.getElementById("comparePanel");
const compareListEl = document.getElementById("compareList");
const runCompareBtn = document.getElementById("runCompareBtn");
const clearCompareBtn = document.getElementById("clearCompareBtn");
const newTagInputEl = document.getElementById("newTagInput");
const addTagBtn = document.getElementById("addTagBtn");
const currentWordTagsEl = document.getElementById("currentWordTags");
const examplesBoxEl = document.getElementById("examplesBox");
const wordTagEditorEl = document.querySelector(".word-tag-editor");
const quizPanelEl = document.getElementById("quizPanel");
const queueDebugPanelEl = document.getElementById("queueDebugPanel");
const queueDebugContentEl = document.getElementById("queueDebugContent");
const managerPanelEl = document.getElementById("managerPanel");
const favoritesPanelEl = document.getElementById("favoritesPanel");
const favoritesMetaEl = document.getElementById("favoritesMeta");
const favoritesListEl = document.getElementById("favoritesList");
const compareFavoritesPanelEl = document.getElementById("compareFavoritesPanel");
const compareFavoritesMetaEl = document.getElementById("compareFavoritesMeta");
const compareFavoritesListEl = document.getElementById("compareFavoritesList");
const closeCompareFavoritesBtn = document.getElementById("closeCompareFavoritesBtn");
const synonymFavoritesPanelEl = document.getElementById("synonymFavoritesPanel");
const synonymFavoritesMetaEl = document.getElementById("synonymFavoritesMeta");
const synonymFavoritesListEl = document.getElementById("synonymFavoritesList");
const closeSynonymFavoritesBtn = document.getElementById("closeSynonymFavoritesBtn");
const detailModalEl = document.getElementById("detailModal");
const detailModalTitleEl = document.getElementById("detailModalTitle");
const detailModalBodyEl = document.getElementById("detailModalBody");
const detailModalCloseBtn = document.getElementById("detailModalCloseBtn");
const appVersionBadgeEl = document.getElementById("appVersionBadge");
const managerSearchInputEl = document.getElementById("managerSearchInput");
const managerLearningSortWrapEl = document.getElementById("managerLearningSortWrap");
const managerLearningSortEl = document.getElementById("managerLearningSort");
const managerMetaEl = document.getElementById("managerMeta");
const managerWordListEl = document.getElementById("managerWordList");
const managerFilterButtons = Array.from(document.querySelectorAll(".manager-filter-btn"));
const appShellEl = document.querySelector(".app");

let suggestTimer = null;
let activeSearchTagEditorWordId = null;
let activeDetailWordId = null;
const compareWordIds = new Set();
const exampleCache = new Map();
const wordDetailCache = new Map();
const wordDetailLoadingSet = new Set();
let isCheckingAnswer = false;
let activeMainTab = "study";
let quizVisible = false;
let isHiddenMode = false;
let isQueueDebugVisible = false;
let normalWindowSize = null;
let aiRequestCounter = 0;
const aiStreamTextByRequestId = new Map();
const aiInFlightBySignature = new Map();

const searchUtils = window.EnWordSearchUtils || {};
const detailPanels = window.EnWordDetailPanels || {};

function setCheckingState(loading) {
  isCheckingAnswer = loading;
  if (checkLoadingEl) {
    checkLoadingEl.classList.toggle("is-hidden", !loading);
  }
  if (checkBtn) {
    checkBtn.disabled = loading;
  }
}

async function idbGetAll() {
  if (window.electronProgress?.getAll) {
    return window.electronProgress.getAll();
  }

  const resp = await fetch(API_PROGRESS_URL, {
    method: "GET",
    headers: { "Accept": "application/json" },
  });
  if (!resp.ok) {
    throw new Error(`Failed to load progress: ${resp.status}`);
  }
  return resp.json();
}

async function idbPut(record) {
  if (window.electronProgress?.upsert) {
    await window.electronProgress.upsert(record);
    return;
  }

  const resp = await fetch(API_PROGRESS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(record),
  });
  if (!resp.ok) {
    throw new Error(`Failed to save progress: ${resp.status}`);
  }
}

function getProgress(id) {
  const found = progressById.get(id);
  if (found) return found;
  return {
    id,
    status: "new",
    stage: 0,
    nextReviewAt: 0,
    lastReviewedAt: 0,
    rightCount: 0,
    wrongCount: 0,
    tags: [],
  };
}

async function setProgress(record) {
  progressById.set(record.id, record);
  await idbPut(record);
}

function startOfDayMs(ts) {
  const base = Number(ts || Date.now());
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function addDaysAtStartOfDay(baseTs, days) {
  const dayMs = 24 * 60 * 60 * 1000;
  return startOfDayMs(baseTs) + (Math.max(0, Number(days || 0)) * dayMs);
}

function isDueByDate(nextReviewAt, nowTs = Date.now()) {
  return startOfDayMs(nextReviewAt) <= startOfDayMs(nowTs);
}

function getSessionCount() {
  const value = Number.parseInt(sessionCountEl.value, 10);
  if (Number.isNaN(value)) return 20;
  return Math.min(200, Math.max(1, value));
}

function findWordById(id) {
  return words.find((w) => w.id === id);
}

function toTagKey(tag) {
  return tag.trim().toLowerCase();
}

function normalizeTagText(tag) {
  return tag.replace(/\s+/g, " ").trim();
}

function getWordTags(wordId) {
  const record = getProgress(wordId);
  return Array.isArray(record.tags) ? record.tags : [];
}

function getWordStatus(wordId) {
  return getProgress(wordId).status || "new";
}

function statusLabel(status) {
  if (status === "learning") return "Studying";
  if (status === "mastered") return "Mastered";
  return "Not Studied";
}

function managerMatchesWord(word) {
  if (managerStatusFilter !== "all" && getWordStatus(word.id) !== managerStatusFilter) {
    return false;
  }

  const q = String(managerSearchInputEl?.value || "").trim().toLowerCase();
  if (!q) return true;
  return word.en.toLowerCase().includes(q) || word.zh.toLowerCase().includes(q);
}

async function setWordStatus(wordId, status) {
  const prev = getProgress(wordId);
  const next = {
    ...prev,
    status,
  };

  if (status === "mastered") {
    next.nextReviewAt = 0;
    next.stage = Math.max(next.stage || 0, REVIEW_INTERVALS_DAYS.length - 1);
  }

  await setProgress(next);
}

function currentSearchKeyword() {
  return searchInputEl.value.trim().toLowerCase();
}

function extractMeaningCore(zh) {
  const raw = String(zh || "").trim();
  if (!raw) return "";
  const noPos = raw.replace(/^[a-zA-Z.\s/,-]+/, "").trim();
  const core = noPos.split(/[；;。,.]/)[0].trim();
  return core || noPos || raw;
}

function guessPos(zh) {
  const s = String(zh || "").toLowerCase();
  if (s.includes("adj.")) return "adj";
  if (s.includes("adv.")) return "adv";
  if (s.includes(" n.")) return "noun";
  if (/^n\./.test(s)) return "noun";
  if (s.includes("vt.") || s.includes("vi.") || s.includes(" v.")) return "verb";
  return "verb";
}

function getSentenceDifficulty() {
  const value = String(sentenceDifficultyEl?.value || "starter").toLowerCase();
  if (value === "advanced") return "advanced";
  if (value === "intermediate") return "intermediate";
  if (value === "beginner") return "beginner";
  if (value === "starter") return "starter";
  return "beginner";
}

function sentenceDifficultyLabel(value) {
  if (value === "advanced") return "Advanced";
  if (value === "intermediate") return "Intermediate";
  if (value === "beginner") return "Beginner";
  if (value === "starter") return "Starter";
  return "Beginner";
}

function applyModeSpecificUI() {
  const sentenceMode = mode === "sentence";
  if (sentenceDifficultyWrapEl) {
    sentenceDifficultyWrapEl.classList.toggle("is-hidden", !sentenceMode);
  }
  if (showBtn) {
    showBtn.classList.add("is-hidden");
  }
  if (wordTagEditorEl) {
    wordTagEditorEl.classList.toggle("is-hidden", sentenceMode);
  }
  if (markMasteredBtn) {
    markMasteredBtn.classList.toggle("is-hidden", sentenceMode);
  }
  if (exampleBtn) {
    exampleBtn.classList.toggle("is-hidden", sentenceMode);
  }
  if (examplesBoxEl) {
    examplesBoxEl.classList.toggle("is-hidden", sentenceMode);
  }
  if (favoriteSentenceBtn) {
    favoriteSentenceBtn.classList.toggle("is-hidden", !sentenceMode);
  }
}

function setCustomSentenceTranslateResult(text, type = "") {
  if (!customSentenceResultEl) return;
  customSentenceResultEl.classList.remove("bad", "ok");
  if (type) {
    customSentenceResultEl.classList.add(type);
  }
  customSentenceResultEl.textContent = String(text || "");
}

function clearCustomSentenceTranslateState() {
  customSentenceZhText = "";
  setCustomSentenceTranslateResult("");
}

async function translateCustomSentenceToChinese() {
  if (!window.electronAI?.translateSentenceToChinese) {
    setCustomSentenceTranslateResult("AI translation is unavailable.", "bad");
    return;
  }

  const enSentence = String(customSentenceInputEl?.value || "").trim();
  if (!enSentence) {
    setCustomSentenceTranslateResult("Please type an English sentence first.", "bad");
    return;
  }

  const payload = {
    enSentence,
    requestId: nextAiRequestId("sentence-custom-translate"),
  };
  const aiRequestId = payload.requestId;
  let tick = null;

  try {
    tick = setInterval(() => {
      renderThinkingPreviewInElement(
        customSentenceResultEl,
        "Translating...",
        aiStreamTextByRequestId.get(aiRequestId) || ""
      );
    }, 180);

    const translated = await dedupeAiRequest(
      "translateSentenceToChinese",
      payload,
      () => window.electronAI.translateSentenceToChinese(payload)
    );

    if (tick) clearInterval(tick);
    aiStreamTextByRequestId.delete(aiRequestId);
    clearThinkingPreviewInElement(customSentenceResultEl);

    const zhText = String(translated?.zhText || "").trim();
    if (!zhText) {
      throw new Error("Empty translation");
    }

    customSentenceZhText = zhText;
    setCustomSentenceTranslateResult(`ZH: ${zhText}`, "ok");
  } catch (err) {
    if (tick) clearInterval(tick);
    aiStreamTextByRequestId.delete(aiRequestId);
    clearThinkingPreviewInElement(customSentenceResultEl);
    customSentenceZhText = "";
    setCustomSentenceTranslateResult(`Translate failed: ${String(err?.message || "Unknown error")}`, "bad");
  }
}

async function favoriteTranslatedSentence() {
  const enText = String(customSentenceInputEl?.value || "").trim();
  const zhText = String(customSentenceZhText || "").trim();

  if (!enText) {
    setCustomSentenceTranslateResult("Please type an English sentence first.", "bad");
    return;
  }
  if (!zhText) {
    setCustomSentenceTranslateResult("Please translate the sentence before favoriting.", "bad");
    return;
  }

  try {
    await addSentenceFavorite({ zhText, enText });
    setCustomSentenceTranslateResult(`Saved\nZH: ${zhText}\nEN: ${enText}`, "ok");
    if (!favoritesPanelEl?.classList.contains("is-hidden")) {
      renderFavoritesPanel();
    }
  } catch (err) {
    setCustomSentenceTranslateResult(`Favorite failed: ${String(err?.message || "Unknown error")}`, "bad");
  }
}

async function buildSentenceTaskByModel(word, options = {}) {
  if (!window.electronAI?.generateSentencePrompt) {
    throw new Error("AI sentence generation is unavailable. Please check app integration.");
  }

  try {
    const payload = {
      targetWord: String(word?.en || ""),
      targetMeaning: extractMeaningCore(word?.zh || ""),
      difficulty: getSentenceDifficulty(),
      requestId: String(options?.requestId || "").trim(),
    };

    const task = await dedupeAiRequest(
      "generateSentencePrompt",
      payload,
      () => window.electronAI.generateSentencePrompt(payload)
    );

    if (!task || typeof task !== "object") {
      throw new Error("API returned an invalid sentence payload.");
    }

    const zhPrompt = String(task.zhPrompt || "").trim();
    if (!zhPrompt) {
      throw new Error("API returned an empty sentence.");
    }

    const referenceEn = String(task.referenceEn || "").trim();
    const model = String(task.model || "").trim();

    return {
      zhPrompt,
      referenceEn,
      source: model ? `model:${model}` : "model",
    };
  } catch (err) {
    const message = String(err?.message || "API request failed");
    throw new Error(`Sentence generation failed: ${message}`);
  }
}

async function buildSentenceTask(word, options = {}) {
  return buildSentenceTaskByModel(word, options);
}

async function listSentenceFavorites() {
  if (!window.electronSentenceFavorites?.list) {
    throw new Error("Sentence favorites API is unavailable");
  }
  const rows = await window.electronSentenceFavorites.list();
  if (!Array.isArray(rows)) return [];
  return rows;
}

async function addSentenceFavorite(payload) {
  if (!window.electronSentenceFavorites?.add) {
    throw new Error("Sentence favorites API is unavailable");
  }
  return window.electronSentenceFavorites.add(payload);
}

async function removeSentenceFavoriteById(id) {
  if (!window.electronSentenceFavorites?.remove) {
    throw new Error("Sentence favorites API is unavailable");
  }
  return window.electronSentenceFavorites.remove({ id });
}

async function listCompareFavorites() {
  if (!window.electronCompareFavorites?.list) {
    throw new Error("Compare favorites API is unavailable");
  }
  const rows = await window.electronCompareFavorites.list();
  if (!Array.isArray(rows)) return [];
  return rows;
}

async function addCompareFavorite(payload) {
  if (!window.electronCompareFavorites?.add) {
    throw new Error("Compare favorites API is unavailable");
  }
  return window.electronCompareFavorites.add(payload);
}

async function removeCompareFavoriteById(id) {
  if (!window.electronCompareFavorites?.remove) {
    throw new Error("Compare favorites API is unavailable");
  }
  return window.electronCompareFavorites.remove({ id });
}

async function listSynonymFavorites() {
  if (!window.electronSynonymFavorites?.list) {
    throw new Error("Synonym favorites API is unavailable");
  }
  const rows = await window.electronSynonymFavorites.list();
  if (!Array.isArray(rows)) return [];
  return rows;
}

async function addSynonymFavorite(payload) {
  if (!window.electronSynonymFavorites?.add) {
    throw new Error("Synonym favorites API is unavailable");
  }
  return window.electronSynonymFavorites.add(payload);
}

async function removeSynonymFavoriteById(id) {
  if (!window.electronSynonymFavorites?.remove) {
    throw new Error("Synonym favorites API is unavailable");
  }
  return window.electronSynonymFavorites.remove({ id });
}

function formatFavoriteTime(ts) {
  const n = Number(ts || 0);
  if (!Number.isFinite(n) || n <= 0) return "";
  return new Date(n).toLocaleString();
}

function getCurveStageText(record) {
  if (record.status !== "learning") {
    return "";
  }
  const stageIndex = Math.max(0, Number(record.stage || 0));
  const total = REVIEW_INTERVALS_DAYS.length;
  const current = Math.min(stageIndex + 1, total);
  return `Curve Stage ${current}/${total}`;
}

async function resetLearningCurve(wordId) {
  const now = Date.now();
  const record = getProgress(wordId);
  await setProgress({
    ...record,
    status: "learning",
    stage: 0,
    nextReviewAt: 0,
    lastReviewedAt: now,
  });
}

async function renderFavoritesPanel() {
  if (!favoritesListEl || !favoritesMetaEl) return;

  favoritesListEl.innerHTML = "";

  try {
    const rows = await listSentenceFavorites();
    favoritesMetaEl.textContent = `${rows.length} item(s)`;

    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "empty-text";
      empty.textContent = "No favorite sentences yet";
      favoritesListEl.appendChild(empty);
      return;
    }

    for (const row of rows) {
      const item = document.createElement("div");
      item.className = "favorite-item";

      const zh = document.createElement("div");
      zh.className = "favorite-line";
      zh.textContent = `ZH: ${String(row.zhText || "")}`;

      const en = document.createElement("div");
      en.className = "favorite-line";
      en.textContent = `EN: ${String(row.enText || "")}`;

      const time = document.createElement("div");
      time.className = "favorite-time";
      time.textContent = formatFavoriteTime(row.createdAt);

      const actions = document.createElement("div");
      actions.className = "favorite-actions";

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "search-item-tag-btn";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", async () => {
        await removeSentenceFavoriteById(row.id);
        await renderFavoritesPanel();
      });

      actions.appendChild(removeBtn);

      const metaRow = document.createElement("div");
      metaRow.className = "favorite-meta-row";
      metaRow.appendChild(time);
      metaRow.appendChild(actions);

      item.appendChild(zh);
      item.appendChild(en);
      item.appendChild(metaRow);
      favoritesListEl.appendChild(item);
    }
  } catch (err) {
    favoritesMetaEl.textContent = "Load failed";
    const failed = document.createElement("div");
    failed.className = "empty-text";
    failed.textContent = String(err?.message || err || "Unknown error");
    favoritesListEl.appendChild(failed);
  }
}

function setFavoritesVisible(visible) {
  if (!favoritesPanelEl) return;
  favoritesPanelEl.classList.toggle("is-hidden", !visible);
  if (visible) {
    renderFavoritesPanel();
  }
}

function extractCompareWordsFromResult(result) {
  if (!result || typeof result !== "object") return [];
  const words = [];
  const seen = new Set();
  const items = Array.isArray(result.items) ? result.items : [];
  for (const item of items) {
    const word = String(item?.word || "").trim();
    const key = word.toLowerCase();
    if (!word || seen.has(key)) continue;
    seen.add(key);
    words.push(word);
  }
  return words;
}

function buildCompareFavoriteTitle(words) {
  const list = Array.isArray(words) ? words.filter(Boolean) : [];
  if (!list.length) return "Untitled Compare";
  return list.join(" vs ");
}

async function favoriteCompareResult(result) {
  const words = extractCompareWordsFromResult(result);
  if (!words.length) {
    throw new Error("No compare words to favorite");
  }

  await addCompareFavorite({
    title: buildCompareFavoriteTitle(words),
    words,
    result,
  });

  if (compareFavoritesPanelEl && !compareFavoritesPanelEl.classList.contains("is-hidden")) {
    await renderCompareFavoritesPanel();
  }
}

async function openCompareFavoriteDetail(row) {
  if (!row?.result || typeof row.result !== "object") {
    throw new Error("Invalid compare favorite payload");
  }

  if (detailModalTitleEl) {
    detailModalTitleEl.textContent = row.title || "Compare Detail";
  }
  if (detailModalEl) {
    detailModalEl.classList.remove("is-hidden");
  }
  if (!detailModalBodyEl) return;

  detailModalBodyEl.innerHTML = "";
  detailModalBodyEl.appendChild(renderCompareResultPanel(row.result));
}

async function renderCompareFavoritesPanel() {
  if (!compareFavoritesListEl || !compareFavoritesMetaEl) return;

  compareFavoritesListEl.innerHTML = "";

  try {
    const rows = await listCompareFavorites();
    compareFavoritesMetaEl.textContent = `${rows.length} item(s)`;

    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "empty-text";
      empty.textContent = "No compare favorites yet";
      compareFavoritesListEl.appendChild(empty);
      return;
    }

    for (const row of rows) {
      const item = document.createElement("div");
      item.className = "favorite-item";

      const title = document.createElement("div");
      title.className = "favorite-line";
      title.textContent = String(row.title || "Untitled Compare");

      const words = document.createElement("div");
      words.className = "favorite-line";
      const wordList = Array.isArray(row.words) ? row.words.join(" / ") : "";
      words.textContent = `Words: ${wordList}`;

      const time = document.createElement("div");
      time.className = "favorite-time";
      time.textContent = formatFavoriteTime(row.createdAt);

      const actions = document.createElement("div");
      actions.className = "favorite-actions";

      const openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.className = "search-item-tag-btn";
      openBtn.textContent = "Open";
      openBtn.addEventListener("click", async () => {
        await openCompareFavoriteDetail(row);
      });

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "search-item-tag-btn";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", async () => {
        await removeCompareFavoriteById(row.id);
        await renderCompareFavoritesPanel();
      });

      actions.appendChild(openBtn);
      actions.appendChild(removeBtn);

      const metaRow = document.createElement("div");
      metaRow.className = "favorite-meta-row";
      metaRow.appendChild(time);
      metaRow.appendChild(actions);

      item.appendChild(title);
      item.appendChild(words);
      item.appendChild(metaRow);
      compareFavoritesListEl.appendChild(item);
    }
  } catch (err) {
    compareFavoritesMetaEl.textContent = "Load failed";
    const failed = document.createElement("div");
    failed.className = "empty-text";
    failed.textContent = String(err?.message || err || "Unknown error");
    compareFavoritesListEl.appendChild(failed);
  }
}

function setCompareFavoritesVisible(visible) {
  if (!compareFavoritesPanelEl) return;
  compareFavoritesPanelEl.classList.toggle("is-hidden", !visible);
  if (visible) {
    renderCompareFavoritesPanel();
  }
}

function buildSynonymFavoriteTitle(result) {
  const base = String(result?.word || "").trim();
  if (!base) return "Synonym Set";
  return `${base} - Synonyms`;
}

async function favoriteSynonymResult(result) {
  const word = String(result?.word || "").trim();
  const synonyms = Array.isArray(result?.synonyms) ? result.synonyms : [];
  if (!word || !synonyms.length) {
    throw new Error("No synonym result to favorite");
  }

  await addSynonymFavorite({
    title: buildSynonymFavoriteTitle(result),
    word,
    result,
  });

  if (synonymFavoritesPanelEl && !synonymFavoritesPanelEl.classList.contains("is-hidden")) {
    await renderSynonymFavoritesPanel();
  }
}

async function openSynonymFavoriteDetail(row) {
  if (!row?.result || typeof row.result !== "object") {
    throw new Error("Invalid synonym favorite payload");
  }

  if (detailModalTitleEl) {
    detailModalTitleEl.textContent = row.title || "Synonym Detail";
  }
  if (detailModalEl) {
    detailModalEl.classList.remove("is-hidden");
  }
  if (!detailModalBodyEl) return;

  detailModalBodyEl.innerHTML = "";
  detailModalBodyEl.appendChild(renderSynonymResultPanel(row.result));
}

async function renderSynonymFavoritesPanel() {
  if (!synonymFavoritesListEl || !synonymFavoritesMetaEl) return;

  synonymFavoritesListEl.innerHTML = "";

  try {
    const rows = await listSynonymFavorites();
    synonymFavoritesMetaEl.textContent = `${rows.length} item(s)`;

    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "empty-text";
      empty.textContent = "No synonym favorites yet";
      synonymFavoritesListEl.appendChild(empty);
      return;
    }

    for (const row of rows) {
      const item = document.createElement("div");
      item.className = "favorite-item";

      const title = document.createElement("div");
      title.className = "favorite-line";
      title.textContent = String(row.title || "Synonym Set");

      const wordLine = document.createElement("div");
      wordLine.className = "favorite-line";
      wordLine.textContent = `Word: ${String(row.word || "")}`;

      const time = document.createElement("div");
      time.className = "favorite-time";
      time.textContent = formatFavoriteTime(row.createdAt);

      const actions = document.createElement("div");
      actions.className = "favorite-actions";

      const openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.className = "search-item-tag-btn";
      openBtn.textContent = "Open";
      openBtn.addEventListener("click", async () => {
        await openSynonymFavoriteDetail(row);
      });

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "search-item-tag-btn";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", async () => {
        await removeSynonymFavoriteById(row.id);
        await renderSynonymFavoritesPanel();
      });

      actions.appendChild(openBtn);
      actions.appendChild(removeBtn);

      const metaRow = document.createElement("div");
      metaRow.className = "favorite-meta-row";
      metaRow.appendChild(time);
      metaRow.appendChild(actions);

      item.appendChild(title);
      item.appendChild(wordLine);
      item.appendChild(metaRow);
      synonymFavoritesListEl.appendChild(item);
    }
  } catch (err) {
    synonymFavoritesMetaEl.textContent = "Load failed";
    const failed = document.createElement("div");
    failed.className = "empty-text";
    failed.textContent = String(err?.message || err || "Unknown error");
    synonymFavoritesListEl.appendChild(failed);
  }
}

function setSynonymFavoritesVisible(visible) {
  if (!synonymFavoritesPanelEl) return;
  synonymFavoritesPanelEl.classList.toggle("is-hidden", !visible);
  if (visible) {
    renderSynonymFavoritesPanel();
  }
}

async function favoriteCurrentSentence() {
  if (mode !== "sentence") {
    markResult(false, "Only sentence mode supports favorites.");
    return;
  }

  if (!currentSentenceTask?.zhPrompt) {
    markResult(false, "No sentence is ready to favorite yet.");
    return;
  }

  const enText = String(answerInputEl.value || "").trim();
  if (!enText) {
    markResult(false, "请先输入英文翻译，再收藏句子。\n参考答案: 暂无");
    return;
  }

  try {
    await addSentenceFavorite({
      zhText: currentSentenceTask.zhPrompt,
      enText,
    });
    resultEl.textContent = "Saved";
    resultEl.className = "result info";
    correctAnswerEl.textContent = `Saved sentence\nZH: ${currentSentenceTask.zhPrompt}\nEN: ${enText}`;
    if (!favoritesPanelEl?.classList.contains("is-hidden")) {
      renderFavoritesPanel();
    }
  } catch (err) {
    markResult(false, `收藏失败: ${String(err?.message || err || "Unknown error")}`);
  }
}

function tokenizeEnglish(text) {
  return normalizeEnglish(text)
    .split(/\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function containsTargetWord(answer, target) {
  const answerTokens = new Set(tokenizeEnglish(answer));
  const targetTokens = tokenizeEnglish(target).filter((x) => x.length >= 2);
  if (!targetTokens.length) return false;
  return targetTokens.every((token) => answerTokens.has(token));
}

async function evaluateSentenceAnswerByModel(input, item, task, options = {}) {
  if (!window.electronAI?.evaluateSentence) {
    throw new Error("AI sentence evaluation is unavailable.");
  }

  try {
    const payload = {
      zhPrompt: task.zhPrompt,
      targetWord: item.en,
      referenceEn: task.referenceEn,
      userAnswer: input,
      requestId: String(options?.requestId || "").trim(),
    };

    const result = await dedupeAiRequest(
      "evaluateSentence",
      payload,
      () => window.electronAI.evaluateSentence(payload)
    );

    if (!result || typeof result !== "object") {
      throw new Error("Invalid response from sentence evaluation API.");
    }

    if (result.parseFailed) {
      throw new Error("Sentence evaluation response format is invalid.");
    }

    const ok = Boolean(result.ok);
    const feedback = String(result.feedback || "").trim();
    const betterSentence = String(result.betterSentence || "").trim();
    const score = Number(result.score || 0);
    const model = String(result.model || "");

    const parts = [];
    const directAnswer = betterSentence || task.referenceEn;
    if (feedback) parts.push(`问题分析: ${feedback}`);
    if (directAnswer) parts.push(`参考答案: ${directAnswer}`);
    if (Number.isFinite(score)) parts.push(`评分: ${Math.max(0, Math.min(100, Math.round(score)))}`);
    if (model) parts.push(`模型: ${model}`);

    return {
      ok,
      detail: parts.join(" | ") || `参考答案: ${task.referenceEn}`,
      source: "model",
    };
  } catch (err) {
    throw new Error(String(err?.message || "Sentence evaluation failed"));
  }
}

function setExamplesContent(lines, title = "Examples") {
  if (!examplesBoxEl) return;
  examplesBoxEl.innerHTML = "";

  const t = document.createElement("div");
  t.className = "example-title";
  t.textContent = title;
  examplesBoxEl.appendChild(t);

  for (const line of lines) {
    const row = document.createElement("div");
    row.className = "example-line";
    row.textContent = line;
    examplesBoxEl.appendChild(row);
  }
}

function renderExamplesWithFavorite(wordItem, payload, title = "Examples") {
  if (!examplesBoxEl) return;
  examplesBoxEl.innerHTML = "";

  const t = document.createElement("div");
  t.className = "example-title";
  t.textContent = title;
  examplesBoxEl.appendChild(t);

  const phonetic = String(payload?.phonetic || "").trim();
  const definitions = Array.isArray(payload?.definitions) ? payload.definitions : [];
  const examples = Array.isArray(payload?.examples) ? payload.examples : [];

  const phoneticRow = document.createElement("div");
  phoneticRow.className = "example-line";
  phoneticRow.textContent = `Phonetic: ${phonetic || "(not provided)"}`;
  examplesBoxEl.appendChild(phoneticRow);

  const defTitle = document.createElement("div");
  defTitle.className = "example-line";
  defTitle.textContent = "English Meaning:";
  examplesBoxEl.appendChild(defTitle);

  for (let i = 0; i < definitions.length; i += 1) {
    const row = definitions[i] || {};
    const pos = String(row?.pos || "").trim();
    const defText = String(row?.def || "").trim();
    if (!defText) continue;
    const line = document.createElement("div");
    line.className = "example-line";
    line.textContent = `${i + 1}. ${pos ? `${pos}: ` : ""}${defText}`;
    examplesBoxEl.appendChild(line);
  }

  const exTitle = document.createElement("div");
  exTitle.className = "example-line";
  exTitle.textContent = "Examples:";
  examplesBoxEl.appendChild(exTitle);

  const fallbackZh = `词义: ${extractMeaningCore(wordItem?.zh || "") || String(wordItem?.zh || "").trim() || "Example sentence"}`;
  for (let i = 0; i < examples.length; i += 1) {
    const enText = String(examples[i] || "").trim();
    if (!enText) continue;

    const row = document.createElement("div");
    row.className = "example-favorite-row";

    const sentence = document.createElement("div");
    sentence.className = "example-line";
    sentence.textContent = `${i + 1}. ${enText}`;

    const favBtn = document.createElement("button");
    favBtn.type = "button";
    favBtn.className = "search-item-tag-btn";
    favBtn.textContent = "Favorite";
    favBtn.addEventListener("click", async () => {
      try {
        await onFavoriteExample({ zhText: fallbackZh, enText });
        favBtn.textContent = "Saved";
        favBtn.disabled = true;
      } catch (err) {
        favBtn.textContent = "Failed";
        favBtn.title = String(err?.message || "Favorite failed");
      }
    });

    row.appendChild(sentence);
    row.appendChild(favBtn);
    examplesBoxEl.appendChild(row);
  }
}

function resetExamplesHint() {
  setExamplesContent(["Click \"Get Examples\" to view examples for the current word."], "Examples");
}

function normalizeLookupWord(en) {
  const raw = String(en || "").trim();
  if (!raw) return "";
  return raw
    .replace(/^to\s+/i, "")
    .split(/\s+/)[0]
    .replace(/[^a-zA-Z'-]/g, "");
}

function isSentenceExample(text) {
  const cleaned = String(text || "").trim();
  if (!cleaned) return false;
  const wordCount = tokenizeEnglish(cleaned).length;
  // Filter out phrase-like examples such as 1-3 word fragments.
  return wordCount >= 4;
}

async function fetchExamplesFromDictionary(word) {
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
  const resp = await fetch(url, { method: "GET" });
  if (!resp.ok) {
    throw new Error(`dictionary api ${resp.status}`);
  }

  const data = await resp.json();
  if (!Array.isArray(data)) {
    throw new Error("Dictionary response is invalid");
  }

  const first = data[0] || {};
  const phonetic = String(first?.phonetic || first?.phonetics?.[0]?.text || "").trim();

  const found = [];
  const seen = new Set();
  const definitions = [];
  const seenDef = new Set();
  for (const entry of data) {
    const meanings = Array.isArray(entry?.meanings) ? entry.meanings : [];
    for (const meaning of meanings) {
      const pos = String(meaning?.partOfSpeech || "").trim();
      const defs = Array.isArray(meaning?.definitions) ? meaning.definitions : [];

      for (const d of defs) {
        const defText = String(d?.definition || "").trim();
        if (!defText) continue;
        const defKey = `${pos}|${defText.toLowerCase()}`;
        if (seenDef.has(defKey)) continue;
        seenDef.add(defKey);
        definitions.push({ pos, def: defText });
        if (definitions.length >= 8) break;
      }

      for (const d of defs) {
        const ex = String(d?.example || "").trim();
        if (!ex) continue;
        if (!isSentenceExample(ex)) continue;
        const key = ex.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        found.push(ex);
        if (found.length >= 3) {
          return found;
        }
      }
    }
  }
  if (!found.length) {
    throw new Error("No dictionary examples found for this word");
  }

  if (!definitions.length) {
    throw new Error("No dictionary definitions found for this word");
  }

  return {
    phonetic,
    definitions,
    examples: found,
  };
}

function buildExamplesDisplayLines(payload) {
  const lines = [];
  const phonetic = String(payload?.phonetic || "").trim();
  const definitions = Array.isArray(payload?.definitions) ? payload.definitions : [];
  const examples = Array.isArray(payload?.examples) ? payload.examples : [];

  lines.push(`Phonetic: ${phonetic || "(not provided)"}`);
  lines.push("English Meaning:");
  for (let i = 0; i < definitions.length; i += 1) {
    const row = definitions[i];
    const pos = String(row?.pos || "").trim();
    const defText = String(row?.def || "").trim();
    if (!defText) continue;
    lines.push(`${i + 1}. ${pos ? `${pos}: ` : ""}${defText}`);
  }

  lines.push("Examples:");
  for (let i = 0; i < examples.length; i += 1) {
    lines.push(`${i + 1}. ${examples[i]}`);
  }

  return lines;
}

async function generateExamplesByModel(wordItem, options = {}) {
  if (!window.electronAI?.generateExamples) {
    throw new Error("AI example generation is unavailable");
  }

  const word = String(wordItem?.en || "").trim();
  if (!word) {
    throw new Error("Invalid word for AI example generation");
  }

  const requestPayload = {
    word,
    knownMeaning: String(wordItem?.zh || "").trim(),
    requestId: String(options?.requestId || "").trim(),
  };

  const payload = await dedupeAiRequest(
    "generateExamples",
    requestPayload,
    () => window.electronAI.generateExamples(requestPayload)
  );

  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid AI examples payload");
  }

  const definitions = Array.isArray(payload.definitions)
    ? payload.definitions
      .map((x) => ({
        pos: String(x?.pos || "").trim(),
        def: String(x?.def || "").trim(),
      }))
      .filter((x) => x.def)
      .slice(0, 8)
    : [];

  const examples = Array.isArray(payload.examples)
    ? payload.examples
      .map((x) => String(x || "").trim())
      .filter((x) => isSentenceExample(x))
      .slice(0, 3)
    : [];

  if (!definitions.length) {
    throw new Error("AI examples missing definitions");
  }
  if (!examples.length) {
    throw new Error("AI examples missing valid sentences");
  }

  return {
    phonetic: String(payload.phonetic || "").trim(),
    definitions,
    examples,
  };
}

async function showExamplesForCurrentWord() {
  const item = currentWord();
  if (!item) {
    setExamplesContent(["Error: No available word right now."], "Examples");
    return;
  }

  const cacheKey = String(item.id);
  if (exampleCache.has(cacheKey)) {
    const cached = exampleCache.get(cacheKey);
    renderExamplesWithFavorite(item, cached, `Examples - ${item.en}`);
    return;
  }

  setExamplesContent(["Loading examples..."], `Examples - ${item.en}`);

  const lookup = normalizeLookupWord(item.en);
  if (!lookup) {
    setExamplesContent(["Error: Invalid lookup word."], `Examples - ${item.en}`);
    return;
  }

  const expectedPayload = {
    word: String(item?.en || "").trim(),
    knownMeaning: String(item?.zh || "").trim(),
  };
  const reusedRequestId = getAiInFlightRequestId("generateExamples", expectedPayload);
  const aiRequestId = reusedRequestId || nextAiRequestId("examples");
  let tick = null;
  try {
    tick = setInterval(() => {
      renderThinkingPreviewInElement(examplesBoxEl, `Examples - ${item.en} (AI)`, aiStreamTextByRequestId.get(aiRequestId) || "");
    }, 180);
    const aiPayload = await generateExamplesByModel(item, { requestId: aiRequestId });
    if (tick) clearInterval(tick);
    aiStreamTextByRequestId.delete(aiRequestId);
    clearThinkingPreviewInElement(examplesBoxEl);
    exampleCache.set(cacheKey, aiPayload);
    renderExamplesWithFavorite(item, aiPayload, `Examples - ${item.en} (AI)`);
  } catch (aiErr) {
    if (tick) clearInterval(tick);
    aiStreamTextByRequestId.delete(aiRequestId);
    clearThinkingPreviewInElement(examplesBoxEl);
    const aiError = String(aiErr?.message || "AI generation failed");
    setExamplesContent([
      `Error: AI generation failed (${aiError})`,
    ], `Examples - ${item.en}`);
  }
}

async function showSynonymsForCurrentWord() {
  const item = currentWord();
  if (!item) {
    resultEl.textContent = "No available word right now.";
    resultEl.className = "result bad";
    return;
  }

  await runSynonymAnalysis(item);
}

function hideSuggest() {
  if (!searchSuggestEl) return;
  searchSuggestEl.innerHTML = "";
  searchSuggestEl.classList.add("is-hidden");
}

function buildSuggestItems(query) {
  if (typeof searchUtils.buildSuggestItems === "function") {
    return searchUtils.buildSuggestItems({
      query,
      words,
      tags: allTagCatalog(),
      truncateText,
      toTagKey,
    });
  }
  return [];
}

function applyTagFilter(tag, replace = false) {
  const key = toTagKey(tag);
  if (!key) return;
  if (replace) {
    selectedFilterTags = new Set([key]);
  } else {
    selectedFilterTags.add(key);
  }
}

function renderSuggestList() {
  if (!searchSuggestEl) return;
  const q = currentSearchKeyword();
  if (!q) {
    hideSuggest();
    return;
  }

  const items = buildSuggestItems(q);
  if (!items.length) {
    hideSuggest();
    return;
  }

  searchSuggestEl.innerHTML = "";
  for (const item of items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "suggest-item";

    const top = document.createElement("div");
    top.className = "suggest-top";
    top.textContent = item.label;

    const sub = document.createElement("div");
    sub.className = "suggest-sub";
    sub.textContent = item.sub;

    btn.appendChild(top);
    btn.appendChild(sub);
    btn.addEventListener("click", () => {
      if (item.type === "tag") {
        // Choosing a tag from suggestions should list all words under that tag.
        applyTagFilter(item.value, true);
        searchInputEl.value = "";
        renderFilterTags();
      } else {
        searchInputEl.value = item.value;
      }
      hideSuggest();
      onSearchOrFilterChanged();
    });

    searchSuggestEl.appendChild(btn);
  }

  searchSuggestEl.classList.remove("is-hidden");
}

function scheduleSuggestRender() {
  if (suggestTimer) {
    clearTimeout(suggestTimer);
  }
  suggestTimer = setTimeout(() => {
    renderSuggestList();
  }, 120);
}

function wordMatchesFilters(word) {
  const q = currentSearchKeyword();
  if (q) {
    const tagHit = getWordTags(word.id).some((tag) => tag.toLowerCase().includes(q));
    const hit =
      word.en.toLowerCase().includes(q) ||
      word.zh.toLowerCase().includes(q) ||
      tagHit;
    if (!hit) return false;
  }

  if (selectedFilterTags.size === 0) return true;

  const tagKeys = new Set(getWordTags(word.id).map((t) => toTagKey(t)));
  for (const tagKey of selectedFilterTags) {
    if (tagKeys.has(tagKey)) return true;
  }

  return false;
}

function renderManagerPanel() {
  if (!managerWordListEl || !managerMetaEl) return;

  for (const btn of managerFilterButtons) {
    const key = btn.dataset.statusFilter;
    btn.classList.toggle("active", key === managerStatusFilter);
  }

  const list = words.filter((w) => managerMatchesWord(w));
  if (managerLearningSortWrapEl) {
    managerLearningSortWrapEl.classList.toggle("is-hidden", managerStatusFilter !== "learning");
  }
  if (managerStatusFilter === "learning") {
    list.sort((a, b) => {
      const ra = getProgress(a.id);
      const rb = getProgress(b.id);

      if (managerLearningSort === "curve") {
        const sa = Number(ra.stage || 0);
        const sb = Number(rb.stage || 0);
        if (sa !== sb) return sa - sb;
        const ta = Number(ra.lastReviewedAt || 0);
        const tb = Number(rb.lastReviewedAt || 0);
        return tb - ta;
      }

      const ta = Number(ra.lastReviewedAt || 0);
      const tb = Number(rb.lastReviewedAt || 0);
      if (ta !== tb) return tb - ta;
      const sa = Number(ra.stage || 0);
      const sb = Number(rb.stage || 0);
      return sa - sb;
    });
  }
  managerMetaEl.textContent = `${list.length} items`;
  managerWordListEl.innerHTML = "";

  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "empty-text";
    empty.textContent = "No items";
    managerWordListEl.appendChild(empty);
    return;
  }

  const maxRender = 200;
  for (const word of list.slice(0, maxRender)) {
    const record = getProgress(word.id);
    const row = document.createElement("div");
    row.className = "manager-word-item";

    const top = document.createElement("div");
    top.className = "manager-word-top";

    const en = document.createElement("div");
    en.className = "manager-word-en";
    en.textContent = word.en;

    const st = document.createElement("span");
    st.className = "manager-word-status";
    st.textContent = statusLabel(getWordStatus(word.id));

    top.appendChild(en);
    top.appendChild(st);

    const zh = document.createElement("div");
    zh.className = "manager-word-zh";
    zh.textContent = truncateText(word.zh, 90);

    const actions = document.createElement("div");
    actions.className = "manager-word-actions";

    const statusOptions = [
      ["new", "Set Not Studied"],
      ["learning", "Set Studying"],
      ["mastered", "Set Mastered"],
    ];

    for (const [status, label] of statusOptions) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "search-item-tag-btn";
      btn.textContent = label;
      btn.addEventListener("click", async () => {
        await setWordStatus(word.id, status);
        updateStatusCounts();
        renderManagerPanel();
        renderSearchResults();
      });
      actions.appendChild(btn);
    }

    if (record.status === "learning") {
      const resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.className = "search-item-tag-btn";
      resetBtn.textContent = "Reset Curve";
      resetBtn.addEventListener("click", async () => {
        await resetLearningCurve(word.id);
        updateStatusCounts();
        renderManagerPanel();
        renderSearchResults();
      });
      actions.appendChild(resetBtn);

      const curve = document.createElement("div");
      curve.className = "manager-word-curve-inline";
      curve.textContent = getCurveStageText(record);
      actions.appendChild(curve);
    }

    row.appendChild(top);
    row.appendChild(zh);
    row.appendChild(actions);
    managerWordListEl.appendChild(row);
  }
}

function setManagerVisible(visible) {
  if (!managerPanelEl) return;
  managerPanelEl.classList.toggle("is-hidden", !visible);
  if (visible) {
    renderManagerPanel();
  }
}

function renderTagList(container, tags, selectedTagSet, removable, onClick, onRemove) {
  container.innerHTML = "";

  if (!tags.length) {
    const span = document.createElement("span");
    span.className = "empty-text";
    span.textContent = "None";
    container.appendChild(span);
    return;
  }

  for (const tag of tags) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tag-chip";
    if (selectedTagSet && selectedTagSet.has(toTagKey(tag))) {
      btn.classList.add("active");
    }
    btn.textContent = tag;
    if (onClick) {
      btn.addEventListener("click", () => onClick(tag));
    }

    if (removable) {
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "remove-tag";
      rm.textContent = "x";
      rm.addEventListener("click", (e) => {
        e.stopPropagation();
        onRemove(tag);
      });
      btn.appendChild(rm);
    }

    container.appendChild(btn);
  }
}

function allTagCatalog() {
  const seen = new Set();
  const tags = [];

  for (const record of progressById.values()) {
    const currentTags = Array.isArray(record.tags) ? record.tags : [];
    for (const tag of currentTags) {
      const display = normalizeTagText(tag);
      const key = toTagKey(display);
      if (!display || seen.has(key)) continue;
      seen.add(key);
      tags.push(display);
    }
  }

  tags.sort((a, b) => a.localeCompare(b, "zh-CN"));
  return tags;
}

function renderFilterTags() {
  const tags = allTagCatalog();
  renderTagList(
    filterTagsEl,
    tags,
    selectedFilterTags,
    false,
    (tag) => {
      const key = toTagKey(tag);
      if (selectedFilterTags.has(key)) {
        selectedFilterTags.delete(key);
      } else {
        selectedFilterTags.add(key);
      }
      onSearchOrFilterChanged();
      renderFilterTags();
    },
    null
  );
}

function setQuizVisible(visible) {
  if (!quizPanelEl) return;
  quizVisible = Boolean(visible);
  const shouldShowQuiz = activeMainTab === "study" && (quizVisible || isHiddenMode);
  if (shouldShowQuiz) {
    quizPanelEl.classList.remove("is-hidden");
  } else {
    quizPanelEl.classList.add("is-hidden");
  }
}

function syncStatusPanelVisibility() {
  if (!statusPanelEl) return;
  const shouldShow = activeMainTab === "manager";
  statusPanelEl.classList.toggle("is-hidden", !shouldShow);
}

function setMainTab(tab) {
  activeMainTab = tab;
  document.body.classList.toggle("study-tab-active", tab === "study");

  if (tabStudyBtn) {
    tabStudyBtn.classList.toggle("active", tab === "study");
  }
  if (tabManagerBtn) {
    tabManagerBtn.classList.toggle("active", tab === "manager");
  }
  if (tabFavoritesBtn) {
    tabFavoritesBtn.classList.toggle("active", tab === "favorites");
  }
  if (tabCompareFavoritesBtn) {
    tabCompareFavoritesBtn.classList.toggle("active", tab === "compareFavorites");
  }
  if (tabSynonymFavoritesBtn) {
    tabSynonymFavoritesBtn.classList.toggle("active", tab === "synonymFavorites");
  }

  const isStudyTab = tab === "study";

  if (studyControlsPanelEl) {
    studyControlsPanelEl.classList.toggle("is-hidden", !isStudyTab);
  }
  if (filterPanelEl) {
    filterPanelEl.classList.toggle("is-hidden", !isStudyTab);
  }

  setManagerVisible(tab === "manager");
  setFavoritesVisible(tab === "favorites");
  setCompareFavoritesVisible(tab === "compareFavorites");
  setSynonymFavoritesVisible(tab === "synonymFavorites");
  syncStatusPanelVisibility();
  applyHiddenModeUI();
  setQuizVisible(quizVisible);
  syncSearchResultsHeight();
}

function applyHiddenModeUI() {
  document.body.classList.toggle("hidden-mode", isHiddenMode);
  if (hiddenModeBtn) {
    hiddenModeBtn.textContent = isHiddenMode ? "Exit Hidden Mode" : "Hidden Mode";
  }
  if (exitHiddenModeBtn) {
    const shouldShowExit = isHiddenMode && activeMainTab === "study";
    exitHiddenModeBtn.classList.toggle("is-hidden", !shouldShowExit);
  }
}

function syncStudyActionButtons() {
  const isStudyRunning = currentSessionType === "study";
  const isReviewRunning = currentSessionType === "review";
  const isQuizRunning = currentSessionType === "quiz";
  const hasActiveSession = isStudyRunning || isReviewRunning || isQuizRunning;

  if (startStudyBtn) {
    startStudyBtn.textContent = isStudyRunning ? "Stop" : "New Study";
    startStudyBtn.disabled = false;
  }

  if (startReviewBtn) {
    startReviewBtn.textContent = isReviewRunning ? "Stop" : "Review";
    startReviewBtn.disabled = false;
  }

  if (startQuizBtn) {
    startQuizBtn.textContent = isQuizRunning ? "Stop" : "Quiz";
    startQuizBtn.disabled = false;
  }

  if (hiddenModeBtn) {
    hiddenModeBtn.disabled = !hasActiveSession;
  }

  if (!hasActiveSession && isHiddenMode) {
    setHiddenMode(false);
  }
}

function applyHiddenModeWindowSize(enabled) {
  if (enabled) {
    if (!normalWindowSize) {
      normalWindowSize = {
        width: window.outerWidth,
        height: window.outerHeight,
      };
    }
    try {
      window.resizeTo(550, 530);
    } catch {
      // Ignore when resize APIs are restricted.
    }
    return;
  }

  if (!normalWindowSize) return;
  try {
    window.resizeTo(normalWindowSize.width, normalWindowSize.height);
  } catch {
    // Ignore when resize APIs are restricted.
  }
  normalWindowSize = null;
}

function setHiddenMode(enabled) {
  isHiddenMode = Boolean(enabled);
  applyHiddenModeWindowSize(isHiddenMode);
  applyHiddenModeUI();
  setQuizVisible(quizVisible);
  syncSearchResultsHeight();
  syncStudyActionButtons();
}

function toggleHiddenMode() {
  setHiddenMode(!isHiddenMode);
}

function setSearchResultsCollapsed(collapsed) {
  if (!searchResultsEl) return;
  searchResultsEl.classList.toggle("collapsed", Boolean(collapsed));
  if (collapsed) {
    searchResultsEl.style.removeProperty("height");
    searchResultsEl.style.removeProperty("maxHeight");
  }
}

function syncSearchResultsHeight() {
  if (!searchResultsEl || !filterPanelEl) return;
  if (searchResultsEl.classList.contains("collapsed")) return;
  if (activeMainTab !== "study") return;
  if (filterPanelEl.classList.contains("is-hidden")) return;

  const rect = searchResultsEl.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const panelStyle = window.getComputedStyle(filterPanelEl);
  const appStyle = appShellEl ? window.getComputedStyle(appShellEl) : null;
  const panelPaddingBottom = Number.parseFloat(panelStyle.paddingBottom || "0") || 0;
  const panelMarginBottom = Number.parseFloat(panelStyle.marginBottom || "0") || 0;
  const appPaddingBottom = appStyle ? (Number.parseFloat(appStyle.paddingBottom || "0") || 0) : 0;
  // Leave extra buffer to avoid viewport edge jitter that can show page scrollbar on input focus.
  const bottomGap = panelPaddingBottom + panelMarginBottom + appPaddingBottom + 20;
  const available = Math.floor(viewportHeight - rect.top - bottomGap);
  const maxScrollable = window.innerWidth <= 860 ? 360 : 520;
  const nextMaxHeight = Math.max(140, Math.min(maxScrollable, available));

  searchResultsEl.style.removeProperty("height");
  searchResultsEl.style.maxHeight = `${nextMaxHeight}px`;
}

function truncateText(text, maxLen) {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}...`;
}

function openWordFromSearch(word) {
  queue = [word];
  currentIndex = 0;
  currentSessionType = "none";
  answeredThisRound = false;
  resultEl.textContent = "";
  resultEl.className = "result";
  correctAnswerEl.textContent = "";
  updateStatusCounts();
  setQuizVisible(true);
  renderQuestion();
}

function openSearchTagEditor(wordId) {
  activeSearchTagEditorWordId = wordId;
  renderSearchResults();
}

function closeSearchTagEditor() {
  activeSearchTagEditorWordId = null;
  renderSearchResults();
}

async function addTagToWord(wordId, rawTag) {
  const tag = normalizeTagText(rawTag || "");
  if (!tag) return false;

  const record = getProgress(wordId);
  const tags = Array.isArray(record.tags) ? record.tags.slice() : [];
  const key = toTagKey(tag);
  const exists = tags.some((t) => toTagKey(t) === key);

  if (!exists) {
    tags.push(tag);
    await setProgress({ ...record, tags });
  }

  return !exists;
}

async function removeTagFromWord(wordId, tag) {
  const removeKey = toTagKey(tag);
  const record = getProgress(wordId);
  const tags = (Array.isArray(record.tags) ? record.tags : []).filter((t) => toTagKey(t) !== removeKey);

  await setProgress({ ...record, tags });

  if (selectedFilterTags.has(removeKey)) {
    selectedFilterTags.delete(removeKey);
  }
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function fetchWordDetailsFromDictionary(word) {
  const lookup = normalizeLookupWord(word?.en || "");
  if (!lookup) {
    throw new Error("Invalid word for dictionary lookup");
  }

  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(lookup)}`;
  const resp = await fetch(url, { method: "GET" });
  if (!resp.ok) {
    throw new Error(`dictionary api ${resp.status}`);
  }

  const data = await resp.json();
  if (!Array.isArray(data) || !data.length) {
    throw new Error("No dictionary result");
  }

  const first = data[0] || {};
  const meanings = [];
  const examplesByPos = [];
  const seenMeaning = new Set();

  for (const entry of data) {
    const entryMeanings = Array.isArray(entry?.meanings) ? entry.meanings : [];
    for (const meaning of entryMeanings) {
      const pos = String(meaning?.partOfSpeech || "unknown").trim();
      const defs = Array.isArray(meaning?.definitions) ? meaning.definitions : [];

      for (const d of defs.slice(0, 2)) {
        const defText = String(d?.definition || "").trim();
        if (!defText) continue;
        const key = `${pos}|${defText.toLowerCase()}`;
        if (seenMeaning.has(key)) continue;
        seenMeaning.add(key);
        meanings.push({ pos, zh: defText });
      }

      const examples = [];
      const seenEx = new Set();
      for (const d of defs) {
        const ex = String(d?.example || "").trim();
        if (!ex) continue;
        if (!isSentenceExample(ex)) continue;
        const key = ex.toLowerCase();
        if (seenEx.has(key)) continue;
        seenEx.add(key);
        examples.push({
          en: ex,
          zh: "",
        });
        if (examples.length >= 3) break;
      }

      if (examples.length) {
        examplesByPos.push({ pos, examples });
      }
    }
  }

  if (!meanings.length) {
    meanings.push({
      pos: "base",
      zh: String(word?.zh || "").trim() || "No meaning from dictionary",
    });
  }

  return {
    word: String(first.word || word?.en || "").trim(),
    phonetic: String(first.phonetic || first?.phonetics?.[0]?.text || "").trim(),
    meanings,
    examplesByPos,
    source: "dictionaryapi.dev",
  };
}

async function toggleSearchWordDetail(word) {
  activeDetailWordId = word.id;
  if (detailModalTitleEl) {
    detailModalTitleEl.textContent = `Word Detail - ${word.en}`;
  }
  if (detailModalEl) {
    detailModalEl.classList.remove("is-hidden");
  }

  if (detailModalBodyEl) {
    detailModalBodyEl.innerHTML = "";
    const loading = document.createElement("div");
    loading.className = "search-word-detail";
    loading.textContent = "Loading details from API...";
    detailModalBodyEl.appendChild(loading);
  }

  if (!wordDetailCache.has(word.id) && !wordDetailLoadingSet.has(word.id)) {
    wordDetailLoadingSet.add(word.id);
    try {
      const detail = await fetchWordDetailsFromDictionary(word);
      wordDetailCache.set(word.id, detail);
    } catch (err) {
      wordDetailCache.set(word.id, {
        error: String(err?.message || "Failed to load details"),
      });
    } finally {
      wordDetailLoadingSet.delete(word.id);
    }
  }

  if (activeDetailWordId !== word.id || !detailModalBodyEl) {
    return;
  }

  detailModalBodyEl.innerHTML = "";
  detailModalBodyEl.appendChild(buildWordDetailPanel(word));
}

function closeWordDetailModal() {
  activeDetailWordId = null;
  if (detailModalEl) {
    detailModalEl.classList.add("is-hidden");
  }
}

function getCompareWords() {
  const list = [];
  for (const id of compareWordIds) {
    const w = findWordById(id);
    if (w) list.push(w);
  }
  return list;
}

function renderComparePanel() {
  if (!comparePanelEl || !compareListEl) return;

  const selected = getCompareWords();
  comparePanelEl.classList.toggle("is-hidden", selected.length === 0);
  compareListEl.innerHTML = "";

  for (const word of selected) {
    const chip = document.createElement("span");
    chip.className = "compare-chip";
    chip.textContent = word.en;

    const rm = document.createElement("button");
    rm.type = "button";
    rm.textContent = "x";
    rm.addEventListener("click", () => {
      compareWordIds.delete(word.id);
      renderComparePanel();
      renderSearchResults();
    });

    chip.appendChild(rm);
    compareListEl.appendChild(chip);
  }

  if (runCompareBtn) {
    runCompareBtn.disabled = selected.length < 2;
  }
}

function toggleCompareWord(word) {
  if (compareWordIds.has(word.id)) {
    compareWordIds.delete(word.id);
  } else {
    compareWordIds.add(word.id);
  }
  renderComparePanel();
  renderSearchResults();
}

function setModalTitleAndLoading(title, loadingText) {
  if (detailModalTitleEl) {
    detailModalTitleEl.textContent = title;
  }
  if (detailModalEl) {
    detailModalEl.classList.remove("is-hidden");
  }
  if (detailModalBodyEl) {
    updateModalStreamingText(loadingText, "");
  }
}

function nextAiRequestId(prefix) {
  aiRequestCounter += 1;
  return `${String(prefix || "ai")}-${Date.now()}-${aiRequestCounter}`;
}

function buildAiRequestSignature(action, payload) {
  const cleanPayload = { ...(payload || {}) };
  delete cleanPayload.requestId;
  return `${String(action || "ai")}::${JSON.stringify(cleanPayload)}`;
}

function getAiInFlightRequestId(action, payload) {
  const signature = buildAiRequestSignature(action, payload);
  const entry = aiInFlightBySignature.get(signature);
  return String(entry?.requestId || "").trim();
}

function dedupeAiRequest(action, payload, requester) {
  const signature = buildAiRequestSignature(action, payload);
  const existing = aiInFlightBySignature.get(signature);
  if (existing) {
    return existing.promise;
  }

  const entry = {
    requestId: String(payload?.requestId || "").trim(),
    promise: null,
  };

  const nextPromise = Promise.resolve()
    .then(() => requester())
    .finally(() => {
      if (aiInFlightBySignature.get(signature) === entry) {
        aiInFlightBySignature.delete(signature);
      }
    });

  entry.promise = nextPromise;
  aiInFlightBySignature.set(signature, entry);
  return nextPromise;
}

function updateModalStreamingText(baseText, streamText) {
  if (!detailModalBodyEl) return;
  const text = String(streamText || "").trim();
  const linePreview = text
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(-4)
    .join("\n");
  const preview = linePreview || (text ? text.slice(-260) : "");

  detailModalBodyEl.innerHTML = "";
  const loading = document.createElement("div");
  loading.className = "search-word-detail search-word-detail-thinking";

  const header = document.createElement("div");
  header.className = "loading-row";

  const spinnerEl = document.createElement("span");
  spinnerEl.className = "spinner";
  spinnerEl.setAttribute("aria-hidden", "true");
  header.appendChild(spinnerEl);

  const title = document.createElement("div");
  title.className = "search-word-detail-thinking-title";
  title.textContent = baseText;
  header.appendChild(title);
  loading.appendChild(header);

  const snippet = document.createElement("div");
  snippet.className = "search-word-detail-thinking-snippet";
  snippet.textContent = preview || "Thinking...";
  loading.appendChild(snippet);

  detailModalBodyEl.appendChild(loading);
}

function buildThinkingSnippetText(streamText) {
  const text = String(streamText || "").trim();
  if (!text) return "Thinking...";
  const linePreview = text
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(-4)
    .join("\n");
  return linePreview || text.slice(-260);
}

function renderThinkingPreviewInElement(hostEl, titleText, streamText) {
  if (!hostEl) return;
  hostEl.classList.add("thinking-preview-host");
  hostEl.innerHTML = "";

  const box = document.createElement("div");
  box.className = "thinking-preview-box";

  const header = document.createElement("div");
  header.className = "loading-row";

  const spinnerEl = document.createElement("span");
  spinnerEl.className = "spinner";
  spinnerEl.setAttribute("aria-hidden", "true");
  header.appendChild(spinnerEl);

  const title = document.createElement("div");
  title.className = "thinking-preview-title";
  title.textContent = String(titleText || "Thinking...");
  header.appendChild(title);
  box.appendChild(header);

  const snippet = document.createElement("div");
  snippet.className = "thinking-preview-snippet";
  snippet.textContent = buildThinkingSnippetText(streamText);
  box.appendChild(snippet);

  hostEl.appendChild(box);
}

function clearThinkingPreviewInElement(hostEl) {
  if (!hostEl) return;
  hostEl.classList.remove("thinking-preview-host");
}

function bindAiStreamListener() {
  if (!window.electronAI?.onStream) return;
  window.electronAI.onStream((evt) => {
    const requestId = String(evt?.requestId || "").trim();
    if (!requestId) return;
    const text = String(evt?.text || "");
    aiStreamTextByRequestId.set(requestId, text);
  });
}

async function renderAppVersionBadge() {
  if (!appVersionBadgeEl) return;
  try {
    const version = await window.electronApp?.getVersion?.();
    const text = String(version || "").trim();
    appVersionBadgeEl.textContent = text ? `v${text}` : "v--";
  } catch {
    appVersionBadgeEl.textContent = "v--";
  }
}

function onFavoriteExample(payload) {
  return addSentenceFavorite(payload).then(() => {
    if (!favoritesPanelEl?.classList.contains("is-hidden")) {
      return renderFavoritesPanel();
    }
    return null;
  });
}

function renderCompareResultPanel(result) {
  if (typeof detailPanels.renderCompareResultPanel === "function") {
    return detailPanels.renderCompareResultPanel(result, onFavoriteExample, favoriteCompareResult);
  }
  const panel = document.createElement("div");
  panel.className = "search-word-detail bad";
  panel.textContent = "Compare detail module is unavailable.";
  return panel;
}

function renderSynonymResultPanel(result) {
  if (typeof detailPanels.renderSynonymResultPanel === "function") {
    return detailPanels.renderSynonymResultPanel(result, onFavoriteExample, favoriteSynonymResult);
  }
  const panel = document.createElement("div");
  panel.className = "search-word-detail bad";
  panel.textContent = "Synonym detail module is unavailable.";
  return panel;
}

async function runCompareAnalysis() {
  const selected = getCompareWords();
  if (selected.length < 2) {
    return;
  }
  if (!window.electronAI?.compareWords) {
    setModalTitleAndLoading("Word Compare", "AI compare API is unavailable.");
    return;
  }

  const requestId = nextAiRequestId("compare");
  let tick = null;
  setModalTitleAndLoading("Word Compare", "Comparing selected words...");
  try {
    tick = setInterval(() => {
      updateModalStreamingText("Comparing selected words...", aiStreamTextByRequestId.get(requestId) || "");
    }, 180);
    const payload = {
      words: selected.map((w) => ({ word: w.en, meaning: w.zh })),
      requestId,
    };
    const result = await dedupeAiRequest(
      "compareWords",
      payload,
      () => window.electronAI.compareWords(payload)
    );
    clearInterval(tick);
    aiStreamTextByRequestId.delete(requestId);
    if (!detailModalBodyEl) return;
    detailModalBodyEl.innerHTML = "";
    detailModalBodyEl.appendChild(renderCompareResultPanel(result || {}));
  } catch (err) {
    if (tick) clearInterval(tick);
    aiStreamTextByRequestId.delete(requestId);
    if (!detailModalBodyEl) return;
    detailModalBodyEl.innerHTML = "";
    const bad = document.createElement("div");
    bad.className = "search-word-detail bad";
    bad.textContent = String(err?.message || "Compare failed");
    detailModalBodyEl.appendChild(bad);
  }
}

async function runSynonymAnalysis(word) {
  const requestId = nextAiRequestId("synonym");
  let tick = null;
  setModalTitleAndLoading(`Synonyms - ${word.en}`, "Generating synonym analysis...");

  if (!window.electronAI?.analyzeSynonyms) {
    if (!detailModalBodyEl) return;
    detailModalBodyEl.innerHTML = "";
    const bad = document.createElement("div");
    bad.className = "search-word-detail bad";
    bad.textContent = "AI synonym API is unavailable.";
    detailModalBodyEl.appendChild(bad);
    return;
  }

  try {
    tick = setInterval(() => {
      updateModalStreamingText("Generating synonym analysis...", aiStreamTextByRequestId.get(requestId) || "");
    }, 180);
    const payload = {
      word: word.en,
      knownMeaning: word.zh,
      requestId,
    };
    const result = await dedupeAiRequest(
      "analyzeSynonyms",
      payload,
      () => window.electronAI.analyzeSynonyms(payload)
    );
    clearInterval(tick);
    aiStreamTextByRequestId.delete(requestId);
    if (!detailModalBodyEl) return;
    detailModalBodyEl.innerHTML = "";
    detailModalBodyEl.appendChild(renderSynonymResultPanel(result || {}));
  } catch (err) {
    if (tick) clearInterval(tick);
    aiStreamTextByRequestId.delete(requestId);
    if (!detailModalBodyEl) return;
    detailModalBodyEl.innerHTML = "";
    const bad = document.createElement("div");
    bad.className = "search-word-detail bad";
    bad.textContent = String(err?.message || "Synonym analysis failed");
    detailModalBodyEl.appendChild(bad);
  }
}

function buildWordDetailPanel(word) {
  const panel = document.createElement("div");
  panel.className = "search-word-detail";

  if (wordDetailLoadingSet.has(word.id)) {
    panel.textContent = "Loading details from API...";
    return panel;
  }

  const detail = wordDetailCache.get(word.id);
  if (!detail) {
    panel.textContent = "Click Detail to load explanations and examples.";
    return panel;
  }

  if (detail.error) {
    panel.classList.add("bad");
    panel.textContent = detail.error;
    return panel;
  }

  const title = document.createElement("div");
  title.className = "search-word-detail-title";
  const phonetic = detail.phonetic ? ` /${escapeHtml(detail.phonetic)}/` : "";
  title.innerHTML = `${escapeHtml(word.en)}${phonetic}`;
  panel.appendChild(title);

  const translation = document.createElement("div");
  translation.className = "search-word-detail-translation";
  translation.textContent = `Base: ${word.zh}`;
  panel.appendChild(translation);

  const sourceLine = document.createElement("div");
  sourceLine.className = "search-word-detail-translation";
  sourceLine.textContent = `Source: ${detail.source || "dictionaryapi.dev"}`;
  panel.appendChild(sourceLine);

  if (Array.isArray(detail.meanings) && detail.meanings.length) {
    const mTitle = document.createElement("div");
    mTitle.className = "search-word-detail-subtitle";
    mTitle.textContent = "Detailed Meanings";
    panel.appendChild(mTitle);

    const ul = document.createElement("ul");
    ul.className = "search-word-detail-list";
    for (const m of detail.meanings) {
      const li = document.createElement("li");
      li.textContent = `${m.pos}: ${m.zh}`;
      ul.appendChild(li);
    }
    panel.appendChild(ul);
  }

  if (Array.isArray(detail.examplesByPos) && detail.examplesByPos.length) {
    const eTitle = document.createElement("div");
    eTitle.className = "search-word-detail-subtitle";
    eTitle.textContent = "Examples by POS (3 each)";
    panel.appendChild(eTitle);

    for (const group of detail.examplesByPos) {
      const block = document.createElement("div");
      block.className = "search-word-detail-pos";

      const h = document.createElement("div");
      h.className = "search-word-detail-pos-title";
      h.textContent = group.pos;
      block.appendChild(h);

      const list = document.createElement("ol");
      list.className = "search-word-detail-examples";
      for (const ex of group.examples || []) {
        const li = document.createElement("li");
        const en = document.createElement("div");
        en.className = "search-word-detail-en";
        en.textContent = ex.en;
        li.appendChild(en);
        if (ex.zh) {
          const zh = document.createElement("div");
          zh.className = "search-word-detail-zh";
          zh.textContent = ex.zh;
          li.appendChild(zh);
        }
        list.appendChild(li);
      }

      block.appendChild(list);
      panel.appendChild(block);
    }
  }

  return panel;
}

function buildAvailableTagsForWord(wordId) {
  const current = new Set(getWordTags(wordId).map((t) => toTagKey(t)));
  return allTagCatalog().filter((tag) => !current.has(toTagKey(tag)));
}

async function commitTagForWord(wordId, inputEl) {
  const value = inputEl.value;
  const added = await addTagToWord(wordId, value);
  if (added) {
    inputEl.value = "";
    renderFilterTags();
    renderSearchResults();
    updateStatusCounts();
  }
}

function buildSearchTagEditor(word) {
  const editor = document.createElement("div");
  editor.className = "search-tag-editor";

  const inputRow = document.createElement("div");
  inputRow.className = "search-tag-input-row";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "search-tag-input";
  input.placeholder = "Type a new tag or choose one below";

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "search-item-tag-btn";
  saveBtn.textContent = "Save";
  saveBtn.addEventListener("click", async () => {
    await commitTagForWord(word.id, input);
  });

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "search-item-tag-btn";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", closeSearchTagEditor);

  input.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      await commitTagForWord(word.id, input);
    }
    if (e.key === "Escape") {
      closeSearchTagEditor();
    }
  });

  inputRow.appendChild(input);
  inputRow.appendChild(saveBtn);
  inputRow.appendChild(cancelBtn);

  const existed = buildAvailableTagsForWord(word.id);
  const existedWrap = document.createElement("div");
  existedWrap.className = "search-tag-suggest-list";

  if (!existed.length) {
    const empty = document.createElement("span");
    empty.className = "search-item-tag-empty";
    empty.textContent = "No available tags";
    existedWrap.appendChild(empty);
  } else {
    for (const tag of existed.slice(0, 20)) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "search-item-tag";
      btn.textContent = tag;
      btn.addEventListener("click", async () => {
        await addTagToWord(word.id, tag);
        renderFilterTags();
        renderSearchResults();
        updateStatusCounts();
      });
      existedWrap.appendChild(btn);
    }
  }

  editor.appendChild(inputRow);
  editor.appendChild(existedWrap);
  return editor;
}

function renderSearchResults() {
  if (!searchResultsEl || !searchMetaEl) return;
  searchResultsEl.innerHTML = "";

  const keyword = currentSearchKeyword();
  const resultWords = words.filter((w) => wordMatchesFilters(w));
  if (filteredCountEl) {
    filteredCountEl.textContent = String(resultWords.length);
  }

  if (!keyword && selectedFilterTags.size === 0) {
    setSearchResultsCollapsed(true);
    searchMetaEl.textContent = "";
    return;
  }

  setSearchResultsCollapsed(false);

  if (!resultWords.length) {
    searchMetaEl.textContent = "No matching results";
    syncSearchResultsHeight();
    return;
  }

  const maxRender = 120;
  const renderWords = resultWords.slice(0, maxRender);
  searchMetaEl.textContent = `${resultWords.length} result(s), showing first ${renderWords.length}`;

  for (const word of renderWords) {
    const item = document.createElement("div");
    item.className = "search-item";

    const en = document.createElement("div");
    en.className = "search-item-en";
    en.textContent = word.en;

    const zh = document.createElement("div");
    zh.className = "search-item-zh";
    zh.textContent = truncateText(word.zh, 64);

    const footer = document.createElement("div");
    footer.className = "search-item-footer";

    const tagsBox = document.createElement("div");
    tagsBox.className = "search-item-tags";
    const tags = getWordTags(word.id);
    if (!tags.length) {
      const empty = document.createElement("span");
      empty.className = "search-item-tag-empty";
      empty.textContent = "No tags";
      tagsBox.appendChild(empty);
    } else {
      for (const tag of tags) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "search-item-tag removable";
        chip.textContent = tag;

        const rm = document.createElement("span");
        rm.className = "search-item-tag-remove";
        rm.textContent = "x";
        chip.appendChild(rm);

        chip.addEventListener("click", async (e) => {
          e.stopPropagation();
          await removeTagFromWord(word.id, tag);
          renderFilterTags();
          updateStatusCounts();
          renderSearchResults();
          if (!managerPanelEl?.classList.contains("is-hidden")) {
            renderManagerPanel();
          }
        });

        tagsBox.appendChild(chip);
      }
    }

    const actions = document.createElement("div");

    const addTagBtn = document.createElement("button");
    addTagBtn.type = "button";
    addTagBtn.className = "search-item-tag-btn";
    addTagBtn.textContent = "Add Tag";
    addTagBtn.addEventListener("click", () => {
      openSearchTagEditor(word.id);
    });

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "search-item-tag-btn";
    openBtn.textContent = "Detail";
    openBtn.addEventListener("click", async () => {
      await toggleSearchWordDetail(word);
    });

    const compareBtn = document.createElement("button");
    compareBtn.type = "button";
    compareBtn.className = "search-item-tag-btn";
    compareBtn.textContent = compareWordIds.has(word.id) ? "Cancel Compare" : "Add Compare";
    compareBtn.addEventListener("click", () => {
      toggleCompareWord(word);
    });

    const synonymBtn = document.createElement("button");
    synonymBtn.type = "button";
    synonymBtn.className = "search-item-tag-btn";
    synonymBtn.textContent = "Synonyms";
    synonymBtn.addEventListener("click", async () => {
      await runSynonymAnalysis(word);
    });

    actions.appendChild(addTagBtn);
    actions.appendChild(openBtn);
    actions.appendChild(compareBtn);
    actions.appendChild(synonymBtn);

    footer.appendChild(tagsBox);
    footer.appendChild(actions);

    item.appendChild(en);
    item.appendChild(zh);
    item.appendChild(footer);

    if (activeSearchTagEditorWordId === word.id) {
      item.appendChild(buildSearchTagEditor(word));
    }

    searchResultsEl.appendChild(item);
  }

  syncSearchResultsHeight();
}

function normalizeEnglish(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeChinese(s) {
  return s
    .replace(/[\s，。；：、,.!?！？()（）\[\]【】]/g, "")
    .toLowerCase()
    .trim();
}

function fuzzyMatchChinese(input, expected) {
  const a = normalizeChinese(input);
  const b = normalizeChinese(expected);

  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 2 && b.includes(a)) return true;

  const chunks = expected
    .split(/[；;，,。\/]|\s+/)
    .map((x) => normalizeChinese(x))
    .filter((x) => x.length >= 2);

  return chunks.some((c) => a.includes(c) || c.includes(a));
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function currentWord() {
  return queue[0];
}

function updateScore() {
  if (scoreEl) {
    scoreEl.textContent = "";
  }
}

function updateProgress() {
  const total = Math.max(0, sessionTargetCount);
  const done = Math.min(total, Math.max(0, sessionCompletedCount));
  progressEl.textContent = `${done}/${total}`;
}

function setQueueDebugVisible(visible) {
  isQueueDebugVisible = Boolean(visible);
  if (queueDebugPanelEl) {
    queueDebugPanelEl.classList.toggle("is-hidden", !isQueueDebugVisible);
  }
}

function toggleQueueDebug() {
  setQueueDebugVisible(!isQueueDebugVisible);
}

function renderQueueDebug() {
  if (!queueDebugContentEl) return;
  if (!isQueueDebugVisible) {
    queueDebugContentEl.textContent = "";
    return;
  }
  if (!Array.isArray(queue) || !queue.length) {
    queueDebugContentEl.textContent = "";
    return;
  }

  queueDebugContentEl.textContent = queue
    .map((w) => String(w?.en || "").trim())
    .filter(Boolean)
    .join("\n");
}

function resetSessionMasteryState(initialQueue) {
  const ids = new Set((initialQueue || []).map((w) => w.id));
  sessionTargetCount = ids.size;
  sessionCompletedCount = 0;
  sessionWordMastery = new Map();
  for (const id of ids) {
    sessionWordMastery.set(id, {
      correctCount: 0,
      completed: false,
      hadWrong: false,
    });
  }
}

function serializeSessionMastery() {
  return Array.from(sessionWordMastery.entries()).map(([id, state]) => [
    Number(id),
    {
      correctCount: Number(state?.correctCount || 0),
      completed: Boolean(state?.completed),
      hadWrong: Boolean(state?.hadWrong),
    },
  ]);
}

function cloneSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;
  return {
    queueWordIds: Array.isArray(snapshot.queueWordIds) ? snapshot.queueWordIds.slice() : [],
    // Compatibility field for older saved state. Queue mode always uses head index 0.
    currentIndex: 0,
    sessionTargetCount: Number(snapshot.sessionTargetCount || 0),
    sessionCompletedCount: Number(snapshot.sessionCompletedCount || 0),
    masteryEntries: Array.isArray(snapshot.masteryEntries)
      ? snapshot.masteryEntries.map((row) => (Array.isArray(row) ? [row[0], row[1]] : row))
      : [],
    mode: String(snapshot.mode || mode),
  };
}

function buildCurrentSessionSnapshot() {
  return {
    queueWordIds: queue.map((w) => w.id),
    currentIndex: 0,
    sessionTargetCount,
    sessionCompletedCount,
    masteryEntries: serializeSessionMastery(),
    mode,
  };
}

function persistSessionState() {
  try {
    const state = {
      snapshots: {
        study: cloneSnapshot(sessionSnapshots.study),
        review: cloneSnapshot(sessionSnapshots.review),
        quiz: cloneSnapshot(sessionSnapshots.quiz),
      },
      activeType: currentSessionType,
      activeSnapshot:
        currentSessionType === "study" || currentSessionType === "review" || currentSessionType === "quiz"
          ? buildCurrentSessionSnapshot()
          : null,
    };
    window.localStorage.setItem(SESSION_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors.
  }
}

function readPersistedSessionState() {
  try {
    const raw = window.localStorage.getItem(SESSION_STATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function applyPersistedSnapshots() {
  const saved = readPersistedSessionState();
  if (!saved) return "none";

  const studySnap = cloneSnapshot(saved?.snapshots?.study);
  const reviewSnap = cloneSnapshot(saved?.snapshots?.review);
  const quizSnap = cloneSnapshot(saved?.snapshots?.quiz);
  sessionSnapshots.study = studySnap;
  sessionSnapshots.review = reviewSnap;
  sessionSnapshots.quiz = quizSnap;

  const activeType = String(saved?.activeType || "none");
  if (activeType !== "study" && activeType !== "review" && activeType !== "quiz") {
    persistSessionState();
    return "none";
  }

  const activeSnapshot = cloneSnapshot(saved?.activeSnapshot);
  if (!activeSnapshot) {
    persistSessionState();
    return "none";
  }

  sessionSnapshots[activeType] = activeSnapshot;
  persistSessionState();
  return activeType;
}

function deserializeSessionMastery(entries) {
  const next = new Map();
  if (!Array.isArray(entries)) return next;
  for (const row of entries) {
    if (!Array.isArray(row) || row.length < 2) continue;
    const id = Number(row[0]);
    const state = row[1] || {};
    if (!Number.isFinite(id)) continue;
    const migratedCorrectCount = Number(
      state.correctCount
      ?? state.correctAfterWrong
      ?? 0
    );
    next.set(id, {
      correctCount: Math.max(0, migratedCorrectCount),
      completed: Boolean(state.completed),
      hadWrong: Boolean(state.hadWrong),
    });
  }
  return next;
}

function clearSessionSnapshot(type) {
  if (type !== "study" && type !== "review" && type !== "quiz") return;
  sessionSnapshots[type] = null;
  persistSessionState();
}

function saveCurrentSessionSnapshot() {
  if (currentSessionType !== "study" && currentSessionType !== "review" && currentSessionType !== "quiz") return;
  if (!queue.length) {
    clearSessionSnapshot(currentSessionType);
    return;
  }

  sessionSnapshots[currentSessionType] = buildCurrentSessionSnapshot();
  persistSessionState();
}

function hasSnapshotToResume(type) {
  const snap = sessionSnapshots[type];
  if (!snap) return false;
  if (!Array.isArray(snap.queueWordIds) || !snap.queueWordIds.length) return false;
  const total = Number(snap.sessionTargetCount || 0);
  const done = Number(snap.sessionCompletedCount || 0);
  return total > 0 && done < total;
}

function restoreSessionSnapshot(type) {
  if (type !== "study" && type !== "review" && type !== "quiz") return false;
  if (!hasSnapshotToResume(type)) return false;

  const snap = sessionSnapshots[type];
  const restoredQueue = snap.queueWordIds
    .map((id) => findWordById(id))
    .filter(Boolean);

  if (!restoredQueue.length) {
    clearSessionSnapshot(type);
    return false;
  }

  queue = restoredQueue;
  currentIndex = 0;
  sessionTargetCount = Math.max(0, Number(snap.sessionTargetCount || 0));
  sessionCompletedCount = Math.max(0, Number(snap.sessionCompletedCount || 0));
  sessionWordMastery = deserializeSessionMastery(snap.masteryEntries);
  mode = String(snap.mode || mode);
  currentSessionType = type;
  answeredThisRound = false;
  totalChecked = 0;
  totalCorrect = 0;
  persistSessionState();
  return true;
}

function getSessionMastery(wordId) {
  const existed = sessionWordMastery.get(wordId);
  if (existed) return existed;
  const created = {
    correctCount: 0,
    completed: false,
    hadWrong: false,
  };
  sessionWordMastery.set(wordId, created);
  if (sessionTargetCount === 0) {
    sessionTargetCount = 1;
  }
  return created;
}

function updateSessionWordMastery(wordId, ok, countAsCorrect) {
  const state = getSessionMastery(wordId);
  const wasCompleted = state.completed;
  const requiredCorrectCount = currentSessionType === "quiz" ? 1 : 3;

  if (ok && countAsCorrect) {
    state.correctCount = Math.max(0, Number(state.correctCount || 0)) + 1;
    if (state.correctCount >= requiredCorrectCount) {
      state.completed = true;
    }
  } else if (!ok) {
    state.correctCount = Math.max(0, Number(state.correctCount || 0));
    state.hadWrong = true;
  }

  if (!wasCompleted && state.completed) {
    sessionCompletedCount += 1;
  }

  return state;
}

async function settleReviewCurveForRound() {
  for (const [wordId, state] of sessionWordMastery.entries()) {
    const word = findWordById(Number(wordId));
    if (!word) continue;
    const passedCleanly = !Boolean(state?.hadWrong);
    await applyCurveAfterAnswer(word, passedCleanly);
  }
}

function ensureSessionRetry(item) {
  if (!item || !queue.length) return;
  const pendingSame = queue.slice(1).some((w) => w.id === item.id);
  if (pendingSame) return;
  // Retry only after current round words are exhausted.
  queue.push(item);
}

function updateSessionTypeText() {
  if (!sessionTypeTextEl) return;
  if (currentSessionType === "study") {
    sessionTypeTextEl.textContent = "Current: Study Session";
  } else if (currentSessionType === "review") {
    sessionTypeTextEl.textContent = "Current: Review Session";
  } else if (currentSessionType === "quiz") {
    sessionTypeTextEl.textContent = "Current: Quiz Session";
  } else {
    sessionTypeTextEl.textContent = "Current: No Session";
  }
}

function updateStatusCounts() {
  const now = Date.now();
  let newCount = 0;
  let learningCount = 0;
  let masteredCount = 0;
  let dueCount = 0;

  for (const word of words) {
    const record = getProgress(word.id);
    if (record.status === "mastered") {
      masteredCount += 1;
      continue;
    }

    if (record.status === "learning") {
      learningCount += 1;
      if (isDueByDate(record.nextReviewAt, now)) {
        dueCount += 1;
      }
      continue;
    }

    newCount += 1;
  }

  if (newCountEl) newCountEl.textContent = String(newCount);
  if (learningCountEl) learningCountEl.textContent = String(learningCount);
  if (masteredCountEl) masteredCountEl.textContent = String(masteredCount);
  if (dueCountEl) dueCountEl.textContent = String(dueCount);
  if (filteredCountEl) filteredCountEl.textContent = String(words.filter((w) => wordMatchesFilters(w)).length);
  updateSessionTypeText();
  renderQueueDebug();
}

function setIdleMessage(msg, label = "Session Status") {
  queue = [];
  currentIndex = 0;
  sessionTargetCount = 0;
  sessionCompletedCount = 0;
  sessionWordMastery = new Map();
  progressEl.textContent = "0/0";
  if (scoreEl) {
    scoreEl.textContent = "";
  }
  if (promptLabelEl) {
    promptLabelEl.textContent = label;
  }
  promptTextEl.textContent = msg;
  answerInputEl.value = "";
  answerInputEl.placeholder = "";
  resultEl.textContent = "";
  resultEl.className = "result";
  correctAnswerEl.textContent = "";
  resetExamplesHint();
  renderQueueDebug();
}

function stopCurrentSession() {
  if (currentSessionType !== "study" && currentSessionType !== "review" && currentSessionType !== "quiz") return;

  const stoppedType = currentSessionType;
  saveCurrentSessionSnapshot();
  currentSessionType = "none";
  syncStatusPanelVisibility();
  setQuizVisible(false);
  syncStudyActionButtons();
  setIdleMessage(
    stoppedType === "study"
      ? "Study paused. Click New Study to continue this round."
      : stoppedType === "review"
        ? "Review paused. Click Review to continue this round."
        : "Quiz paused. Click Quiz to continue this round."
  );
  updateStatusCounts();
}

function resetLearningSession() {
  // Clear all in-memory and persisted session snapshots to force a fresh start.
  sessionSnapshots.study = null;
  sessionSnapshots.review = null;
  sessionSnapshots.quiz = null;
  currentSessionType = "none";
  queue = [];
  currentIndex = 0;
  sessionTargetCount = 0;
  sessionCompletedCount = 0;
  sessionWordMastery = new Map();
  answeredThisRound = false;
  popFirstAttemptJudged = false;
  totalChecked = 0;
  totalCorrect = 0;

  persistSessionState();
  setMainTab("study");
  syncStatusPanelVisibility();
  setQuizVisible(false);
  syncStudyActionButtons();
  setIdleMessage("Session reset. Click New Study to start a fresh session.");
  updateStatusCounts();
}

function isCurrentSessionCompleted() {
  return sessionTargetCount > 0 && sessionCompletedCount >= sessionTargetCount;
}

async function renderQuestion() {
  renderQueueDebug();
  if (!queue.length) {
    promptTextEl.textContent = "No available item in this session.";
    currentWordTagsEl.innerHTML = "";
    resetExamplesHint();
    return;
  }

  const item = currentWord();
  popFirstAttemptJudged = false;
  popRetryScheduled = false;
  popHadWrongAttempt = false;
  answeredThisRound = false;
  resultEl.textContent = "";
  resultEl.className = "result";
  correctAnswerEl.textContent = "";
  answerInputEl.value = "";

  if (mode === "sentence") {
    promptLabelEl.textContent = "Chinese Sentence";
    promptTextEl.textContent = "Generating sentence...";
    answerInputEl.placeholder = "Type a full English sentence";

    const requestId = ++sentenceTaskRequestId;
    const aiRequestId = nextAiRequestId("sentence-prompt");
    let tick = null;
    let task;
    try {
      tick = setInterval(() => {
        renderThinkingPreviewInElement(correctAnswerEl, "Generating sentence...", aiStreamTextByRequestId.get(aiRequestId) || "");
      }, 180);
      task = await buildSentenceTask(item, { requestId: aiRequestId });
      if (tick) clearInterval(tick);
      aiStreamTextByRequestId.delete(aiRequestId);
      clearThinkingPreviewInElement(correctAnswerEl);
    } catch (err) {
      if (tick) clearInterval(tick);
      aiStreamTextByRequestId.delete(aiRequestId);
      clearThinkingPreviewInElement(correctAnswerEl);
      if (requestId !== sentenceTaskRequestId) {
        return;
      }
      currentSentenceTask = null;
      promptTextEl.textContent = "Failed to generate sentence from API.";
      resultEl.textContent = "API error";
      resultEl.className = "result bad";
      correctAnswerEl.textContent = String(err?.message || "Please check API key/network and try again.");
      answerInputEl.placeholder = "Sentence unavailable";
      updateProgress();
      renderCurrentWordTags();
      resetExamplesHint();
      return;
    }
    if (requestId !== sentenceTaskRequestId) {
      aiStreamTextByRequestId.delete(aiRequestId);
      clearThinkingPreviewInElement(correctAnswerEl);
      return;
    }
    currentSentenceTask = task;
    promptTextEl.textContent = task.zhPrompt;
  } else if (mode === "zh2en") {
    sentenceTaskRequestId += 1;
    currentSentenceTask = null;
    promptLabelEl.textContent = "Chinese Prompt";
    promptTextEl.textContent = item.zh;
    answerInputEl.placeholder = "Type English";
  } else {
    sentenceTaskRequestId += 1;
    currentSentenceTask = null;
    promptLabelEl.textContent = "English Prompt";
    promptTextEl.textContent = item.en;
    answerInputEl.placeholder = "Type Chinese";
  }

  updateProgress();
  renderCurrentWordTags();
  resetExamplesHint();
  answerInputEl.focus();
}

function markResult(ok, detail) {
  resultEl.textContent = ok ? "Correct" : "Incorrect";
  resultEl.className = ok ? "result ok" : "result bad";
  correctAnswerEl.textContent = detail;
}

function formatWordMasteryProgress(state) {
  if (!state || typeof state !== "object") return "";
  const requiredCorrectCount = currentSessionType === "quiz" ? 1 : 3;
  const progress = Math.max(0, Math.min(requiredCorrectCount, Number(state.correctCount || 0)));
  return `本词正确进度: ${progress}/${requiredCorrectCount}`;
}

function getNextStageIntervalDays(stage) {
  const idx = Math.min(stage, REVIEW_INTERVALS_DAYS.length - 1);
  return REVIEW_INTERVALS_DAYS[idx];
}

async function applyCurveAfterAnswer(item, ok) {
  const now = Date.now();
  const current = getProgress(item.id);
  const next = { ...current };

  if (current.status === "mastered" && ok) {
    next.rightCount = (current.rightCount || 0) + 1;
    next.lastReviewedAt = now;
    await setProgress(next);
    return;
  }

  next.status = "learning";
  next.lastReviewedAt = now;

  if (ok) {
    next.stage = Math.min(current.stage + 1, REVIEW_INTERVALS_DAYS.length - 1);
    next.rightCount = (current.rightCount || 0) + 1;
    next.nextReviewAt = addDaysAtStartOfDay(now, getNextStageIntervalDays(next.stage));
  } else {
    // Wrong answer resets curve to the first stage.
    next.stage = 0;
    next.wrongCount = (current.wrongCount || 0) + 1;
    next.nextReviewAt = addDaysAtStartOfDay(now, REVIEW_INTERVALS_DAYS[0]);
  }

  await setProgress(next);
}

async function applyStudyProgressAfterCompletion(item, passedCleanly) {
  const now = Date.now();
  const current = getProgress(item.id);
  const next = { ...current };

  // Study session should not advance the spaced-repetition curve.
  // Newly learned words stay at stage 0 and wait for the first review window.
  next.status = "learning";
  next.stage = 0;
  next.lastReviewedAt = now;
  next.nextReviewAt = addDaysAtStartOfDay(now, REVIEW_INTERVALS_DAYS[0]);

  if (passedCleanly) {
    next.rightCount = (current.rightCount || 0) + 1;
  } else {
    next.wrongCount = (current.wrongCount || 0) + 1;
  }

  await setProgress(next);
}

function renderCurrentWordTags() {
  const item = currentWord();
  if (!item) {
    currentWordTagsEl.innerHTML = "";
    return;
  }

  const tags = getWordTags(item.id);
  renderTagList(
    currentWordTagsEl,
    tags,
    null,
    true,
    null,
    async (tag) => {
      await removeTagFromCurrentWord(tag);
    }
  );
}

async function addTagToCurrentWord() {
  const item = currentWord();
  if (!item) return;
  await addTagToWord(item.id, newTagInputEl.value);

  newTagInputEl.value = "";
  renderCurrentWordTags();
  renderFilterTags();
  updateStatusCounts();
  renderSearchResults();
}

async function removeTagFromCurrentWord(tag) {
  const item = currentWord();
  if (!item) return;

  const removeKey = toTagKey(tag);
  const record = getProgress(item.id);
  const tags = (Array.isArray(record.tags) ? record.tags : []).filter((t) => toTagKey(t) !== removeKey);

  await setProgress({ ...record, tags });

  if (selectedFilterTags.has(removeKey)) {
    selectedFilterTags.delete(removeKey);
  }

  renderCurrentWordTags();
  renderFilterTags();
  updateStatusCounts();
  renderSearchResults();
}

function onSearchOrFilterChanged() {
  updateStatusCounts();
  renderSearchResults();
  renderComparePanel();
  renderSuggestList();
  syncSearchResultsHeight();
}

async function checkAnswer() {
  if (!queue.length || answeredThisRound || isCheckingAnswer) return;

  setCheckingState(true);

  try {
    const item = currentWord();
    const input = answerInputEl.value.trim();
    let ok = false;
    let detail = "";

    if (mode === "sentence") {
      if (!currentSentenceTask) {
        markResult(false, "句子题目不可用，请先修复 API 再继续。\n参考答案: 暂无");
        return;
      }
      const aiRequestId = nextAiRequestId("sentence-eval");
      let tick = null;
      try {
        tick = setInterval(() => {
          renderThinkingPreviewInElement(correctAnswerEl, "Checking your sentence...", aiStreamTextByRequestId.get(aiRequestId) || "");
        }, 180);
        resultEl.textContent = "Checking...";
        resultEl.className = "result info";
        const evaluated = await evaluateSentenceAnswerByModel(input, item, currentSentenceTask, { requestId: aiRequestId });
        if (tick) clearInterval(tick);
        aiStreamTextByRequestId.delete(aiRequestId);
        clearThinkingPreviewInElement(correctAnswerEl);
        ok = evaluated.ok;
        detail = evaluated.detail;
      } catch (err) {
        if (tick) clearInterval(tick);
        aiStreamTextByRequestId.delete(aiRequestId);
        clearThinkingPreviewInElement(correctAnswerEl);
        markResult(false, `判分失败: ${String(err?.message || "Unknown error")}`);
        return;
      }
    } else if (mode === "zh2en") {
      ok = normalizeEnglish(input) === normalizeEnglish(item.en);
      detail = `标准答案: ${item.en}`;
    } else {
      ok = fuzzyMatchChinese(input, item.zh);
      detail = `中文释义: ${item.zh}`;
    }

    if (!ok) {
      popHadWrongAttempt = true;
    }

    // Move to next question only after getting this word correct.
    // Wrong attempts stay on the current word for retry.
    answeredThisRound = ok;
    totalChecked += 1;
    if (ok) totalCorrect += 1;
    const isFirstAttemptOfThisPop = !popFirstAttemptJudged;
    popFirstAttemptJudged = true;

    if (ok) {
      const passedCleanly = !popHadWrongAttempt;
      if (currentSessionType === "review") {
        // Review curve is settled only once when the full review round ends.
      } else if (currentSessionType === "study") {
        await applyStudyProgressAfterCompletion(item, passedCleanly);
      } else if (currentSessionType === "quiz") {
        // Quiz is exam-only and does not change learning curve or progress.
      } else {
        await applyCurveAfterAnswer(item, passedCleanly);
      }
    }

    const countAsCorrect = isFirstAttemptOfThisPop && ok;
    const mastery = updateSessionWordMastery(item.id, ok, countAsCorrect);
    if (isFirstAttemptOfThisPop && !mastery.completed && !popRetryScheduled) {
      ensureSessionRetry(item);
      popRetryScheduled = true;
    }

    // Hidden mode and normal mode share the same queue flow.

    const progressText = formatWordMasteryProgress(mastery);
    const resultDetail = progressText ? `${detail}\n${progressText}` : detail;
    markResult(ok, resultDetail);
    if (isHiddenMode && activeMainTab === "study" && (currentSessionType === "study" || currentSessionType === "review" || currentSessionType === "quiz")) {
      if (!ok) {
        resultEl.textContent = "Retry Later";
      }
    }

    updateScore();
    updateProgress();
    updateStatusCounts();

    if (currentSessionType !== "none" && isCurrentSessionCompleted()) {
      if (currentSessionType === "review") {
        await settleReviewCurveForRound();
      }
      clearSessionSnapshot(currentSessionType);
      currentSessionType = "none";
      syncStatusPanelVisibility();
      setQuizVisible(false);
      syncStudyActionButtons();
      setIdleMessage("Session completed.");
      updateStatusCounts();
      return;
    }

    // Navigation to the next word is handled by the next Enter key press in app.js.
  } finally {
    setCheckingState(false);
  }
}

async function showAnswer() {
  if (!queue.length) return;

  const item = currentWord();
  let answerText = "";
  if (mode === "sentence") {
    if (!currentSentenceTask) {
      markResult(false, "Sentence task is unavailable. Please fix API and click Next.");
      return;
    }
    if (currentSentenceTask.referenceEn) {
      answerText = `Reference sentence: ${currentSentenceTask.referenceEn}`;
    } else {
      answerText = "Keep your translation natural and include the target word if possible.";
    }
  } else if (mode === "zh2en") {
    answerText = `标准答案: ${item.en}`;
  } else {
    answerText = `中文释义: ${item.zh}`;
  }

  markResult(false, answerText);
}

function nextQuestion() {
  if (!queue.length) return;
  // Queue mode: move forward by removing the current head.
  queue.shift();

  if (!queue.length) {
    clearSessionSnapshot(currentSessionType);
    currentSessionType = "none";
    syncStatusPanelVisibility();
    setQuizVisible(false);
    updateStatusCounts();
    syncStudyActionButtons();
    setIdleMessage("Session completed. Start a new study or review session.");
    return;
  }

  currentIndex = 0;

  renderQuestion();
}

async function markCurrentWordMastered() {
  const item = currentWord();
  if (!item) return;

  await setWordStatus(item.id, "mastered");

  queue.shift();

  updateStatusCounts();
  renderSearchResults();
  renderManagerPanel();

  if (!queue.length) {
    clearSessionSnapshot(currentSessionType);
    currentSessionType = "none";
    setQuizVisible(false);
    syncStudyActionButtons();
    setIdleMessage("All items in this session are done. You can continue with study or review.");
    return;
  }

  currentIndex = 0;

  renderQuestion();
}

function endSession() {
  stopCurrentSession();
}

function buildStudyQueue(limit) {
  const newWords = words.filter((w) => getProgress(w.id).status === "new" && wordMatchesFilters(w));
  shuffle(newWords);
  return newWords.slice(0, limit);
}

function buildSentencePracticeQueue(limit) {
  const learnedWords = words.filter((w) => {
    const status = getProgress(w.id).status;
    if (status !== "learning" && status !== "mastered") return false;
    return wordMatchesFilters(w);
  });
  shuffle(learnedWords);
  return learnedWords.slice(0, limit);
}

function buildReviewQueue(limit) {
  const now = Date.now();
  const dueLearning = [];

  for (const record of progressById.values()) {
    if (record.status !== "learning") continue;
    if (!isDueByDate(record.nextReviewAt, now)) continue;
    const word = findWordById(record.id);
    if (!word) continue;
    if (!wordMatchesFilters(word)) continue;
    dueLearning.push({ word, record });
  }

  dueLearning.sort((a, b) => {
    if (a.record.nextReviewAt !== b.record.nextReviewAt) {
      return a.record.nextReviewAt - b.record.nextReviewAt;
    }
    return a.record.stage - b.record.stage;
  });

  return dueLearning.slice(0, limit).map((x) => x.word);
}

function buildQuizQueue(limit) {
  const quizWords = words.filter((w) => {
    const status = getProgress(w.id).status;
    if (status !== "learning" && status !== "mastered") return false;
    return wordMatchesFilters(w);
  });
  shuffle(quizWords);
  return quizWords.slice(0, limit);
}

function startSession(type) {
  setMainTab("study");
  clearSessionSnapshot(type);
  const limit =
    type === "review"
      ? REVIEW_SESSION_LIMIT
      : type === "quiz"
        ? Number.MAX_SAFE_INTEGER
        : getSessionCount();
  if (mode === "sentence" && type === "study") {
    queue = buildSentencePracticeQueue(limit);
  } else if (type === "quiz") {
    queue = buildQuizQueue(limit);
  } else {
    queue = type === "study" ? buildStudyQueue(limit) : buildReviewQueue(limit);
  }
  if (type === "study" || type === "quiz") {
    shuffle(queue);
  }
  resetSessionMasteryState(queue);
  currentIndex = 0;
  totalChecked = 0;
  totalCorrect = 0;
  currentSessionType = type;
  syncStatusPanelVisibility();
  syncStudyActionButtons();
  updateScore();

  if (!queue.length) {
    clearSessionSnapshot(type);
    currentSessionType = "none";
    syncStatusPanelVisibility();
    setQuizVisible(false);
    syncStudyActionButtons();
    updateStatusCounts();
    if (type === "study") {
      if (mode === "sentence") {
        setIdleMessage("No learned words available for sentence practice yet.");
      } else {
        setIdleMessage("No new words available. All are in studying status. You can switch to review.");
      }
    } else if (type === "review") {
      setIdleMessage("No review words are due right now. Please come back later.");
    } else {
      setIdleMessage("No studying or mastered words available for quiz right now.");
    }
    return;
  }

  setQuizVisible(true);
  setManagerVisible(false);
  updateProgress();
  updateStatusCounts();
  syncStudyActionButtons();
  renderQuestion();
  persistSessionState();
}

function hasUnfinishedSession() {
  if (!queue.length) return false;
  if (currentSessionType !== "study" && currentSessionType !== "review" && currentSessionType !== "quiz") return false;
  if (isCurrentSessionCompleted()) return false;
  return true;
}

function resumeSessionView() {
  setMainTab("study");
  setQuizVisible(true);
  setManagerVisible(false);
  updateProgress();
  updateStatusCounts();
  syncStudyActionButtons();
  renderQuestion();
}

function startOrResumeSession(type) {
  if (currentSessionType === type && hasUnfinishedSession()) {
    resumeSessionView();
    return;
  }

  if (currentSessionType !== "none" && currentSessionType !== type) {
    saveCurrentSessionSnapshot();
  }

  if (restoreSessionSnapshot(type)) {
    resumeSessionView();
    return;
  }

  startSession(type);
}

async function init() {
  try {
    renderAppVersionBadge();
    setQueueDebugVisible(false);
    const resp = await fetch("words.json");
    words = await resp.json();

    if (!Array.isArray(words) || words.length === 0) {
      throw new Error("Word list is empty");
    }

    const allProgress = await idbGetAll();
    const fixed = allProgress.map((x) => ({
      ...x,
      tags: Array.isArray(x.tags) ? x.tags : [],
    }));
    progressById = new Map(fixed.map((x) => [x.id, x]));
    updateStatusCounts();
    renderFilterTags();
    renderComparePanel();
    renderSearchResults();
    renderManagerPanel();
    const lastActiveType = applyPersistedSnapshots();
    setMainTab("study");
    syncStatusPanelVisibility();
    if (lastActiveType === "study" || lastActiveType === "review" || lastActiveType === "quiz") {
      if (restoreSessionSnapshot(lastActiveType)) {
        setQuizVisible(true);
        applyModeSpecificUI();
        applyHiddenModeUI();
        syncStudyActionButtons();
        syncSearchResultsHeight();
        renderQuestion();
      } else {
        setQuizVisible(false);
        setIdleMessage("Choose Start New Study, Review, or Quiz.");
      }
    } else {
      setQuizVisible(false);
      setIdleMessage("Choose Start New Study, Review, or Quiz.");
    }
    applyModeSpecificUI();
    applyHiddenModeUI();
    syncStudyActionButtons();
    syncSearchResultsHeight();

    bindAiStreamListener();

  } catch (err) {
    promptTextEl.textContent = "Failed to load words. Please check words.json.";
    resultEl.textContent = String(err);
    resultEl.className = "result bad";
  }
}

window.addEventListener("resize", () => {
  syncSearchResultsHeight();
});

window.addEventListener("beforeunload", () => {
  if (currentSessionType === "study" || currentSessionType === "review" || currentSessionType === "quiz") {
    saveCurrentSessionSnapshot();
    return;
  }
  persistSessionState();
});

