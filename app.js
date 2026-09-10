document.querySelectorAll("input[name='mode']").forEach((r) => {
  r.addEventListener("change", (e) => {
    mode = e.target.value;
    applyModeSpecificUI();
    renderQuestion();
  });
});

if (tabStudyBtn) {
  tabStudyBtn.addEventListener("click", () => setMainTab("study"));
}
if (tabManagerBtn) {
  tabManagerBtn.addEventListener("click", () => setMainTab("manager"));
}
if (tabFavoritesBtn) {
  tabFavoritesBtn.addEventListener("click", () => setMainTab("favorites"));
}
if (tabCompareFavoritesBtn) {
  tabCompareFavoritesBtn.addEventListener("click", () => setMainTab("compareFavorites"));
}
if (tabSynonymFavoritesBtn) {
  tabSynonymFavoritesBtn.addEventListener("click", () => setMainTab("synonymFavorites"));
}

checkBtn.addEventListener("click", checkAnswer);
showBtn.addEventListener("click", showAnswer);
nextBtn.addEventListener("click", nextQuestion);
favoriteSentenceBtn.addEventListener("click", favoriteCurrentSentence);
markMasteredBtn.addEventListener("click", markCurrentWordMastered);
exampleBtn.addEventListener("click", showExamplesForCurrentWord);
if (studySynonymBtn) {
  studySynonymBtn.addEventListener("click", showSynonymsForCurrentWord);
}
if (translateSentenceBtn) {
  translateSentenceBtn.addEventListener("click", translateCustomSentenceToChinese);
}
if (favoriteTranslatedSentenceBtn) {
  favoriteTranslatedSentenceBtn.addEventListener("click", favoriteTranslatedSentence);
}
if (customSentenceInputEl) {
  customSentenceInputEl.addEventListener("input", () => {
    clearCustomSentenceTranslateState();
  });
  customSentenceInputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      translateCustomSentenceToChinese();
    }
  });
}
startStudyBtn.onclick = () => {
  if (currentSessionType === "study") {
    endSession();
    return;
  }
  startOrResumeSession("study");
};
startReviewBtn.onclick = () => {
  if (currentSessionType === "review") {
    endSession();
    return;
  }
  startOrResumeSession("review");
};
if (startQuizBtn) {
  startQuizBtn.onclick = () => {
    if (currentSessionType === "quiz") {
      endSession();
      return;
    }
    startOrResumeSession("quiz");
  };
}
if (resetSessionBtn) {
  resetSessionBtn.addEventListener("click", () => {
    resetLearningSession();
  });
}
if (hiddenModeBtn) {
  hiddenModeBtn.addEventListener("click", toggleHiddenMode);
}
if (exitHiddenModeBtn) {
  exitHiddenModeBtn.addEventListener("click", () => setHiddenMode(false));
}
searchBtn.addEventListener("click", onSearchOrFilterChanged);
clearSearchBtn.addEventListener("click", () => {
  searchInputEl.value = "";
  selectedFilterTags.clear();
  renderFilterTags();
  renderComparePanel();
  hideSuggest();
  onSearchOrFilterChanged();
});
addTagBtn.addEventListener("click", addTagToCurrentWord);

if (closeManagerBtn) {
  closeManagerBtn.addEventListener("click", () => {
    setMainTab("study");
  });
}

if (closeFavoritesBtn) {
  closeFavoritesBtn.addEventListener("click", () => {
    setMainTab("study");
  });
}

if (closeCompareFavoritesBtn) {
  closeCompareFavoritesBtn.addEventListener("click", () => {
    setMainTab("study");
  });
}

if (closeSynonymFavoritesBtn) {
  closeSynonymFavoritesBtn.addEventListener("click", () => {
    setMainTab("study");
  });
}

if (detailModalCloseBtn) {
  detailModalCloseBtn.addEventListener("click", closeWordDetailModal);
}

if (runCompareBtn) {
  runCompareBtn.addEventListener("click", runCompareAnalysis);
}

if (clearCompareBtn) {
  clearCompareBtn.addEventListener("click", () => {
    compareWordIds.clear();
    renderComparePanel();
    renderSearchResults();
  });
}

if (detailModalEl) {
  detailModalEl.addEventListener("click", (e) => {
    if (e.target === detailModalEl) {
      closeWordDetailModal();
    }
  });
}

for (const btn of managerFilterButtons) {
  btn.addEventListener("click", () => {
    managerStatusFilter = btn.dataset.statusFilter || "all";
    renderManagerPanel();
  });
}

managerSearchInputEl.addEventListener("input", () => {
  renderManagerPanel();
});

if (managerLearningSortEl) {
  managerLearningSortEl.addEventListener("change", () => {
    managerLearningSort = String(managerLearningSortEl.value || "time");
    renderManagerPanel();
  });
}

answerInputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    if (!answeredThisRound) {
      checkAnswer();
    } else {
      nextQuestion();
    }
  }
});

searchInputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    hideSuggest();
    onSearchOrFilterChanged();
  }
  if (e.key === "Escape") {
    hideSuggest();
  }
});

searchInputEl.addEventListener("input", () => {
  scheduleSuggestRender();
});

if (sentenceDifficultyEl) {
  sentenceDifficultyEl.addEventListener("change", () => {
    if (mode === "sentence" && queue.length) {
      renderQuestion();
    }
  });
}

document.addEventListener("click", (e) => {
  if (!searchSuggestEl) return;
  if (e.target === searchInputEl || searchSuggestEl.contains(e.target)) return;
  hideSuggest();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && detailModalEl && !detailModalEl.classList.contains("is-hidden")) {
    closeWordDetailModal();
  }
});

newTagInputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    addTagToCurrentWord();
  }
});

init();