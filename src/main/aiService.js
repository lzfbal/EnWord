const fs = require("node:fs");
const path = require("node:path");

function createAiService({ appRoot }) {
  function shouldEnableSentenceEvalDebug(cfg) {
    if (cfg && typeof cfg === "object" && cfg.debugSentenceEval === true) {
      return true;
    }
    return String(process.env.ENWORD_AI_DEBUG || "").trim() === "1";
  }

  function toDebugPreview(value, maxLen = 6000) {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    const safe = String(text || "");
    if (safe.length <= maxLen) return safe;
    return `${safe.slice(0, maxLen)} ...<truncated ${safe.length - maxLen} chars>`;
  }

  function logSentenceEvalDebug(cfg, stage, payload) {
    if (!shouldEnableSentenceEvalDebug(cfg)) return;
    try {
      const summary = typeof payload === "string"
        ? payload
        : JSON.stringify(payload, null, 2);
      const preview = toDebugPreview(summary);
      console.log(`[ENWORD][sentence-eval][${stage}]\n${preview}`);
    } catch (err) {
      console.log(`[ENWORD][sentence-eval][${stage}] <failed to serialize debug payload: ${String(err?.message || err)}>`);
    }
  }

  function isEnglishAnalysisLine(line) {
    const value = String(line || "").trim();
    if (!value) return false;
    return /^(?:score|issues?|problem|problems|grammar|analysis|feedback)\s*[:：]/i.test(value)
      || /multiple errors|grammatical errors|unnatural|awkward|incorrect|improve/i.test(value);
  }

  function sanitizeSentenceAnswerCandidate(text) {
    return String(text || "")
      .replace(/```(?:json)?/gi, "")
      .replace(/```/g, "")
      .replace(/^"+|"+$/g, "")
      .replace(/^(?:correct\s*answer|correctAnswer|正确答案|标准答案)\s*(?:\([^)]*\))?\s*[:：]\s*/i, "")
      .replace(/^(?:revision|修正版|修正后的答案|改写)\s*(?:\([^)]*\))?\s*[:：]\s*/i, "")
      .trim();
  }

  function isLikelyEnglishAnswerSentence(text) {
    const value = sanitizeSentenceAnswerCandidate(text);
    if (!value) return false;
    if (/^"?analysis"?\s*:/i.test(value)) return false;
    if (/^chinese\s*prompt\s*:/i.test(value)) return false;
    if (/^user'?s\s*answer\s*:/i.test(value)) return false;
    if (/^target\s*word\s*:/i.test(value)) return false;
    if (/^reference\s*:/i.test(value)) return false;
    if (isEnglishAnalysisLine(value)) return false;
    if (/let me analyze|let me settle|i'?d give|user'?s sentence|target words?|target word|issues?:/i.test(value)) return false;
    if (/^[\[{]/.test(value)) return false;
    if (/[\u4e00-\u9fff]/.test(value)) return false;
    const letters = value.match(/[A-Za-z]/g) || [];
    if (letters.length < 12) return false;
    if (!/\s/.test(value)) return false;
    return true;
  }

  function containsAllTargetWords(sentence, targetWords) {
    const answer = String(sentence || "").toLowerCase();
    return targetWords.every((word) => {
      const target = String(word || "").trim().toLowerCase();
      if (!target) return true;
      const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");

      // A target word must appear in the answer, but normal grammatical forms
      // are valid too: possess → possesses, cheat → cheated, harmony → harmonies.
      if (/\s/.test(target)) {
        return new RegExp(`\\b${escaped}\\b`, "i").test(answer);
      }
      if (target.endsWith("y") && target.length > 2) {
        const root = target.slice(0, -1).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`\\b(?:${escaped}|${root}ies)\\b`, "i").test(answer);
      }
      return new RegExp(`\\b${escaped}(?:s|es|ed|ing)?\\b`, "i").test(answer);
    });
  }

  function extractEnglishAnswerCandidatesFromRaw(text) {
    const raw = String(text || "").trim();
    if (!raw) return [];

    const lines = raw
      .replace(/```(?:json)?/gi, "")
      .replace(/```/g, "")
      .split(/\r?\n/)
      .map((x) => sanitizeSentenceAnswerCandidate(x))
      .filter(Boolean);

    const candidates = [];
    for (const line of lines) {
      if (!isLikelyEnglishAnswerSentence(line)) continue;
      candidates.push(line.replace(/^"+|"+$/g, "").trim());
    }

    // Also try quoted sentences embedded in long lines.
    const quoted = raw.match(/"([A-Za-z][^"\n]{20,280})"/g) || [];
    for (const q of quoted) {
      const line = sanitizeSentenceAnswerCandidate(q.replace(/^"|"$/g, ""));
      if (!isLikelyEnglishAnswerSentence(line)) continue;
      candidates.push(line);
    }

    const deduped = [];
    const seen = new Set();
    for (const c of candidates) {
      const k = c.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      deduped.push(c);
    }
    return deduped;
  }

  function resolveAiConfigPath() {
    return path.join(appRoot, "ai-config.json");
  }

  function readAiConfig() {
    const configPath = resolveAiConfigPath();
    if (!fs.existsSync(configPath)) {
      return null;
    }

    try {
      const raw = fs.readFileSync(configPath, "utf-8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function resolveChatCompletionsUrl(cfg) {
    const base = String(cfg?.baseUrl || "").trim();
    const endpoint = String(cfg?.endpoint || "chat/completions").trim();
    if (!base) return "";
    return `${base.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`;
  }

  function extractMessageText(message) {
    if (!message) return "";

    if (typeof message.content === "string") {
      return message.content.trim();
    }

    if (Array.isArray(message.content)) {
      const text = message.content
        .map((part) => {
          if (typeof part === "string") return part;
          if (part && typeof part.text === "string") return part.text;
          return "";
        })
        .join("\n")
        .trim();
      if (text) return text;
    }

    if (typeof message.reasoning === "string") {
      return message.reasoning.trim();
    }

    return "";
  }

  function extractDeltaText(delta) {
    if (!delta) return "";

    if (typeof delta.content === "string") {
      return delta.content;
    }

    if (Array.isArray(delta.content)) {
      return delta.content
        .map((part) => {
          if (typeof part === "string") return part;
          if (part && typeof part.text === "string") return part.text;
          return "";
        })
        .join("");
    }

    if (typeof delta.reasoning === "string") {
      return delta.reasoning;
    }

    return "";
  }

  function parseFirstJsonObject(text) {
    const raw = String(text || "").trim();
    if (!raw) return null;

    const noFence = raw.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();

    try {
      return JSON.parse(noFence);
    } catch {
      // continue
    }

    const start = noFence.indexOf("{");
    const end = noFence.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(noFence.slice(start, end + 1));
      } catch {
        // continue
      }
    }

    for (let i = 0; i < noFence.length; i += 1) {
      if (noFence[i] !== "{") continue;

      let depth = 0;
      let inString = false;
      let escaped = false;

      for (let j = i; j < noFence.length; j += 1) {
        const ch = noFence[j];

        if (inString) {
          if (escaped) {
            escaped = false;
            continue;
          }
          if (ch === "\\") {
            escaped = true;
            continue;
          }
          if (ch === '"') {
            inString = false;
          }
          continue;
        }

        if (ch === '"') {
          inString = true;
          continue;
        }
        if (ch === "{") {
          depth += 1;
          continue;
        }
        if (ch === "}") {
          depth -= 1;
          if (depth === 0) {
            const candidate = noFence.slice(i, j + 1);
            try {
              return JSON.parse(candidate);
            } catch {
              break;
            }
          }
        }
      }
    }

    return null;
  }

  function parseSynonymsFromLooseText(text, fallbackWord) {
    const raw = String(text || "").trim();
    if (!raw) return null;

    const lines = raw
      .replace(/```(?:json)?/gi, "")
      .replace(/```/g, "")
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);

    const synonyms = [];
    const seen = new Set();

    for (const line of lines) {
      const cleaned = line.replace(/^[-*\d.\)\s]+/, "").trim();
      const m = cleaned.match(/^([A-Za-z][A-Za-z\s'-]{0,30})\s*[:\-：]\s*(.+)$/);
      if (!m) continue;

      const word = String(m[1] || "").trim();
      const difference = String(m[2] || "").trim();
      const key = word.toLowerCase();
      if (!word || !difference || seen.has(key)) continue;
      seen.add(key);
      synonyms.push({
        word,
        difference,
        examples: [],
      });
      if (synonyms.length >= 5) break;
    }

    if (!synonyms.length) {
      const listHit = raw.match(/synonyms?\s*[:：]\s*([A-Za-z,\s'-]{8,})/i);
      if (listHit?.[1]) {
        const list = listHit[1]
          .split(/[,，]/)
          .map((x) => x.trim())
          .filter((x) => /^[A-Za-z][A-Za-z\s'-]{0,30}$/.test(x))
          .slice(0, 5);
        for (const item of list) {
          const key = item.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          synonyms.push({
            word: item,
            difference: "语义相近，使用场景需结合语境判断。",
            examples: [],
          });
        }
      }
    }

    if (!synonyms.length) return null;

    return {
      word: String(fallbackWord || "").trim(),
      summary: raw.slice(0, 220),
      synonyms,
    };
  }

  function parseEvaluationFromLooseText(text) {
    const raw = String(text || "").trim();
    if (!raw) return null;

    const compact = raw.replace(/\s+/g, " ");
    const lines = raw
      .replace(/```(?:json)?/gi, "")
      .replace(/```/g, "")
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);

    const stripEvalLabel = (line) => String(line || "")
      .replace(/^(?:analysis|分析|说明|feedback|问题分析)\s*(?:\([^)]*\))?\s*[:：]\s*/i, "")
      .replace(/^(?:correct\s*answer|correctAnswer|正确答案|标准答案)\s*(?:\([^)]*\))?\s*[:：]\s*/i, "")
      .replace(/^(?:revision|修正版|修正后的答案|改写)\s*(?:\([^)]*\))?\s*[:：]\s*/i, "")
      .replace(/^Chinese\s*prompt\s*[:：]\s*/i, "")
      .trim();

    const hasLineLabel = (line, labelsRegex) => labelsRegex.test(String(line || "").trim());

    const extractLabeledBlock = (linesArr, labelsRegex, nextLabelsRegex) => {
      let start = -1;
      for (let i = 0; i < linesArr.length; i += 1) {
        if (hasLineLabel(linesArr[i], labelsRegex)) {
          start = i;
          break;
        }
      }
      if (start < 0) return "";

      const picked = [];
      const head = stripEvalLabel(linesArr[start]);
      if (head) picked.push(head);

      for (let i = start + 1; i < linesArr.length; i += 1) {
        const line = String(linesArr[i] || "").trim();
        if (!line) continue;
        if (hasLineLabel(line, nextLabelsRegex)) break;
        picked.push(stripEvalLabel(line));
      }

      return picked.filter(Boolean).join("；").trim();
    };

    const analysisLabelRe = /^(?:analysis|分析|说明|feedback|问题分析)\s*(?:\([^)]*\))?\s*[:：]/i;
    const correctAnswerLabelRe = /^(?:correct\s*answer|correctAnswer|正确答案|标准答案)\s*(?:\([^)]*\))?\s*[:：]/i;
    const revisionLabelRe = /^(?:revision|修正版|修正后的答案|改写)\s*(?:\([^)]*\))?\s*[:：]/i;
    const anyEvalLabelRe = /^(?:analysis|分析|说明|feedback|问题分析|correct\s*answer|correctAnswer|正确答案|标准答案|revision|修正版|修正后的答案|改写)\s*(?:\([^)]*\))?\s*[:：]/i;

    const looksLikeEnglishSentence = (line) => {
      const value = stripEvalLabel(line);
      if (!value) return false;
      if (isEnglishAnalysisLine(line)) return false;
      if (/let me analyze|user'?s sentence|target words?|target word|issues?:/i.test(value)) return false;
      if (!/[A-Za-z]/.test(value)) return false;
      if ((value.match(/[A-Za-z]/g) || []).length < 8) return false;
      return /[\s,.!?;:'"()-]/.test(value);
    };

    const looksLikeChineseAnalysis = (line) => {
      const value = stripEvalLabel(line);
      if (!value) return false;
      if (!/[\u4e00-\u9fff]/.test(value)) return false;
      if (/正确答案|标准答案|修正版|修正后的答案|改写/.test(value)) return false;
      return true;
    };

    // The provider can truncate after starting its final JSON. Prefer values
    // explicitly present in that JSON fragment over prose such as "correctly".
    const jsonOkMatch = raw.match(/["']ok["']\s*:\s*(true|false)/i);
    const jsonScoreMatch = raw.match(/["']score["']\s*:\s*(\d{1,3})/i);
    const scoreMatch = jsonScoreMatch || compact.match(/(?:score|评分)\s*[:：]?\s*(\d{1,3})/i);
    const score = scoreMatch ? Number(scoreMatch[1]) : 0;

    const okByWord = /\b(ok|correct|acceptable|good)\b/i.test(compact)
      || /可接受|正确|符合|通过/.test(compact);
    const badByWord = /\b(wrong|incorrect|bad|fail)\b/i.test(compact)
      || /错误|不自然|不通过|不符合/.test(compact);
    const ok = jsonOkMatch
      ? jsonOkMatch[1].toLowerCase() === "true"
      : (badByWord ? false : okByWord);

    const analysisMatch = raw.match(/(?:analysis|分析|说明|feedback|问题分析)\s*(?:\([^)]*\))?\s*[:：]\s*([^\n]+)/i);
    const analysisLine = lines.find((line) => analysisLabelRe.test(line));
    const analysisBlock = extractLabeledBlock(lines, analysisLabelRe, anyEvalLabelRe);
    const englishAnalysisFallback = lines
      .filter((line) => isEnglishAnalysisLine(line))
      .map((line) => stripEvalLabel(line))
      .join(" ");
    const analysisFallback = lines.filter((line) => looksLikeChineseAnalysis(line)).join("；");
    const analysis = analysisMatch
      ? String(analysisMatch[1]).trim()
      : analysisLine
        ? (analysisBlock || stripEvalLabel(analysisLine))
        : analysisFallback || englishAnalysisFallback || compact.slice(0, 180);

    const correctAnswerMatch = raw.match(/(?:correct\s*answer|correctAnswer|正确答案|标准答案)\s*(?:\([^)]*\))?\s*[:：]\s*([^\n]+)/i);
    const correctAnswerLine = lines.find((line) => correctAnswerLabelRe.test(line));
    const correctAnswerBlock = extractLabeledBlock(lines, correctAnswerLabelRe, anyEvalLabelRe);

    const revisionMatch = raw.match(/(?:revision|修正版|修正后的答案|改写)\s*(?:\([^)]*\))?\s*[:：]\s*([^\n]+)/i);
    const revisionLine = lines.find((line) => revisionLabelRe.test(line));
    const revisionBlock = extractLabeledBlock(lines, revisionLabelRe, anyEvalLabelRe);

    const englishCandidates = lines
      .filter((line) => looksLikeEnglishSentence(line))
      .map((line) => stripEvalLabel(line));

    const correctAnswer = correctAnswerMatch
      ? String(correctAnswerMatch[1]).trim()
      : correctAnswerLine
        ? (correctAnswerBlock || stripEvalLabel(correctAnswerLine))
        : (englishCandidates[englishCandidates.length - 1] || "");

    const revision = revisionMatch
      ? String(revisionMatch[1]).trim()
      : revisionLine
        ? (revisionBlock || stripEvalLabel(revisionLine))
        : (englishCandidates.length >= 2 ? englishCandidates[englishCandidates.length - 2] : "");

    return {
      ok,
      score: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0,
      analysis,
      correctAnswer,
      revision,
      feedback: analysis,
      betterSentence: revision,
    };
  }

  function isSentenceEvalResponseShape(obj) {
    if (!obj || typeof obj !== "object") return false;
    const keys = ["ok", "score", "analysis", "correctAnswer", "revision", "feedback", "betterSentence"];
    return keys.some((k) => Object.prototype.hasOwnProperty.call(obj, k));
  }

  function sanitizeSentenceEvalField(text) {
    return String(text || "")
      .replace(/^let me analyze the user's answer:?\s*/i, "")
      .replace(/^here'?s? (?:my )?analysis:?\s*/i, "")
      .replace(/^user'?s sentence:?\s*/i, "")
      .replace(/^target words?:?\s*/i, "")
      .replace(/^target word:?\s*/i, "")
      .replace(/^issues?:?\s*/i, "")
      .trim();
  }

  function looksLikeMetaEnglishAnalysis(text) {
    const value = sanitizeSentenceEvalField(text);
    if (!value) return false;
    return /let me analyze|user'?s sentence|target words?|issues?:/i.test(value);
  }

  function isUsableSentenceEvaluationResult({ analysis, correctAnswer, revision }) {
    const cleanAnalysis = String(analysis || "").trim();
    const cleanCorrectAnswer = String(correctAnswer || "").trim();
    const cleanRevision = String(revision || "").trim();

    if (!cleanAnalysis) {
      return false;
    }

    if (looksLikeMetaEnglishAnalysis(cleanAnalysis)) {
      return false;
    }

    return /[\u4e00-\u9fff]/.test(cleanAnalysis)
      && isLikelyEnglishAnswerSentence(cleanCorrectAnswer)
      && isLikelyEnglishAnswerSentence(cleanRevision);
  }

  function hasCompleteSentenceEvaluationJson(parsed) {
    if (!parsed || typeof parsed !== "object") return false;
    if (typeof parsed.ok !== "boolean") return false;
    if (!Number.isFinite(Number(parsed.score))) return false;

    const analysis = String(parsed.analysis || parsed.feedback || "").trim();
    const correctAnswer = sanitizeSentenceAnswerCandidate(parsed.correctAnswer || "");
    const revision = sanitizeSentenceAnswerCandidate(parsed.revision || parsed.betterSentence || "");

    return /[\u4e00-\u9fff]/.test(analysis)
      && isLikelyEnglishAnswerSentence(correctAnswer)
      && isLikelyEnglishAnswerSentence(revision);
  }

  function parseSentenceEvaluationResponse(rawContent, parsed) {
    if (hasCompleteSentenceEvaluationJson(parsed)) {
      return parsed;
    }

    // Some OpenAI-compatible reasoning providers emit an otherwise complete
    // JSON object but forget to escape quotation marks inside the Chinese
    // analysis. Recover fields only from the final evaluation object instead
    // of treating the preceding reasoning trace as a loose evaluation.
    const raw = String(rawContent || "");
    const starts = [...raw.matchAll(/\{\s*["']ok["']\s*:/gi)];
    const start = starts.length ? starts[starts.length - 1].index : -1;
    if (start < 0) return null;

    const candidate = raw.slice(start);
    const readStringField = (field) => {
      const nextField = "(?:ok|score|analysis|correctAnswer|revision)";
      const pattern = new RegExp(
        `["']${field}["']\\s*:\\s*"([\\s\\S]*?)"\\s*(?=,\\s*["']${nextField}["']\\s*:|\\})`,
        "i"
      );
      const match = candidate.match(pattern);
      if (!match) return "";
      return String(match[1] || "")
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\")
        .trim();
    };

    const okMatch = candidate.match(/["']ok["']\s*:\s*(true|false)/i);
    const scoreMatch = candidate.match(/["']score["']\s*:\s*(\d{1,3})/i);
    if (!okMatch || !scoreMatch) return null;

    const recovered = {
      ok: okMatch[1].toLowerCase() === "true",
      score: Number(scoreMatch[1]),
      analysis: readStringField("analysis"),
      correctAnswer: readStringField("correctAnswer"),
      revision: readStringField("revision"),
    };

    return hasCompleteSentenceEvaluationJson(recovered) ? recovered : null;
  }

  function pickBetterChineseAnalysis(primary, fallback) {
    const first = sanitizeSentenceEvalField(primary);
    const second = sanitizeSentenceEvalField(fallback);

    const firstIsUsable = first && /[\u4e00-\u9fff]/.test(first) && !looksLikeMetaEnglishAnalysis(first);
    if (firstIsUsable) return first;

    const secondIsUsable = second && /[\u4e00-\u9fff]/.test(second) && !looksLikeMetaEnglishAnalysis(second);
    if (secondIsUsable) return second;

    return first || second || "";
  }

  function findChineseSentence(text) {
    const raw = String(text || "").trim();
    if (!raw) return "";

    const quoted = raw.match(/[“\"]([^“”\"\n]{6,120}[。！？])[”\"]/);
    if (quoted?.[1]) {
      return quoted[1].trim();
    }

    const lineHit = raw
      .split(/\r?\n/)
      .map((x) => x.trim())
      .find((x) => /[\u4e00-\u9fff]/.test(x) && /[。！？]$/.test(x));
    if (lineHit) {
      return lineHit
        .replace(/^[-*\d.\s>]+/, "")
        .replace(/^请翻译(?:以下)?中文句子[:：]?\s*/i, "")
        .trim();
    }

    const hit = raw.match(/[\u4e00-\u9fff][\u4e00-\u9fff，、；：\s]{4,110}[。！？]/);
    if (hit?.[0]) {
      return hit[0].trim();
    }

    return "";
  }

  function normalizeZhPrompt(text) {
    const raw = String(text || "").trim();
    if (!raw) return "";

    const line = raw
      .split(/\r?\n/)
      .map((x) => x.trim())
      .find((x) => /[\u4e00-\u9fff]/.test(x) && !/^```/.test(x) && !isInstructionLikeChineseLine(x) && !isScenarioHintChineseLine(x));

    const target = line || raw;
    const cleaned = target
      .replace(/^请翻译(?:以下)?中文句子[:：]?\s*/i, "")
      .replace(/^中文短句[:：]?\s*/, "")
      .replace(/^(?:可能的)?场景[:：]?\s*/, "")
      .replace(/^(?:例如|比如)[:：]?\s*/, "")
      .replace(/^[-*\d.\s>]+/, "")
      .replace(/["“”]/g, "")
      .trim();

    return cleaned;
  }

  function isScenarioHintChineseLine(text) {
    const line = String(text || "").trim();
    if (!line) return false;
    return /^(?:可能的)?场景[:：]?/.test(line) || /^(?:例如|比如)[:：]?/.test(line);
  }

  function isInstructionLikeChineseLine(text) {
    const line = String(text || "").trim();
    if (!line) return true;
    const lower = line.toLowerCase();
    const markers = [
      "用户要求",
      "请给出",
      "中文短句",
      "难度",
      "ielts",
      "目标词",
      "中文释义",
      "仅输出",
      "翻译成英文",
      "你的任务",
      "严格要求",
      "句子长度",
      "model generated",
      "更短",
      "更长",
      "字",
    ];
    if (markers.some((m) => lower.includes(m))) return true;
    if (/\b\d+\s*字\b/.test(lower)) return true;
    return false;
  }

  function sanitizeSentenceZhPrompt(text) {
    const raw = String(text || "").trim();
    if (!raw) return "";

    const direct = extractBestZhPrompt(raw);
    if (direct) return direct;

    const cleanedLines = raw
      .split(/\r?\n/)
      .map((x) => normalizeZhPrompt(x))
      .filter((x) => x && /[\u4e00-\u9fff]/.test(x) && !isInstructionLikeChineseLine(x) && !isScenarioHintChineseLine(x));

    const line = cleanedLines.find((x) => /[。！？]$/.test(x)) || cleanedLines[0] || "";
    return line;
  }

  function extractBestZhPrompt(text) {
    const raw = String(text || "").trim();
    if (!raw) return "";

    const isValidPromptLine = (line) => {
      if (!line || isInstructionLikeChineseLine(line)) return false;
      if (!/[。！？]$/.test(line)) return false;
      if (line.length < 4 || line.length > 90) return false;
      if (/\d+\s*字/.test(line) || /更短|更长/.test(line)) return false;
      return true;
    };

    const cleanedLines = raw
      .split(/\r?\n/)
      .map((x) => normalizeZhPrompt(x))
      .filter((x) => /[\u4e00-\u9fff]/.test(x));

    const direct = cleanedLines.find((x) => isValidPromptLine(x));
    if (direct) return direct;

    const inText = raw.match(/[\u4e00-\u9fff][\u4e00-\u9fff，、；：\s]{3,60}[。！？]/g) || [];
    const fallback = inText
      .map((x) => normalizeZhPrompt(x))
      .find((x) => isValidPromptLine(x));
    if (fallback) return fallback;

    const loose = cleanedLines.find((x) => x && !isInstructionLikeChineseLine(x) && !/\d+\s*字/.test(x) && !/更短|更长/.test(x));
    return loose || "";
  }

  function normalizeSentenceDifficulty(raw) {
    const value = String(raw || "").toLowerCase().trim();
    if (value === "advanced") return "advanced";
    if (value === "intermediate") return "intermediate";
    if (value === "beginner") return "beginner";
    if (value === "starter") return "starter";
    return "beginner";
  }

  function normalizeChineseTranslation(raw) {
    const text = String(raw || "")
      .replace(/```(?:json)?/gi, "")
      .replace(/```/g, "")
      .replace(/^\s*中文[:：]\s*/i, "")
      .replace(/^\s*翻译[:：]\s*/i, "")
      .trim();
    const firstLine = text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)[0] || "";
    return firstLine || text;
  }

  function difficultySpec(difficulty) {
    if (difficulty === "advanced") {
      return "高级: IELTS 6.5-7.5，句子可包含让步/条件从句或抽象话题，长度约18-30字。";
    }
    if (difficulty === "intermediate") {
      return "中级: IELTS 5.5-6.5，句子自然完整，允许一处复合结构，长度约12-22字。";
    }
    if (difficulty === "beginner") {
      return "初级: IELTS 4.5-5.5，使用高频词和直接表达，尽量单句简单结构，长度约8-16字。";
    }
    return "入门: IELTS 4.0-5.0，使用非常高频和直接表达，句子尽量短，长度约6-10字。";
  }

  async function evaluateSentenceViaModel(payload, options = {}) {
    const cfg = readAiConfig();
    if (!cfg) {
      throw new Error("ai-config.json not found");
    }

    logSentenceEvalDebug(cfg, "input", {
      requestId: String(payload?.requestId || "").trim(),
      zhPrompt: String(payload?.zhPrompt || ""),
      targetWord: String(payload?.targetWord || ""),
      targetWords: Array.isArray(payload?.targetWords) ? payload.targetWords : [],
      referenceEn: String(payload?.referenceEn || ""),
      userAnswer: String(payload?.userAnswer || ""),
    });

    const baseSystemPrompt = [
      "你是中文学习者的英文写作评估助手。",
      "给定中文题干、目标词和用户英文句子，只输出严格 JSON。",
      "JSON 格式:",
      "{",
      '  "ok": boolean,',
      '  "score": number,',
      '  "analysis": string,',
      '  "correctAnswer": string,',
      '  "revision": string',
      "}",
      "规则:",
      "- 仅当句子语法正确、表达自然且合理包含所有给定的目标词/短语时，ok=true。",
      "- score 范围 0-100。",
      "- analysis 必须只用中文，直接列出语法错误、用词不当、不自然或不合理之处，并给出修正意见。每条编号内容必须独占一行。不要出现任何英文前言、解释套话或标签文本。",
      "- correctAnswer 给出标准答案英文句。",
      "- revision 给出按用户原意修正后的英文句。",
      "- 不要输出 Let me analyze、User's sentence、Target word、Issues 等任何英文说明。",
      "- 不要输出任何解释性段落、列表或额外文本。",
    ].join("\n");

    const userPayload = {
      zhPrompt: payload?.zhPrompt || "",
      targetWord: payload?.targetWord || "",
      targetWords: Array.isArray(payload?.targetWords) ? payload.targetWords : [],
      referenceEn: payload?.referenceEn || "",
      userAnswer: payload?.userAnswer || "",
    };

    let lastModel = "";

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const systemPrompt = attempt === 0
        ? baseSystemPrompt
        : `${baseSystemPrompt}\n- 上一次输出不合格。这一次 analysis 必须是纯中文，correctAnswer 和 revision 必须都是非空英文句子。`;

      const { parsed, rawContent, model } = await requestJsonFromModel({
        systemPrompt,
        userPayload,
        temperature: Number(attempt === 0 ? (cfg.temperature ?? 0.3) : 0.2),
        // Reasoning-capable models may consume part of this budget before emitting
        // the JSON. A short budget truncates the JSON after its analysis field.
        maxTokens: Math.max(Number(cfg.maxTokensSentenceEval ?? cfg.maxTokens ?? 500), 1400),
        allowRawOnParseFailure: true,
        onStreamText: attempt === 0 && typeof options?.onStreamText === "function" ? options.onStreamText : null,
      });

      lastModel = model;

      logSentenceEvalDebug(cfg, `attempt-${attempt + 1}-model-response`, {
        model,
        parsed,
        rawContent,
      });

      const evaluationParsed = parseSentenceEvaluationResponse(rawContent, parsed);
      let normalized = isSentenceEvalResponseShape(evaluationParsed) ? evaluationParsed : null;
      if (!normalized) {
        normalized = parseEvaluationFromLooseText(rawContent);
      }

      logSentenceEvalDebug(cfg, `attempt-${attempt + 1}-normalized`, {
        normalized,
      });

      if (!normalized || typeof normalized !== "object") {
        logSentenceEvalDebug(cfg, `attempt-${attempt + 1}-skip`, {
          reason: "normalized is empty or invalid",
        });
        continue;
      }

      // Do not turn a truncated reasoning trace into a result. In particular,
      // a partial `"analysis": "...` fragment used to hide the first error and
      // could make prose such as "Let me settle on 15" appear as an answer.
      if (!hasCompleteSentenceEvaluationJson(evaluationParsed)) {
        logSentenceEvalDebug(cfg, `attempt-${attempt + 1}-skip`, {
          reason: "model response is not a complete sentence-evaluation JSON object",
        });
        continue;
      }

      const looseParsed = parseEvaluationFromLooseText(rawContent);
      let analysis = pickBetterChineseAnalysis(
        normalized.analysis || normalized.feedback || "",
        looseParsed?.analysis || ""
      );
      let correctAnswer = sanitizeSentenceEvalField(
        normalized.correctAnswer || looseParsed?.correctAnswer || normalized.betterSentence || payload?.referenceEn || ""
      );
      let revision = sanitizeSentenceEvalField(
        normalized.revision || looseParsed?.revision || normalized.betterSentence || ""
      );

      correctAnswer = sanitizeSentenceAnswerCandidate(correctAnswer);
      revision = sanitizeSentenceAnswerCandidate(revision);

      if ((!correctAnswer || isEnglishAnalysisLine(correctAnswer)) && revision) {
        correctAnswer = revision;
      }

      if (isEnglishAnalysisLine(correctAnswer)) {
        correctAnswer = "";
      }

      if (!isLikelyEnglishAnswerSentence(correctAnswer)) {
        correctAnswer = "";
      }

      if (!isLikelyEnglishAnswerSentence(revision)) {
        revision = "";
      }

      if (!correctAnswer || !revision) {
        const rawCandidates = extractEnglishAnswerCandidatesFromRaw(rawContent);
        if (!revision) {
          revision = rawCandidates[0] || "";
        }
        if (!correctAnswer) {
          correctAnswer = rawCandidates[1] || rawCandidates[0] || "";
        }
      }

      if (!correctAnswer && revision) {
        correctAnswer = revision;
      }

      if (!revision && correctAnswer && !Boolean(normalized.ok)) {
        revision = correctAnswer;
      }

      if (!isUsableSentenceEvaluationResult({ analysis, correctAnswer, revision })) {
        logSentenceEvalDebug(cfg, `attempt-${attempt + 1}-skip`, {
          reason: "result is not usable",
          analysis,
          correctAnswer,
          revision,
        });
        continue;
      }

      if (looksLikeMetaEnglishAnalysis(analysis)) {
        analysis = "请参考下方修正与正确答案。";
      }

      logSentenceEvalDebug(cfg, `attempt-${attempt + 1}-final`, {
        ok: typeof normalized.ok === "boolean" ? normalized.ok : Boolean(normalized.ok),
        score: Number(normalized.score || 0),
        analysis,
        correctAnswer,
        revision,
        model,
      });

      return {
        ok: typeof normalized.ok === "boolean" ? normalized.ok : Boolean(normalized.ok),
        score: Number(normalized.score || 0),
        analysis,
        correctAnswer,
        revision,
        feedback: analysis,
        betterSentence: revision,
        model,
      };
    }

    logSentenceEvalDebug(cfg, "fallback-parseFailed", {
      model: lastModel,
      reason: "no usable output after retries",
    });

    return {
      ok: false,
      score: 0,
      analysis: "模型这次没有给出可用的分析或标准答案，请重试。",
      correctAnswer: String(payload?.referenceEn || ""),
      revision: "",
      feedback: "模型这次没有给出可用的分析或标准答案，请重试。",
      betterSentence: "",
      model: lastModel,
      parseFailed: true,
    };
  }

  async function generateSentencePromptViaModel(payload, options = {}) {
    const cfg = readAiConfig();
    if (!cfg) {
      throw new Error("ai-config.json not found");
    }

    logSentenceEvalDebug(cfg, "prompt-input", {
      requestId: String(payload?.requestId || "").trim(),
      targetWord: String(payload?.targetWord || ""),
      targetWords: Array.isArray(payload?.targetWords) ? payload.targetWords : [],
      targetMeaning: String(payload?.targetMeaning || ""),
      targetMeanings: Array.isArray(payload?.targetMeanings) ? payload.targetMeanings : [],
      difficulty: String(payload?.difficulty || ""),
      sentencePattern: String(payload?.sentencePattern || ""),
    });

    const apiKey = String(cfg.apiKey || "").trim();
    if (!apiKey || apiKey === "YOUR_API_KEY_HERE") {
      throw new Error("apiKey is not configured");
    }

    const url = resolveChatCompletionsUrl(cfg);
    if (!url) {
      throw new Error("baseUrl is not configured");
    }

    const difficulty = normalizeSentenceDifficulty(payload?.difficulty);
    const diffSpec = difficultySpec(difficulty);

    const targetWords = Array.isArray(payload?.targetWords)
      ? payload.targetWords.map((word) => String(word || "").trim()).filter(Boolean)
      : String(payload?.targetWord || "").trim()
        ? [String(payload.targetWord).trim()]
        : [];
    const targetMeanings = Array.isArray(payload?.targetMeanings)
      ? payload.targetMeanings.map((meaning) => String(meaning || "").trim()).filter(Boolean)
      : String(payload?.targetMeaning || "").trim()
        ? [String(payload.targetMeaning).trim()]
        : [];

    const systemPrompt = String(cfg.sentenceSystemPrompt || [
      "你是雅思英文写作练习出题助手。",
      "你的任务是给中国学习者提供一个用于英译的中文句子或短段落。",
      "严格要求:",
      "1) 只输出严格 JSON。",
      "2) JSON 格式: { \"zhPrompt\": string, \"referenceEn\": string, \"targetWords\": string[], \"targetMeanings\": string[] }。",
      "3) 输出必须以 { 开始、以 } 结束；不要展示思考过程、方案、字数统计或解释。",
      "4) zhPrompt 只放题目正文，不要解释，不要编号，不要引号，不要附加说明。",
      "5) 句子自然通顺，难度在雅思范围。",
      "6) referenceEn 必须自然、完整地包含每一个给定的目标词或短语，不能遗漏或用同义词替换；为符合语法可使用词形变化，例如 possess 可写为 possesses。",
      `7) 难度要求: ${diffSpec}`,
      "8) 题目可以稍长，尤其是目标词较多时。",
      "9) 必须遵守输入指定的句型要求；除非指定转折/让步句，否则不得使用 although、though、despite、while 等转折或让步结构。",
    ].join("\n")).trim();

    const userPrompt = String(cfg.sentenceUserPromptTemplate || [
      "请给出一个中文句子或短段落让用户翻译成英文（雅思难度）。",
      "难度级别: {{difficulty}}",
      "难度说明: {{difficultySpec}}",
      "目标词: {{targetWord}}",
      "目标词列表: {{targetWords}}",
      "中文释义: {{targetMeaning}}",
      "中文释义列表: {{targetMeanings}}",
      "指定句型: {{sentencePattern}}",
      "句型要求: {{sentencePatternInstruction}}",
      "仅输出上述 JSON。",
    ].join("\n"))
      .replace(/{{\s*difficulty\s*}}/g, difficulty)
      .replace(/{{\s*difficultySpec\s*}}/g, diffSpec)
      .replace(/{{\s*targetWord\s*}}/g, String(payload?.targetWord || ""))
      .replace(/{{\s*targetWords\s*}}/g, targetWords.join(" / "))
      .replace(/{{\s*targetMeaning\s*}}/g, String(payload?.targetMeaning || ""))
      .replace(/{{\s*targetMeanings\s*}}/g, targetMeanings.join(" / "))
      .replace(/{{\s*sentencePattern\s*}}/g, String(payload?.sentencePattern || ""))
      .replace(/{{\s*sentencePatternInstruction\s*}}/g, String(payload?.sentencePatternInstruction || ""));

    const configuredMaxTokens = Number(cfg.maxTokensPrompt ?? cfg.maxTokens ?? 320);
    const maxTokens = Math.max(configuredMaxTokens, 1200);
    let lastModel = "";

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const retryInstruction = attempt === 0
        ? systemPrompt
        : `${systemPrompt}\n上一次输出不完整。现在立刻只返回完整 JSON，不要思考过程或任何额外文字。`;
      const { parsed, rawContent, model } = await requestJsonFromModel({
        systemPrompt: retryInstruction,
        userPayload: userPrompt,
        temperature: Number(attempt === 0 ? (cfg.temperature ?? 0.3) : 0.2),
        maxTokens,
        allowRawOnParseFailure: true,
        onStreamText: attempt === 0 && typeof options?.onStreamText === "function" ? options.onStreamText : null,
      });

      lastModel = model;
      logSentenceEvalDebug(cfg, `prompt-attempt-${attempt + 1}-model-response`, {
        model,
        parsed,
        rawContent,
      });

      const zhPrompt = sanitizeSentenceZhPrompt(parsed?.zhPrompt || "");
      const referenceEn = String(parsed?.referenceEn || "").trim();
      const isCleanPrompt = zhPrompt
        && /[\u4e00-\u9fff]/.test(zhPrompt)
        && !/(?:^|\s)(?:方案\d*|让我|字数|目标词|referenceEn|json)\s*[:：]/i.test(zhPrompt);
      const isValidReference = isLikelyEnglishAnswerSentence(referenceEn);
      const includesAllTargets = containsAllTargetWords(referenceEn, targetWords);

      logSentenceEvalDebug(cfg, `prompt-attempt-${attempt + 1}-validated`, {
        zhPrompt,
        referenceEn,
        isCleanPrompt,
        isValidReference,
        includesAllTargets,
      });

      if (!isCleanPrompt || !isValidReference || !includesAllTargets) {
        continue;
      }

      logSentenceEvalDebug(cfg, "prompt-final", {
        zhPrompt,
        referenceEn,
        difficulty,
        model,
      });

      return {
        zhPrompt,
        referenceEn,
        difficulty,
        model,
        source: "model",
      };
    }

    throw new Error(`Sentence generation returned incomplete JSON after retry (model: ${lastModel || "unknown"}).`);
  }

  async function translateSentenceToChineseViaModel(payload, options = {}) {
    const enSentence = String(payload?.enSentence || "").trim();
    if (!enSentence) {
      throw new Error("enSentence is required");
    }

    const systemPrompt = [
      "你是专业英译中助手。",
      "把用户输入的英文句子翻译成自然、简洁、准确的中文。",
      "只输出 JSON，格式如下:",
      "{",
      '  "zhText": string',
      "}",
      "规则:",
      "1) 不要解释，不要额外说明。",
      "2) 保留原句语气和时态。",
      "3) 仅返回一条中文翻译。",
    ].join("\n");

    const { parsed, rawContent, model } = await requestJsonFromModel({
      systemPrompt,
      userPayload: { enSentence },
      temperature: 0.2,
      maxTokens: 240,
      allowRawOnParseFailure: true,
      onStreamText: typeof options?.onStreamText === "function" ? options.onStreamText : null,
    });

    let zhText = "";
    if (parsed && typeof parsed === "object") {
      zhText = normalizeChineseTranslation(parsed.zhText);
    }
    if (!zhText) {
      zhText = normalizeChineseTranslation(rawContent);
    }
    if (!zhText || !/[\u4e00-\u9fff]/.test(zhText)) {
      throw new Error("No valid Chinese translation from model response");
    }

    return {
      zhText,
      model,
    };
  }

  async function getWordDetailsViaModel(payload, options = {}) {
    const cfg = readAiConfig();
    if (!cfg) {
      throw new Error("ai-config.json not found");
    }

    const apiKey = String(cfg.apiKey || "").trim();
    if (!apiKey || apiKey === "YOUR_API_KEY_HERE") {
      throw new Error("apiKey is not configured");
    }

    const url = resolveChatCompletionsUrl(cfg);
    if (!url) {
      throw new Error("baseUrl is not configured");
    }

    const systemPrompt = [
      "你是英语词汇教学助手。",
      "给定英文单词和已有中文释义，请输出严格 JSON。",
      "JSON 格式:",
      "{",
      '  "word": string,',
      '  "phonetic": string,',
      '  "meanings": [{"pos": string, "zh": string}],',
      '  "examplesByPos": [{"pos": string, "examples": [{"en": string, "zh": string}]}]',
      "}",
      "规则:",
      "1) meanings 至少 1 条，按常见词性给出精炼中文释义。",
      "2) 每个词性的 examples 必须给出 3 条英文例句，并提供中文翻译。",
      "3) 仅输出 JSON，不要 Markdown，不要解释。",
    ].join("\n");

    const userPrompt = JSON.stringify({
      word: String(payload?.word || "").trim(),
      knownMeaning: String(payload?.knownMeaning || "").trim(),
    }, null, 2);

    const { parsed, model } = await requestJsonFromModel({
      systemPrompt,
      userPayload: userPrompt,
      temperature: Number(cfg.temperature ?? 0.4),
      maxTokens: Number(cfg.maxTokensWordDetail ?? cfg.maxTokens ?? 1200),
      onStreamText: typeof options?.onStreamText === "function" ? options.onStreamText : null,
    });

    if (!parsed || typeof parsed !== "object") {
      throw new Error("Word detail response is not valid JSON");
    }

    const meanings = Array.isArray(parsed.meanings)
      ? parsed.meanings.map((m) => ({
        pos: String(m?.pos || "").trim(),
        zh: String(m?.zh || "").trim(),
      })).filter((m) => m.pos && m.zh)
      : [];

    const examplesByPos = Array.isArray(parsed.examplesByPos)
      ? parsed.examplesByPos.map((block) => ({
        pos: String(block?.pos || "").trim(),
        examples: Array.isArray(block?.examples)
          ? block.examples.map((x) => ({
            en: String(x?.en || "").trim(),
            zh: String(x?.zh || "").trim(),
          })).filter((x) => x.en && x.zh).slice(0, 3)
          : [],
      })).filter((block) => block.pos && block.examples.length)
      : [];

    if (!meanings.length) {
      throw new Error("Word detail is missing meanings");
    }

    return {
      word: String(parsed.word || payload?.word || "").trim(),
      phonetic: String(parsed.phonetic || "").trim(),
      meanings,
      examplesByPos,
      model,
    };
  }

  async function generateExamplesViaModel(payload, options = {}) {
    const word = String(payload?.word || "").trim();
    if (!word) {
      throw new Error("word is required");
    }

    const systemPrompt = [
      "你是英语词汇教学助手。",
      "给定英文单词与中文释义，输出严格 JSON。",
      "JSON 格式:",
      "{",
      '  "phonetic": string,',
      '  "definitions": [{"pos": string, "def": string}],',
      '  "examples": string[]',
      "}",
      "规则:",
      "1) definitions 给 3-8 条英文释义，尽量覆盖常见词性。",
      "2) examples 给 3 条自然完整英文句子。",
      "3) examples 不能是短语或片段，必须是完整句。",
      "4) 仅输出 JSON，不要 Markdown，不要解释。",
    ].join("\n");

    const { parsed, model } = await requestJsonFromModel({
      systemPrompt,
      userPayload: {
        word,
        knownMeaning: String(payload?.knownMeaning || "").trim(),
      },
      temperature: 0.45,
      maxTokens: 1200,
      onStreamText: typeof options?.onStreamText === "function" ? options.onStreamText : null,
    });

    const definitions = Array.isArray(parsed.definitions)
      ? parsed.definitions
        .map((x) => ({
          pos: String(x?.pos || "").trim(),
          def: String(x?.def || "").trim(),
        }))
        .filter((x) => x.def)
        .slice(0, 8)
      : [];

    const examples = Array.isArray(parsed.examples)
      ? parsed.examples
        .map((x) => String(x || "").trim())
        .filter(Boolean)
        .slice(0, 3)
      : [];

    if (!definitions.length) {
      throw new Error("Model examples response missing definitions");
    }
    if (!examples.length) {
      throw new Error("Model examples response missing examples");
    }

    return {
      phonetic: String(parsed.phonetic || "").trim(),
      definitions,
      examples,
      model,
      source: "model",
    };
  }

  async function requestJsonFromModel({
    systemPrompt,
    userPayload,
    temperature = 0.4,
    maxTokens = 1200,
    allowRawOnParseFailure = false,
    onStreamText = null,
  }) {
    const cfg = readAiConfig();
    if (!cfg) {
      throw new Error("ai-config.json not found");
    }

    const apiKey = String(cfg.apiKey || "").trim();
    if (!apiKey || apiKey === "YOUR_API_KEY_HERE") {
      throw new Error("apiKey is not configured");
    }

    const url = resolveChatCompletionsUrl(cfg);
    if (!url) {
      throw new Error("baseUrl is not configured");
    }

    const userContent = typeof userPayload === "string"
      ? userPayload
      : JSON.stringify(userPayload || {}, null, 2);

    const body = {
      model: cfg.model || "qwen-3.8-27b",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: Number(temperature),
      max_tokens: Number(maxTokens),
    };

    const isStreamRequest = typeof onStreamText === "function";

    if (isStreamRequest) {
      body.stream = true;
    }

    if (cfg.reasoningEffort) {
      body.reasoning_effort = cfg.reasoningEffort;
    }

    const baseTimeoutMs = Number(cfg.timeoutMs || 30000);
    let resp;
    let lastErr = null;

    // First model call can be cold-start slow; retry once on AbortError.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const timeoutMs = Math.round(baseTimeoutMs * (attempt === 0 ? 1 : 1.8));
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        const name = String(err?.name || "");
        const isAbort = name === "AbortError";
        if (!isAbort || attempt >= 1) {
          throw err;
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    if (!resp) {
      throw lastErr || new Error("Model request failed");
    }

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`API ${resp.status}: ${txt.slice(0, 280)}`);
    }

    let content = "";
    let rawResponseText = "";
    let responseModel = body.model;

    if (isStreamRequest && resp.body) {
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = "";
      let raw = "";

      const consumeEventBlock = (eventBlock) => {
        const lines = String(eventBlock || "")
          .split(/\r?\n/)
          .map((x) => x.trim())
          .filter((x) => x.startsWith("data:"));

        for (const line of lines) {
          const dataLine = line.slice(5).trim();
          if (!dataLine || dataLine === "[DONE]") continue;

          try {
            const piece = JSON.parse(dataLine);
            if (typeof piece?.model === "string" && piece.model.trim()) {
              responseModel = piece.model.trim();
            }
            const delta = extractDeltaText(piece?.choices?.[0]?.delta);
            if (!delta) continue;
            content += delta;
            onStreamText(delta, content);
          } catch {
            // Ignore non-JSON chunks in SSE stream.
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        raw += chunk;
        sseBuffer += chunk;

        const chunks = sseBuffer.split(/\r?\n\r?\n/);
        sseBuffer = chunks.pop() || "";
        for (const block of chunks) {
          consumeEventBlock(block);
        }
      }

      const tail = decoder.decode();
      if (tail) {
        raw += tail;
        sseBuffer += tail;
      }
      if (sseBuffer.trim()) {
        consumeEventBlock(sseBuffer);
      }

      if (!content.trim()) {
        try {
          const data = JSON.parse(raw);
          const message = data?.choices?.[0]?.message;
          content = extractMessageText(message);
          if (typeof data?.model === "string" && data.model.trim()) {
            responseModel = data.model.trim();
          }
        } catch {
          content = String(raw || "").trim();
        }
      }
      rawResponseText = String(raw || content || "").trim();
    } else {
      const data = await resp.json();
      const message = data?.choices?.[0]?.message;
      content = extractMessageText(message);
      if (typeof data?.model === "string" && data.model.trim()) {
        responseModel = data.model.trim();
      }
      rawResponseText = JSON.stringify(data);
    }

    if (!content) {
      throw new Error("Empty model response");
    }

    let parsed = parseFirstJsonObject(content);
    if ((!parsed || typeof parsed !== "object") && !isStreamRequest && rawResponseText && rawResponseText !== content) {
      parsed = parseFirstJsonObject(rawResponseText);
    }
    if (!parsed || typeof parsed !== "object") {
      if (allowRawOnParseFailure) {
        return {
          parsed: null,
          rawContent: content || rawResponseText,
          model: responseModel,
        };
      }
      throw new Error("Model response is not valid JSON");
    }

    return {
      parsed,
      rawContent: content,
      model: responseModel,
    };
  }

  async function compareWordsViaModel(payload, options = {}) {
    const words = Array.isArray(payload?.words) ? payload.words : [];
    if (words.length < 2) {
      throw new Error("At least 2 words are required for comparison");
    }

    const systemPrompt = [
      "你是英语词汇对比讲解助手。",
      "请比较多个英文词的差异，给中国学习者清晰解释。",
      "只输出 JSON，格式如下:",
      "{",
      '  "summary": string,',
      '  "items": [{"word": string, "coreMeaning": string, "difference": string, "examples": [{"en": string, "zh": string}]}],',
      '  "pairwise": [{"pair": string, "difference": string}]',
      "}",
      "规则:",
      "1) items 覆盖输入中的每个词。",
      "2) 每个词给 2 条例句，含中译。",
      "3) pairwise 至少给 2 组差异。",
    ].join("\n");

    const { parsed, model } = await requestJsonFromModel({
      systemPrompt,
      userPayload: { words },
      temperature: 0.4,
      maxTokens: 1800,
      onStreamText: typeof options?.onStreamText === "function" ? options.onStreamText : null,
    });

    const items = Array.isArray(parsed.items)
      ? parsed.items.map((x) => ({
        word: String(x?.word || "").trim(),
        coreMeaning: String(x?.coreMeaning || "").trim(),
        difference: String(x?.difference || "").trim(),
        examples: Array.isArray(x?.examples)
          ? x.examples.map((e) => ({
            en: String(e?.en || "").trim(),
            zh: String(e?.zh || "").trim(),
          })).filter((e) => e.en)
          : [],
      })).filter((x) => x.word)
      : [];

    const pairwise = Array.isArray(parsed.pairwise)
      ? parsed.pairwise.map((x) => ({
        pair: String(x?.pair || "").trim(),
        difference: String(x?.difference || "").trim(),
      })).filter((x) => x.pair && x.difference)
      : [];

    return {
      summary: String(parsed.summary || "").trim(),
      items,
      pairwise,
      model,
    };
  }

  async function analyzeSynonymsViaModel(payload, options = {}) {
    const word = String(payload?.word || "").trim();
    if (!word) {
      throw new Error("word is required");
    }

    const systemPrompt = [
      "你是英语近义词辨析助手。",
      "给定目标词，输出常见近义词并解释差异。",
      "只输出 JSON，格式如下:",
      "{",
      '  "word": string,',
      '  "summary": string,',
      '  "baseExamples": [{"en": string, "zh": string}],',
      '  "synonyms": [{"word": string, "difference": string, "examples": [{"en": string, "zh": string}]}]',
      "}",
      "规则:",
      "1) 给出 3-4 个近义词，最多 4 个。",
      "2) baseExamples 给目标词 2 条例句，含中译。",
      "3) 每个近义词给 1-2 个例句，含中译。",
      "4) difference 用简洁中文，强调使用场景差异。",
    ].join("\n");

    const { parsed, rawContent, model } = await requestJsonFromModel({
      systemPrompt,
      userPayload: {
        word,
        knownMeaning: String(payload?.knownMeaning || "").trim(),
      },
      temperature: 0.45,
      maxTokens: 1600,
      allowRawOnParseFailure: true,
      onStreamText: typeof options?.onStreamText === "function" ? options.onStreamText : null,
    });

    const normalized = parsed && typeof parsed === "object"
      ? parsed
      : parseSynonymsFromLooseText(rawContent, word);

    if (!normalized || typeof normalized !== "object") {
      throw new Error("Synonym response format is invalid");
    }

    const baseExamples = Array.isArray(normalized.baseExamples)
      ? normalized.baseExamples.map((e) => ({
        en: String(e?.en || "").trim(),
        zh: String(e?.zh || "").trim(),
      })).filter((e) => e.en).slice(0, 2)
      : [];

    const synonyms = Array.isArray(normalized.synonyms)
      ? normalized.synonyms.map((x) => ({
        word: String(x?.word || "").trim(),
        difference: String(x?.difference || "").trim(),
        examples: Array.isArray(x?.examples)
          ? x.examples.map((e) => ({
            en: String(e?.en || "").trim(),
            zh: String(e?.zh || "").trim(),
          })).filter((e) => e.en)
          : [],
      })).filter((x) => x.word).slice(0, 4)
      : [];

    if (!synonyms.length) {
      throw new Error("Synonym response format is invalid");
    }

    return {
      word: String(normalized.word || word).trim(),
      summary: String(normalized.summary || "").trim(),
      baseExamples,
      synonyms,
      model,
    };
  }

  return {
    resolveAiConfigPath,
    readAiConfig,
    evaluateSentenceViaModel,
    generateSentencePromptViaModel,
    translateSentenceToChineseViaModel,
    generateExamplesViaModel,
    getWordDetailsViaModel,
    compareWordsViaModel,
    analyzeSynonymsViaModel,
  };
}

module.exports = {
  createAiService,
};