(function registerDetailPanels(globalScope) {
  function buildFavoriteExampleRow(ex, fallbackZh, onFavoriteExample) {
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

    const actionRow = document.createElement("div");
    actionRow.className = "detail-example-actions";

    const favBtn = document.createElement("button");
    favBtn.type = "button";
    favBtn.className = "search-item-tag-btn detail-fav-btn";
    favBtn.textContent = "Favorite";
    favBtn.addEventListener("click", async () => {
      const zhText = String(ex.zh || fallbackZh || "Example sentence").trim();
      const enText = String(ex.en || "").trim();
      if (!enText) return;

      try {
        await onFavoriteExample({ zhText, enText });
        favBtn.textContent = "Saved";
        favBtn.disabled = true;
      } catch (err) {
        favBtn.textContent = "Failed";
        favBtn.title = String(err?.message || "Favorite failed");
      }
    });

    actionRow.appendChild(favBtn);
    li.appendChild(actionRow);
    return li;
  }

  function renderCompareResultPanel(result, onFavoriteExample, onFavoriteCompare) {
    const panel = document.createElement("div");
    panel.className = "search-word-detail";

    if (typeof onFavoriteCompare === "function") {
      const topActions = document.createElement("div");
      topActions.className = "detail-example-actions";

      const favCompareBtn = document.createElement("button");
      favCompareBtn.type = "button";
      favCompareBtn.className = "search-item-tag-btn detail-fav-btn";
      favCompareBtn.textContent = "Favorite Compare";
      favCompareBtn.addEventListener("click", async () => {
        try {
          await onFavoriteCompare(result || {});
          favCompareBtn.textContent = "Saved";
          favCompareBtn.disabled = true;
        } catch (err) {
          favCompareBtn.textContent = "Failed";
          favCompareBtn.title = String(err?.message || "Favorite compare failed");
        }
      });

      topActions.appendChild(favCompareBtn);
      panel.appendChild(topActions);
    }

    if (result.summary) {
      const summary = document.createElement("div");
      summary.className = "search-word-detail-translation";
      summary.textContent = `Summary: ${result.summary}`;
      panel.appendChild(summary);
    }

    if (Array.isArray(result.pairwise) && result.pairwise.length) {
      const h = document.createElement("div");
      h.className = "search-word-detail-subtitle";
      h.textContent = "Key Differences";
      panel.appendChild(h);

      const ul = document.createElement("ul");
      ul.className = "search-word-detail-list";
      for (const p of result.pairwise) {
        const li = document.createElement("li");
        li.textContent = `${p.pair}: ${p.difference}`;
        ul.appendChild(li);
      }
      panel.appendChild(ul);
    }

    if (Array.isArray(result.items)) {
      for (const item of result.items) {
        const block = document.createElement("div");
        block.className = "search-word-detail-pos";

        const t = document.createElement("div");
        t.className = "search-word-detail-pos-title";
        t.textContent = item.word;
        block.appendChild(t);

        if (item.coreMeaning) {
          const m = document.createElement("div");
          m.className = "search-word-detail-translation";
          m.textContent = `Meaning: ${item.coreMeaning}`;
          block.appendChild(m);
        }

        if (item.difference) {
          const d = document.createElement("div");
          d.className = "search-word-detail-translation";
          d.textContent = `Difference: ${item.difference}`;
          block.appendChild(d);
        }

        const list = document.createElement("ol");
        list.className = "search-word-detail-examples";
        for (const ex of item.examples || []) {
          const li = buildFavoriteExampleRow(ex, item.difference || item.coreMeaning || item.word, onFavoriteExample);
          list.appendChild(li);
        }
        block.appendChild(list);
        panel.appendChild(block);
      }
    }

    return panel;
  }

  function renderSynonymResultPanel(result, onFavoriteExample, onFavoriteSynonyms) {
    const panel = document.createElement("div");
    panel.className = "search-word-detail";
    const synonymItems = Array.isArray(result.synonyms) ? result.synonyms.slice(0, 4) : [];

    if (typeof onFavoriteSynonyms === "function") {
      const topActions = document.createElement("div");
      topActions.className = "detail-example-actions";

      const favSynBtn = document.createElement("button");
      favSynBtn.type = "button";
      favSynBtn.className = "search-item-tag-btn detail-fav-btn";
      favSynBtn.textContent = "Favorite Synonyms";
      favSynBtn.addEventListener("click", async () => {
        try {
          await onFavoriteSynonyms(result || {});
          favSynBtn.textContent = "Saved";
          favSynBtn.disabled = true;
        } catch (err) {
          favSynBtn.textContent = "Failed";
          favSynBtn.title = String(err?.message || "Favorite synonyms failed");
        }
      });

      topActions.appendChild(favSynBtn);
      panel.appendChild(topActions);
    }

    if (result.summary) {
      const summary = document.createElement("div");
      summary.className = "search-word-detail-translation";
      summary.textContent = `Summary: ${result.summary}`;
      panel.appendChild(summary);
    }

    if (result.word) {
      const baseWord = document.createElement("div");
      baseWord.className = "search-word-detail-translation";
      baseWord.textContent = `Base Word: ${result.word}`;
      panel.appendChild(baseWord);
    }

    if (Array.isArray(result.baseExamples) && result.baseExamples.length) {
      const h = document.createElement("div");
      h.className = "search-word-detail-subtitle";
      h.textContent = "Base Word Examples";
      panel.appendChild(h);

      const list = document.createElement("ol");
      list.className = "search-word-detail-examples";
      for (const ex of result.baseExamples) {
        const li = buildFavoriteExampleRow(ex, result.summary || result.word || "Base word example", onFavoriteExample);
        list.appendChild(li);
      }
      panel.appendChild(list);
    }

    if (synonymItems.length) {
      const h = document.createElement("div");
      h.className = "search-word-detail-subtitle";
      h.textContent = "Key Differences";
      panel.appendChild(h);

      const ul = document.createElement("ul");
      ul.className = "search-word-detail-list";
      for (const item of synonymItems) {
        const li = document.createElement("li");
        const pair = result.word ? `${result.word} vs ${item.word}` : String(item.word || "");
        const diff = String(item.difference || "").trim();
        li.textContent = diff ? `${pair}: ${diff}` : pair;
        ul.appendChild(li);
      }
      panel.appendChild(ul);
    }

    for (const item of synonymItems) {
      const block = document.createElement("div");
      block.className = "search-word-detail-pos";

      const t = document.createElement("div");
      t.className = "search-word-detail-pos-title";
      t.textContent = item.word;
      block.appendChild(t);

      if (item.coreMeaning) {
        const m = document.createElement("div");
        m.className = "search-word-detail-translation";
        m.textContent = `Meaning: ${item.coreMeaning}`;
        block.appendChild(m);
      }

      if (item.difference) {
        const d = document.createElement("div");
        d.className = "search-word-detail-translation";
        d.textContent = `Difference: ${item.difference}`;
        block.appendChild(d);
      }

      const list = document.createElement("ol");
      list.className = "search-word-detail-examples";
      for (const ex of item.examples || []) {
        const li = buildFavoriteExampleRow(ex, item.difference || item.word, onFavoriteExample);
        list.appendChild(li);
      }
      block.appendChild(list);
      panel.appendChild(block);
    }

    return panel;
  }

  globalScope.EnWordDetailPanels = {
    renderCompareResultPanel,
    renderSynonymResultPanel,
  };
})(window);
