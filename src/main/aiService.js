const fs = require("node:fs");
const path = require("node:path");

function createAiService({ appRoot }) {
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

    const scoreMatch = compact.match(/(?:score|评分)\s*[:：]?\s*(\d{1,3})/i);
    const score = scoreMatch ? Number(scoreMatch[1]) : 0;

    const okByWord = /\b(ok|correct|acceptable|good)\b/i.test(compact)
      || /可接受|正确|符合|通过/.test(compact);
    const badByWord = /\b(wrong|incorrect|bad|fail)\b/i.test(compact)
      || /错误|不自然|不通过|不符合/.test(compact);
    const ok = badByWord ? false : okByWord;

    const betterMatch = raw.match(/(?:betterSentence|参考改写|改写)\s*[:：]\s*([^\n]+)/i);
    const betterSentence = betterMatch ? String(betterMatch[1]).trim() : "";

    const feedback = compact.slice(0, 180);

    return {
      ok,
      score: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0,
      feedback,
      betterSentence,
    };
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
      .find((x) => /[\u4e00-\u9fff]/.test(x) && !/^```/.test(x));

    const target = line || raw;
    const cleaned = target
      .replace(/^请翻译(?:以下)?中文句子[:：]?\s*/i, "")
      .replace(/^中文短句[:：]?\s*/, "")
      .replace(/^[-*\d.\s>]+/, "")
      .replace(/["“”]/g, "")
      .trim();

    return cleaned;
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
    ];
    return markers.some((m) => lower.includes(m));
  }

  function extractBestZhPrompt(text) {
    const raw = String(text || "").trim();
    if (!raw) return "";

    const cleanedLines = raw
      .split(/\r?\n/)
      .map((x) => normalizeZhPrompt(x))
      .filter((x) => /[\u4e00-\u9fff]/.test(x));

    const direct = cleanedLines.find((x) => {
      if (isInstructionLikeChineseLine(x)) return false;
      return /[。！？]$/.test(x) && x.length >= 4 && x.length <= 40;
    });
    if (direct) return direct;

    const inText = raw.match(/[\u4e00-\u9fff][\u4e00-\u9fff，、；：\s]{3,60}[。！？]/g) || [];
    const fallback = inText
      .map((x) => normalizeZhPrompt(x))
      .find((x) => x && !isInstructionLikeChineseLine(x));
    if (fallback) return fallback;

    const loose = cleanedLines.find((x) => x && !isInstructionLikeChineseLine(x));
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

    const systemPrompt = [
      "你是中文学习者的英文写作评估助手。",
      "给定中文题干、目标词和用户英文句子，只输出严格 JSON。",
      "JSON 格式:",
      "{",
      '  "ok": boolean,',
      '  "score": number,',
      '  "feedback": string,',
      '  "betterSentence": string',
      "}",
      "规则:",
      "- 仅当句子语法正确、表达自然且合理包含目标词/短语时，ok=true。",
      "- score 范围 0-100。",
      "- feedback 用简洁中文。",
      "- betterSentence 给出简洁、自然的改写英文句。",
    ].join("\n");

    const userPayload = {
      zhPrompt: payload?.zhPrompt || "",
      targetWord: payload?.targetWord || "",
      referenceEn: payload?.referenceEn || "",
      userAnswer: payload?.userAnswer || "",
    };

    const { parsed, rawContent, model } = await requestJsonFromModel({
      systemPrompt,
      userPayload,
      temperature: Number(cfg.temperature ?? 0.3),
      maxTokens: Number(cfg.maxTokens ?? 500),
      allowRawOnParseFailure: true,
      onStreamText: typeof options?.onStreamText === "function" ? options.onStreamText : null,
    });

    let normalized = parsed;
    if (!normalized || typeof normalized !== "object") {
      normalized = parseEvaluationFromLooseText(rawContent);
    }

    if (!normalized || typeof normalized !== "object") {
      return {
        ok: false,
        score: 0,
        feedback: "模型返回格式不稳定，已回退本地判分。",
        betterSentence: "",
        model,
        parseFailed: true,
      };
    }

    return {
      ok: typeof normalized.ok === "boolean" ? normalized.ok : Boolean(normalized.ok),
      score: Number(normalized.score || 0),
      feedback: String(normalized.feedback || ""),
      betterSentence: String(normalized.betterSentence || ""),
      model,
    };
  }

  async function generateSentencePromptViaModel(payload, options = {}) {
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

    const difficulty = normalizeSentenceDifficulty(payload?.difficulty);
    const diffSpec = difficultySpec(difficulty);

    const systemPrompt = String(cfg.sentenceSystemPrompt || [
      "你是雅思英文写作练习出题助手。",
      "你的任务是给中国学习者提供一个用于英译的中文短句。",
      "严格要求:",
      "1) 只输出一句中文句子。",
      "2) 不要解释，不要 Markdown，不要编号，不要引号。",
      "3) 句子自然通顺，难度在雅思范围。",
      "4) 尽量自然包含目标词对应的语义。",
      `5) 难度要求: ${diffSpec}`,
      "6) 严格遵守长度要求，尤其是初级题目。",
    ].join("\n")).trim();

    const userPrompt = String(cfg.sentenceUserPromptTemplate || [
      "请给出一个中文短句让用户翻译成英文（雅思难度）。",
      "难度级别: {{difficulty}}",
      "难度说明: {{difficultySpec}}",
      "目标词: {{targetWord}}",
      "中文释义: {{targetMeaning}}",
      "仅输出一句中文短句。",
    ].join("\n"))
      .replace(/{{\s*difficulty\s*}}/g, difficulty)
      .replace(/{{\s*difficultySpec\s*}}/g, diffSpec)
      .replace(/{{\s*targetWord\s*}}/g, String(payload?.targetWord || ""))
      .replace(/{{\s*targetMeaning\s*}}/g, String(payload?.targetMeaning || ""));

    const { rawContent, model } = await requestJsonFromModel({
      systemPrompt,
      userPayload: userPrompt,
      temperature: Number(cfg.temperature ?? 0.6),
      maxTokens: Number(cfg.maxTokensPrompt ?? cfg.maxTokens ?? 320),
      allowRawOnParseFailure: true,
      onStreamText: typeof options?.onStreamText === "function" ? options.onStreamText : null,
    });

    const rawText = String(rawContent || "").trim();
    const fromReasoning = rawText;

    let zhPrompt = extractBestZhPrompt(rawText);
    if (!zhPrompt || !/[\u4e00-\u9fff]/.test(zhPrompt)) {
      zhPrompt = normalizeZhPrompt(rawText);
    }
    if (!zhPrompt || !/[\u4e00-\u9fff]/.test(zhPrompt)) {
      zhPrompt = findChineseSentence(fromReasoning || rawText);
    }

    if (!zhPrompt) {
      throw new Error("No valid Chinese prompt from model response");
    }

    const referenceEn = String(payload?.targetWord || "").trim()
      ? `Please include "${String(payload.targetWord).trim()}" naturally in your translation.`
      : "";

    return {
      zhPrompt,
      referenceEn,
      difficulty,
      model,
      source: "model",
    };
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

    if (typeof onStreamText === "function") {
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
    let responseModel = body.model;

    if (typeof onStreamText === "function" && resp.body) {
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
    } else {
      const data = await resp.json();
      const message = data?.choices?.[0]?.message;
      content = extractMessageText(message);
      if (typeof data?.model === "string" && data.model.trim()) {
        responseModel = data.model.trim();
      }
    }

    if (!content) {
      throw new Error("Empty model response");
    }

    const parsed = parseFirstJsonObject(content);
    if (!parsed || typeof parsed !== "object") {
      if (allowRawOnParseFailure) {
        return {
          parsed: null,
          rawContent: content,
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