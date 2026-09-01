(function registerSearchUtils(globalScope) {
  function normalizeForFuzzy(text) {
    return String(text || "").toLowerCase().trim();
  }

  function isSubsequence(needle, hay) {
    if (!needle || !hay) return false;
    let i = 0;
    let j = 0;
    while (i < needle.length && j < hay.length) {
      if (needle[i] === hay[j]) i += 1;
      j += 1;
    }
    return i === needle.length;
  }

  function levenshteinAtMost(a, b, maxDistance) {
    const aa = normalizeForFuzzy(a);
    const bb = normalizeForFuzzy(b);
    if (Math.abs(aa.length - bb.length) > maxDistance) return maxDistance + 1;

    const dp = new Array(bb.length + 1);
    for (let j = 0; j <= bb.length; j += 1) dp[j] = j;

    for (let i = 1; i <= aa.length; i += 1) {
      let prev = dp[0];
      dp[0] = i;
      let rowMin = dp[0];

      for (let j = 1; j <= bb.length; j += 1) {
        const temp = dp[j];
        const cost = aa[i - 1] === bb[j - 1] ? 0 : 1;
        dp[j] = Math.min(
          dp[j] + 1,
          dp[j - 1] + 1,
          prev + cost
        );
        prev = temp;
        if (dp[j] < rowMin) rowMin = dp[j];
      }

      if (rowMin > maxDistance) return maxDistance + 1;
    }

    return dp[bb.length];
  }

  function fuzzyScore(query, text) {
    const q = normalizeForFuzzy(query);
    const t = normalizeForFuzzy(text);
    if (!q || !t) return 0;
    if (t.startsWith(q)) return 100 - Math.min(20, t.length - q.length);

    const idx = t.indexOf(q);
    if (idx >= 0) return 85 - Math.min(30, idx);

    if (q.length >= 3) {
      const target = t.slice(0, Math.min(t.length, q.length + 2));
      const dist = levenshteinAtMost(q, target, 1);
      if (dist <= 1) return 70;
    }

    if (isSubsequence(q, t)) return 55;
    return 0;
  }

  function buildSuggestItems({ query, words, tags, truncateText, toTagKey }) {
    const items = [];
    const seen = new Set();

    for (const word of words) {
      const scoreEn = fuzzyScore(query, word.en);
      const scoreZh = fuzzyScore(query, word.zh);
      const score = Math.max(scoreEn, scoreZh);
      if (score <= 0) continue;

      const key = `word:${word.id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      items.push({
        type: "word",
        label: word.en,
        sub: truncateText(word.zh, 40),
        value: word.en,
        score,
      });
    }

    for (const tag of tags) {
      const score = fuzzyScore(query, tag);
      if (score <= 0) continue;

      const key = `tag:${toTagKey(tag)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      items.push({
        type: "tag",
        label: tag,
        sub: "Tag",
        value: tag,
        score: score + 2,
      });
    }

    items.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, "zh-CN"));
    return items.slice(0, 10);
  }

  globalScope.EnWordSearchUtils = {
    buildSuggestItems,
  };
})(window);
