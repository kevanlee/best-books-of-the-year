const STORAGE_KEY = "professional-values-exercise-v2";
const LEGACY_STORAGE_KEY = "professional-values-exercise-v1";

const STEPS = [
  { id: "welcome", label: "Welcome" },
  { id: "highlight", label: "Highlight" },
  { id: "shortlist", label: "Shortlist" },
  { id: "group", label: "Group" },
  { id: "select", label: "Choose" },
  { id: "reflect", label: "Define" },
  { id: "results", label: "Results" },
];

const ALL_VALUES = Array.from(
  new Set(
    `
Acceptance
Accountability
Achievement
Adaptability
Adventure
Altruism
Ambition
Assertiveness
Authenticity
Authority
Autonomy
Balance
Beauty
Being the best
Belonging
Boldness
Career
Caring
Challenge
Citizenship
Collaboration
Commitment
Community
Compassion
Competence
Compensation
Confidence
Connection
Contentment
Contribution
Cooperation
Courage
Craft
Creativity
Curiosity
Dependability
Determination
Dignity
Diversity
Efficiency
Environment
Equality
Ethics
Excellence
Faith
Family
Financial stability
Flexibility
Forgiveness
Freedom
Friendship
Frugality
Fun
Future generations
Generosity
Giving back
Grace
Gratitude
Growth
Happiness
Harmony
Health
Home
Honesty
Hope
Humility
Humor
Impact
Improvement
Inclusion
Independence
Individualism
Influence
Initiative
Inner Harmony
Integrity
Intuition
Job security
Joy
Justice
Kindness
Knowledge
Leadership
Learning
Legacy
Leisure
Love
Loyalty
Making a difference
Mastery
Meaningful Work
Nature
Nonconformity
Open-mindedness
Openness
Optimism
Order
Parenting
Patience
Peace
Perseverance
Personal fulfillment
Personal growth
Play
Pleasure
Poise
Popularity
Power
Pride
Purpose
Questioning
Recognition
Reliability
Religion
Reputation
Resourcefulness
Respect
Responsibility
Risk-taking
Ritual
Safety
Security
Self-Awareness
Self-discipline
Self-expression
Self-reliance
Self-Respect
Serenity
Service
Simplicity
Social Justice
Spirituality
Sportsmanship
Stability
Status
Stewardship
Success
Support
Sustainability
Teamwork
Thrift
Time
Tradition
Travel
Trust
Truth
Understanding
Uniqueness
Usefulness
Vision
Vulnerability
Wealth
Well-being
Wholeheartedness
Wisdom
    `
      .trim()
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean)
  )
).sort((left, right) => left.localeCompare(right));

const THEMES = [
  {
    label: "trust and room to own your work",
    keywords: ["trust", "freedom", "autonomy", "own", "ownership", "decision", "independ"],
  },
  {
    label: "steady expectations and a reliable foundation",
    keywords: ["clarity", "stability", "secure", "predictable", "steady", "support", "safe"],
  },
  {
    label: "growth, stretch, and visible learning",
    keywords: ["learn", "growth", "improve", "challenge", "feedback", "develop", "stretch"],
  },
  {
    label: "strong collaboration and healthy relationships",
    keywords: ["team", "collaboration", "support", "together", "belong", "respect", "people"],
  },
  {
    label: "meaning, impact, and connection to useful outcomes",
    keywords: ["impact", "purpose", "meaning", "difference", "help", "customer", "service"],
  },
  {
    label: "craft, quality, and thoughtful execution",
    keywords: ["craft", "quality", "mastery", "excellent", "care", "detail", "rigor"],
  },
  {
    label: "recognition, influence, and a voice in the work",
    keywords: ["recognition", "seen", "voice", "influence", "lead", "visibility", "credit"],
  },
  {
    label: "flexibility and space for real life",
    keywords: ["flexibility", "balance", "remote", "time", "life", "schedule", "boundary"],
  },
];

const SHARE_MARKERS = [
  { emoji: "🔥", color: "#e76f51" },
  { emoji: "🌿", color: "#5b8c5a" },
  { emoji: "🌊", color: "#3a86b8" },
  { emoji: "🪞", color: "#8b6fcf" },
  { emoji: "⭐", color: "#e9b949" },
];

const app = document.getElementById("app");
const progress = document.getElementById("progress");
const toast = document.getElementById("toast");

let toastTimer = null;
let lastRenderedStep = null;
let draggedValue = "";
let state = normalizeState(loadState());

render();

document.addEventListener("click", handleClick);
app.addEventListener("input", handleInput);
app.addEventListener("change", handleInput);
app.addEventListener("dragstart", handleDragStart);
app.addEventListener("dragover", handleDragOver);
app.addEventListener("dragleave", handleDragLeave);
app.addEventListener("drop", handleDrop);
app.addEventListener("dragend", handleDragEnd);

function defaultState() {
  return {
    currentStep: "welcome",
    highlightedValues: [],
    shortlistedValues: [],
    groups: createDefaultGroups(),
    assignments: {},
    finalGroupIds: [],
    hasEditedFinalSelection: false,
    reflections: {},
  };
}

function createDefaultGroups() {
  return [
    { id: "group-1", name: "" },
    { id: "group-2", name: "" },
  ];
}

function loadState() {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) {
      return JSON.parse(current);
    }

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      return migrateLegacyState(JSON.parse(legacy));
    }

    return defaultState();
  } catch (error) {
    return defaultState();
  }
}

function migrateLegacyState(legacy) {
  const highlightedValues = uniqueValid(legacy.selectedValues, ALL_VALUES);
  const shortlistedValues = uniqueValid(legacy.narrowedValues, highlightedValues).length
    ? uniqueValid(legacy.narrowedValues, highlightedValues).slice(0, 25)
    : highlightedValues.slice(0, 25);
  const groups = Array.from({ length: Math.min(3, Math.max(shortlistedValues.length, 1)) }, (_, index) => ({
    id: `group-${index + 1}`,
    name: "",
  }));
  const assignments = {};

  shortlistedValues.forEach((value, index) => {
    assignments[value] = groups[index % groups.length].id;
  });

  return {
    currentStep: shortlistedValues.length ? "group" : highlightedValues.length ? "shortlist" : "highlight",
    highlightedValues,
    shortlistedValues,
    groups,
    assignments,
    finalGroupIds: [],
    hasEditedFinalSelection: false,
    reflections: {},
  };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    showToast("Your browser blocked local saving for this file.");
  }
}

function normalizeState(input) {
  const base = { ...defaultState(), ...(input || {}) };
  const highlightedValues = uniqueValid(base.highlightedValues, ALL_VALUES);
  const shortlistedValues = uniqueValid(base.shortlistedValues, highlightedValues).slice(0, 25);
  const groups = normalizeGroups(base.groups);
  const groupIds = new Set(groups.map((group) => group.id));
  const assignments = {};

  Object.entries(base.assignments || {}).forEach(([value, groupId]) => {
    if (shortlistedValues.includes(value) && groupIds.has(groupId)) {
      assignments[value] = groupId;
    }
  });

  const activeGroups = getActiveGroups({ shortlistedValues, groups, assignments });
  const activeGroupIds = activeGroups.map((group) => group.id);
  const legacySelections = Array.isArray(base.finalGroupIds) ? base.finalGroupIds : base.rankedGroupIds;
  const normalizedSelections = uniqueIds(legacySelections, activeGroupIds);
  const hasEditedFinalSelection =
    base.hasEditedFinalSelection === true ||
    (Array.isArray(base.rankedGroupIds) && base.rankedGroupIds.length > 0);
  const finalGroupIds =
    activeGroupIds.length <= 5
      ? hasEditedFinalSelection
        ? normalizedSelections
        : activeGroupIds
      : hasEditedFinalSelection
        ? normalizedSelections.slice(0, 5)
        : [];

  const reflections = {};
  finalGroupIds.forEach((groupId) => {
    const existing = base.reflections && base.reflections[groupId] ? base.reflections[groupId] : {};
    reflections[groupId] = {
      meaning: typeof existing.meaning === "string" ? existing.meaning : "",
      honored: typeof existing.honored === "string" ? existing.honored : "",
      missing: typeof existing.missing === "string" ? existing.missing : "",
    };
  });

  const currentStep = reachableStep(base.currentStep, {
    highlightedValues,
    shortlistedValues,
    groups,
    assignments,
    finalGroupIds,
    hasEditedFinalSelection,
    reflections,
  });

  return {
    currentStep,
    highlightedValues,
    shortlistedValues,
    groups,
    assignments,
    finalGroupIds,
    hasEditedFinalSelection,
    reflections,
  };
}

function normalizeGroups(inputGroups) {
  const result = [];
  const seen = new Set();

  (Array.isArray(inputGroups) ? inputGroups : []).forEach((group, index) => {
    const rawId = group && typeof group.id === "string" ? group.id : `group-${index + 1}`;
    const id = seen.has(rawId) ? nextGroupId(result) : rawId;

    seen.add(id);
    result.push({
      id,
      name: group && typeof group.name === "string" ? group.name : "",
    });
  });

  while (result.length < 1) {
    result.push({ id: nextGroupId(result), name: "" });
  }

  return result;
}

function nextGroupId(groups) {
  const numbers = groups
    .map((group) => Number.parseInt(String(group.id).replace("group-", ""), 10))
    .filter((value) => Number.isFinite(value));
  const nextNumber = numbers.length ? Math.max(...numbers) + 1 : 1;
  return `group-${nextNumber}`;
}

function uniqueValid(list, validPool) {
  const validSet = new Set(validPool);
  const seen = new Set();
  const result = [];

  (Array.isArray(list) ? list : []).forEach((item) => {
    if (typeof item !== "string" || seen.has(item) || !validSet.has(item)) {
      return;
    }

    seen.add(item);
    result.push(item);
  });

  return result;
}

function uniqueIds(list, validIds) {
  const validSet = new Set(validIds);
  const seen = new Set();
  const result = [];

  (Array.isArray(list) ? list : []).forEach((item) => {
    if (typeof item !== "string" || seen.has(item) || !validSet.has(item)) {
      return;
    }

    seen.add(item);
    result.push(item);
  });

  return result;
}

function setState(updater, shouldRender = true) {
  const nextValue = typeof updater === "function" ? updater(state) : updater;
  state = normalizeState(nextValue);
  saveState();

  if (shouldRender) {
    render();
  }
}

function render() {
  renderProgress();

  switch (state.currentStep) {
    case "welcome":
      renderWelcome();
      break;
    case "highlight":
      renderHighlight();
      break;
    case "shortlist":
      renderShortlist();
      break;
    case "group":
      renderGroup();
      break;
    case "select":
      renderSelect();
      break;
    case "reflect":
      renderReflect();
      break;
    case "results":
      renderResults();
      break;
    default:
      renderWelcome();
  }

  lastRenderedStep = state.currentStep;
}

function renderProgress() {
  if (state.currentStep === "welcome") {
    progress.innerHTML = "";
    return;
  }

  const currentIndex = STEPS.findIndex((step) => step.id === state.currentStep);
  const visibleStepIndex = currentIndex - 1;
  const visibleStepCount = STEPS.length - 1;
  const progressPercent =
    visibleStepCount <= 1 ? 0 : (visibleStepIndex / (visibleStepCount - 1)) * 100;

  progress.innerHTML = `
    <div class="progress-copy">
      <span>Step ${visibleStepIndex + 1} / ${visibleStepCount}</span>
      <span>${STEPS[currentIndex].label}</span>
      <button class="button button-secondary button-compact" data-action="restart">
        Start over
      </button>
    </div>
    <div class="progress-bar" aria-hidden="true">
      <div class="progress-fill" style="width: ${progressPercent}%"></div>
    </div>
  `;
}

function panelClass(stepId) {
  return lastRenderedStep !== stepId ? "panel is-entering" : "panel";
}

function renderWelcome() {
  app.innerHTML = `
    <section class="${panelClass("welcome")}">
      <div class="panel-inner">
        <div class="welcome-hero">
          <div class="welcome-hero-inner">
            <p class="eyebrow">Values workshop</p>
            <h1 class="welcome-headline">Find the values worth building your life and work around.</h1>
            <button class="button button-primary" data-action="goto" data-step="highlight">
              Start exercise
            </button>
          </div>
        </div>

        <div class="welcome-layout">
          <div class="welcome-copy">
            <h2 class="panel-title">Welcome to the Values Exercise.</h2>
            <p class="panel-copy">
              Values are the qualities, principles, and ways of living or working that feel most important to you.
              They shape what feels meaningful, motivating, and worth protecting.
            </p>
            <p class="panel-copy">
              You can move through this exercise thinking about your personal values, your professional values, or the
              overlap between the two.
            </p>
            <p class="panel-copy">
              You'll walk away from this exercise with your values defined by you personally to take into your life as
              decision-making filters.
            </p>
            <p class="panel-copy">
              Your progress saves on this device, and most people finish in about 10 to 15 minutes.
            </p>
          </div>

          <div class="welcome-steps-column">
            <div class="welcome-step">
              <span class="welcome-step-number">1</span>
              <strong class="welcome-step-title">Longlist</strong>
              <p class="support-copy">Mark every value that feels important to your life, your work, or both.</p>
            </div>
            <div class="welcome-step">
              <span class="welcome-step-number">2</span>
              <strong class="welcome-step-title">Shortlist</strong>
              <p class="support-copy">Narrow the list to the 25 values that feel most central right now.</p>
            </div>
            <div class="welcome-step">
              <span class="welcome-step-number">3</span>
              <strong class="welcome-step-title">Group &amp; choose</strong>
              <p class="support-copy">Combine related ideas, name them in your own words, and choose your final 3 to 5 if you have more than five groups.</p>
            </div>
            <div class="welcome-step">
              <span class="welcome-step-number">4</span>
              <strong class="welcome-step-title">Define</strong>
              <p class="support-copy">Describe what each value means to you, how you recognize it, and what happens when it is missing.</p>
            </div>
          </div>
        </div>

      </div>
    </section>
  `;
}

function renderHighlight() {
  const count = state.highlightedValues.length;

  app.innerHTML = `
    <section class="${panelClass("highlight")}">
      <div class="panel-inner">
        <div class="panel-hero">
          <p class="eyebrow eyebrow-pill">Step 1</p>
          <h2 class="panel-title">Choose the values that are most important to you.</h2>
          <p class="panel-copy">
            These can be aspirational, true today, or both. Highlight whatever feels most important to you right now,
            and go with your gut. Choose as many as you like. No limit.
          </p>
        </div>

        <div class="section-head">
          <h3 class="section-title">Values list</h3>
          <div class="counter-pill">
            <span>Highlighted</span>
            <strong>${count}</strong>
          </div>
        </div>

        <div class="value-grid">
          ${ALL_VALUES.map((value) => renderValueCard(value, state.highlightedValues, "toggle-highlight")).join("")}
        </div>

        <div class="button-row">
          <div class="button-group">
            <button class="button button-ghost" data-action="goto" data-step="welcome">Back</button>
          </div>
          <div class="button-group">
            <button class="button button-secondary" data-action="clear-highlighted" ${count ? "" : "disabled"}>
              Clear highlights
            </button>
            <button class="button button-primary" data-action="goto" data-step="shortlist" ${count ? "" : "disabled"}>
              Continue to shortlist
            </button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderShortlist() {
  const count = state.shortlistedValues.length;
  const atLimit = count >= 25;
  const canContinue = count >= 3;

  app.innerHTML = `
    <section class="${panelClass("shortlist")}">
      <div class="panel-inner">
        <div class="panel-hero">
          <p class="eyebrow eyebrow-pill">Step 2</p>
          <h2 class="panel-title">Pick your top 25.</h2>
          <p class="panel-copy">Choose up to 25 from your highlights. Ask: is this integral to who I am?</p>
          <p class="panel-copy">Up to 25 values.</p>
        </div>

        <div class="section-head">
          <div>
            <h3 class="section-title">Your highlighted values</h3>
          </div>
          <div class="counter-pill ${atLimit ? "is-warning" : ""}">
            <span>Shortlisted</span>
            <strong>${count}/25</strong>
          </div>
        </div>

        <div class="value-grid">
          ${state.highlightedValues.map((value) =>
            renderValueCard(value, state.shortlistedValues, "toggle-shortlist", atLimit)
          ).join("")}
        </div>

        <div class="button-row">
          <div class="button-group">
            <button class="button button-ghost" data-action="goto" data-step="highlight">Back</button>
          </div>
          <div class="button-group">
            <button class="button button-secondary" data-action="clear-shortlist" ${count ? "" : "disabled"}>
              Clear shortlist
            </button>
            <button class="button button-primary" data-action="goto" data-step="group" ${canContinue ? "" : "disabled"}>
              Continue to grouping
            </button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderGroup() {
  const activeGroups = getActiveGroups(state);
  const unassigned = getUnassignedValues(state);
  const ready = groupingReady(state);
  const status = groupingStatus(state);
  const startedGrouping = state.shortlistedValues.some((value) => Boolean(state.assignments[value]));
  const canAutoGroupRemaining = startedGrouping && unassigned.length > 0;

  app.innerHTML = `
    <section class="${panelClass("group")}">
      <div class="panel-inner">
        <div class="panel-hero">
          <p class="eyebrow eyebrow-pill">Step 3</p>
          <h2 class="panel-title">Group related values & rename.</h2>
          <p class="panel-copy">
            Drag values into related / alike groups and rename them. For example, you might group Belonging, Connection, and Togetherness and rename it INCLUSION. If you have standalone values, they can be in groups alone.
          </p>
          <p class="panel-copy">${status}</p>
        </div>

        <div class="grouping-layout">
          <div class="grouping-sidebar">
            <div class="dropzone-head grouping-column-head">
              <h3 class="dropzone-title">Your Values</h3>
              <span class="dropzone-count">${unassigned.length}</span>
            </div>

            <article class="shortlist-tray" data-drop-group="">
              <div class="dropzone-items">
                ${
                  unassigned.length
                    ? unassigned.map((value) => renderDragPill(value)).join("")
                    : '<p class="dropzone-empty">All values are grouped.</p>'
                }
              </div>
            </article>

            ${
              canAutoGroupRemaining
                ? `<div class="grouping-sidebar-actions">
                    <button class="button button-secondary" data-action="auto-group-remaining">
                      ${
                        unassigned.length === 1
                          ? "Add the last value as its own group"
                          : "Add the rest as individual groups"
                      }
                    </button>
                  </div>`
                : ""
            }
          </div>

          <div class="grouping-main">
            <div class="dropzone-head grouping-column-head">
              <h3 class="dropzone-title">Your groups</h3>
              <div class="counter-pill ${ready ? "" : "is-warning"}">
                <span>Groups in use</span>
                <strong>${activeGroups.length}</strong>
              </div>
            </div>

            <div class="group-grid">
              ${state.groups.map((group, index) => renderGroupCard(group, index)).join("")}
            </div>

            <div class="grouping-controls">
              <button
                class="button button-secondary"
                data-action="add-group"
                ${state.groups.length >= Math.max(state.shortlistedValues.length, 1) ? "disabled" : ""}
              >
                Add group
              </button>
            </div>
          </div>
        </div>

        <div class="button-row">
          <div class="button-group">
            <button class="button button-ghost" data-action="goto" data-step="shortlist">Back</button>
          </div>
          <div class="button-group">
            <button class="button button-primary" data-action="goto" data-step="select" ${ready ? "" : "disabled"}>
              Continue to final choices
            </button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderSelect() {
  const activeGroups = getActiveGroups(state);
  const selectedCount = state.finalGroupIds.length;
  const ready = finalSelectionReady(state);
  const helperText =
    activeGroups.length > 5
      ? "Choose up to 5 groups that feel most essential right now. None are selected yet."
      : "Your groups are selected by default. Unselect any that you do not want to carry forward.";

  app.innerHTML = `
    <section class="${panelClass("select")}">
      <div class="panel-inner">
        <div class="panel-hero">
          <p class="eyebrow eyebrow-pill">Step 4</p>
          <h2 class="panel-title">Confirm your values (5 max).</h2>
          <p class="panel-copy">
            ${helperText} Pick the values you would most want guiding your decisions, even when tradeoffs are real.
          </p>
          <p class="panel-copy">${selectedCount} selected.</p>
        </div>

        <div class="rank-list">
          ${activeGroups.map((group) => renderFinalChoiceItem(group.id)).join("")}
        </div>

        <div class="button-row">
          <div class="button-group">
            <button class="button button-ghost" data-action="goto" data-step="group">Back</button>
          </div>
          <div class="button-group">
            <button class="button button-primary" data-action="goto" data-step="reflect" ${ready ? "" : "disabled"}>
              Continue to definitions
            </button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderReflect() {
  const startedCount = state.finalGroupIds.filter((groupId) => {
    const reflection = state.reflections[groupId] || {};
    return Boolean(reflection.meaning || reflection.honored || reflection.missing);
  }).length;

  app.innerHTML = `
    <section class="${panelClass("reflect")}">
      <div class="panel-inner">
        <div class="panel-hero">
          <p class="eyebrow eyebrow-pill">Step 5</p>
          <h2 class="panel-title">Define what each value means to you.</h2>
          <p class="panel-copy">
            Start with your own definition, then add a few signals for when it is present or missing. Write the
            definition the way you would explain it to yourself or to someone you trust.
          </p>
          <p class="panel-copy">Autosaving locally.</p>
        </div>

        <div class="section-head">
          <div>
            <h3 class="section-title">Reflections</h3>
          </div>
          <div class="counter-pill">
            <span>Started</span>
            <strong>${startedCount}/${state.finalGroupIds.length}</strong>
          </div>
        </div>

        <div class="reflection-list">
          ${state.finalGroupIds.map((groupId) => renderReflectionCard(groupId)).join("")}
        </div>

        <div class="button-row">
          <div class="button-group">
            <button class="button button-ghost" data-action="goto" data-step="select">Back</button>
          </div>
          <div class="button-group">
            <button class="button button-primary" data-action="goto" data-step="results">
              View results
            </button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderResults() {
  const summary = buildSummary();
  const shareMarkers = getShareMarkers();

  app.innerHTML = `
    <section class="${panelClass("results")}">
      <div class="panel-inner">
        <div class="panel-hero">
          <p class="eyebrow eyebrow-pill">Step 6</p>
          <h2 class="panel-title">Your values snapshot.</h2>
          <p class="panel-copy">A simple version you can revisit or share.</p>
        </div>

        <div class="results-layout">
          <div class="summary-card">
            <h3 class="result-rank">Values snapshot</h3>
            <ul class="result-list result-list-visual">
              ${shareMarkers.map((marker) => {
                return `
                  <li class="result-list-item-visual">
                    <span class="result-list-item-pill" style="--signal-color: ${marker.color}">
                      <span class="result-list-item-mark">${marker.emoji}</span>
                      <span>${escapeHtml(marker.label)}</span>
                    </span>
                  </li>
                `;
              }).join("")}
            </ul>
            <div class="values-snapshot-actions">
              <span class="values-snapshot-share-label">Share:</span>
              <button class="button button-secondary" data-action="copy-share">Copy as text</button>
              <button class="button button-secondary" data-action="download-share-image">Download as PNG</button>
            </div>
          </div>

          <div class="summary-card">
            <h3 class="result-rank">Recap</h3>
            ${summary.map((paragraph) => `<p>${paragraph}</p>`).join("")}
          </div>
        </div>

        <div class="results-list">
          ${state.finalGroupIds.map((groupId) => renderResultCard(groupId)).join("")}
        </div>

        <div class="button-row">
          <div class="button-group">
            <button class="button button-ghost" data-action="goto" data-step="reflect">Back</button>
          </div>
          <div class="button-group">
            <button class="button button-secondary" data-action="copy-results">Copy results</button>
            <button class="button button-secondary" data-action="download-results">Download .txt</button>
            <button class="button button-danger" data-action="restart">Restart exercise</button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderValueCard(value, selectedList, action, limitReached = false) {
  const isSelected = selectedList.includes(value);
  const isDisabled = limitReached && !isSelected;

  return `
    <button
      type="button"
      class="value-card ${isSelected ? "is-selected" : ""} ${isDisabled ? "is-disabled" : ""}"
      data-action="${action}"
      data-value="${escapeAttribute(value)}"
      aria-pressed="${isSelected}"
    >
      <span>${escapeHtml(value)}</span>
      <span class="value-card-badge">${isSelected ? "✓" : "+"}</span>
    </button>
  `;
}

function renderGroupCard(group, index) {
  const members = getGroupMembers(group.id);
  const memberCount = members.length;
  const canRemove = state.groups.length > 1;
  const inputValue = group.name.trim() || members[0] || "";
  const placeholder = members[0] || "Name this group";

  return `
    <article class="group-card">
      <div class="group-card-head">
        <h3 class="group-title">Group ${index + 1}</h3>
        <button class="button button-ghost button-inline" data-action="remove-group" data-group-id="${group.id}" ${canRemove ? "" : "disabled"}>
          Remove
        </button>
      </div>
      <label class="sr-only" for="name-${group.id}">Group name</label>
      <input
        id="name-${group.id}"
        class="text-input"
        type="text"
        maxlength="80"
        data-action="rename-group"
        data-group-id="${group.id}"
        value="${escapeAttribute(inputValue)}"
        placeholder="${escapeAttribute(placeholder)}"
      />
      <div class="group-dropzone" data-drop-group="${group.id}">
        <div class="dropzone-head">
          <h4 class="dropzone-title">${memberCount === 1 ? "1 value" : `${memberCount} values`}</h4>
          <span class="dropzone-count">${memberCount}</span>
        </div>
        <div class="dropzone-items">
          ${
            memberCount
              ? members.map((value) => renderDragPill(value)).join("")
              : '<p class="dropzone-empty">Drag values here.</p>'
          }
        </div>
      </div>
    </article>
  `;
}

function renderDragPill(value) {
  return `
    <button
      type="button"
      class="drag-pill"
      draggable="true"
      data-drag-value="${escapeAttribute(value)}"
    >
      ${escapeHtml(value)}
    </button>
  `;
}

function renderFinalChoiceItem(groupId) {
  const groupName = getGroupResolvedName(groupId);
  const members = getGroupMembers(groupId);
  const isSelected = state.finalGroupIds.includes(groupId);

  return `
    <div class="rank-item">
      <button
        type="button"
        class="rank-position ${isSelected ? "is-selected" : "is-inactive"}"
        data-action="toggle-final-group"
        data-group-id="${groupId}"
        aria-pressed="${isSelected}"
        aria-label="${isSelected ? "Unselect" : "Select"} ${escapeAttribute(groupName)}"
      >
        ${isSelected ? "✓" : "+"}
      </button>
      <div class="rank-content">
        <p class="rank-value">${escapeHtml(groupName)}</p>
        <div class="chip-list chip-list-compact">
          ${members.map((value) => `<span class="chip">${escapeHtml(value)}</span>`).join("")}
        </div>
      </div>
    </div>
  `;
}

function renderReflectionCard(groupId) {
  const groupName = getGroupResolvedName(groupId);
  const members = getGroupMembers(groupId);
  const reflection = state.reflections[groupId] || { meaning: "", honored: "", missing: "" };

  return `
    <article class="reflection-card">
      <div class="reflection-head">
        <div>
          <h3 class="reflection-value">${escapeHtml(groupName)}</h3>
          <div class="chip-list chip-list-compact">
            ${members.map((value) => `<span class="chip">${escapeHtml(value)}</span>`).join("")}
          </div>
        </div>
      </div>

      <div class="field-group">
        <label for="meaning-${groupId}">How do you define this value in your own words?</label>
        <textarea id="meaning-${groupId}" class="text-area" data-action="update-reflection" data-group-id="${groupId}" data-field="meaning" placeholder="Your answer here (optional)">${escapeHtml(reflection.meaning)}</textarea>
      </div>

      <div class="field-group">
        <label for="honored-${groupId}">What helps you recognize that this value is present?</label>
        <textarea id="honored-${groupId}" class="text-area" data-action="update-reflection" data-group-id="${groupId}" data-field="honored" placeholder="Your answer here (optional)">${escapeHtml(reflection.honored)}</textarea>
      </div>

      <div class="field-group">
        <label for="missing-${groupId}">What tells you this value is missing or being compromised?</label>
        <textarea id="missing-${groupId}" class="text-area" data-action="update-reflection" data-group-id="${groupId}" data-field="missing" placeholder="Your answer here (optional)">${escapeHtml(reflection.missing)}</textarea>
      </div>
    </article>
  `;
}

function renderResultCard(groupId) {
  const groupName = getGroupResolvedName(groupId);
  const members = getGroupMembers(groupId);
  const reflection = state.reflections[groupId] || {};

  return `
    <article class="result-card">
      <h3 class="section-title">${escapeHtml(groupName)}</h3>
      <div class="chip-list chip-list-compact">
        ${members.map((value) => `<span class="chip">${escapeHtml(value)}</span>`).join("")}
      </div>
      <h4>How you define it</h4>
      <p>${formatReflection(reflection.meaning)}</p>
      <h4>How you recognize it</h4>
      <p>${formatReflection(reflection.honored)}</p>
      <h4>How you know it is missing</h4>
      <p>${formatReflection(reflection.missing)}</p>
    </article>
  `;
}

function handleClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) {
    return;
  }

  const action = target.dataset.action;
  const value = target.dataset.value || "";
  const groupId = target.dataset.groupId || "";

  switch (action) {
    case "goto":
      goToStep(target.dataset.step);
      break;
    case "history-back":
      goBack();
      break;
    case "toggle-highlight":
      toggleValue("highlightedValues", value);
      break;
    case "toggle-shortlist":
      toggleShortlist(value);
      break;
    case "clear-highlighted":
      setState((current) => ({
        ...current,
        highlightedValues: [],
        shortlistedValues: [],
        assignments: {},
        finalGroupIds: [],
        hasEditedFinalSelection: false,
      }));
      break;
    case "clear-shortlist":
      setState((current) => ({
        ...current,
        shortlistedValues: [],
        assignments: {},
        finalGroupIds: [],
        hasEditedFinalSelection: false,
      }));
      break;
    case "add-group":
      addGroup();
      break;
    case "remove-group":
      removeGroup(groupId);
      break;
    case "auto-group-remaining":
      autoGroupRemaining();
      break;
    case "toggle-final-group":
      toggleFinalGroup(groupId);
      break;
    case "copy-results":
      copyResults();
      break;
    case "copy-share":
      copyShareText();
      break;
    case "download-results":
      downloadResults();
      break;
    case "download-share-image":
      downloadShareImage();
      break;
    case "restart":
      restart();
      break;
    default:
      break;
  }
}

function handleInput(event) {
  const target = event.target;

  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
    return;
  }

  const action = target.dataset.action;

  if (action === "rename-group" && target instanceof HTMLInputElement) {
    const groupId = target.dataset.groupId;
    if (!groupId) {
      return;
    }

    setState(
      (current) => ({
        ...current,
        groups: current.groups.map((group) =>
          group.id === groupId ? { ...group, name: target.value } : group
        ),
      }),
      event.type === "change"
    );
    return;
  }

  if (action === "update-reflection" && target instanceof HTMLTextAreaElement) {
    const groupId = target.dataset.groupId;
    const field = target.dataset.field;

    if (!groupId || !field) {
      return;
    }

    setState(
      (current) => ({
        ...current,
        reflections: {
          ...current.reflections,
          [groupId]: {
            ...(current.reflections[groupId] || { meaning: "", honored: "", missing: "" }),
            [field]: target.value,
          },
        },
      }),
      false
    );

    updateAutosaveStatus();
  }
}

function handleDragStart(event) {
  const target = event.target instanceof Element ? event.target.closest("[data-drag-value]") : null;
  if (!target || !(target instanceof HTMLElement)) {
    return;
  }

  draggedValue = target.dataset.dragValue || "";
  target.classList.add("is-dragging");

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedValue);
  }
}

function handleDragOver(event) {
  const zone = event.target instanceof Element ? event.target.closest("[data-drop-group]") : null;
  if (!zone) {
    return;
  }

  event.preventDefault();
  clearDropTargets();
  zone.classList.add("is-over");

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
}

function handleDragLeave(event) {
  const zone = event.target instanceof Element ? event.target.closest("[data-drop-group]") : null;
  if (!zone) {
    return;
  }

  if (!zone.contains(event.relatedTarget)) {
    zone.classList.remove("is-over");
  }
}

function handleDrop(event) {
  const zone = event.target instanceof Element ? event.target.closest("[data-drop-group]") : null;
  if (!zone) {
    return;
  }

  event.preventDefault();
  const value = draggedValue || event.dataTransfer?.getData("text/plain") || "";
  const groupId = zone.dataset.dropGroup || "";

  clearDropTargets();
  draggedValue = "";

  if (!value || !state.shortlistedValues.includes(value)) {
    return;
  }

  setState((current) => ({
    ...current,
    assignments: {
      ...current.assignments,
      [value]: groupId,
    },
  }));
}

function handleDragEnd() {
  draggedValue = "";
  clearDropTargets();
  document.querySelectorAll(".is-dragging").forEach((element) => {
    element.classList.remove("is-dragging");
  });
}

function clearDropTargets() {
  document.querySelectorAll("[data-drop-group].is-over").forEach((element) => {
    element.classList.remove("is-over");
  });
}

function goToStep(step) {
  const allowed = reachableStep(step, state);

  if (allowed !== step) {
    if (step === "shortlist") {
      showToast("Highlight at least one value before moving to the shortlist.");
    } else if (step === "group") {
      showToast("Choose at least a few shortlisted values before grouping them.");
    } else if (step === "select") {
      showToast("Assign every shortlisted value to a named group before moving ahead.");
    } else if (step === "reflect") {
      showToast(
        groupingReady(state)
          ? "Choose at least 1 and no more than 5 final values before moving ahead."
          : "Finish grouping your values before moving ahead."
      );
    } else {
      showToast("Complete your final value choices before moving ahead.");
    }
    return;
  }

  setState((current) => ({ ...current, currentStep: step }));
}

function reachableStep(candidate, snapshot) {
  const allowed = ["welcome", "highlight"];

  if (snapshot.highlightedValues.length > 0) {
    allowed.push("shortlist");
  }

  if (snapshot.shortlistedValues.length > 0) {
    allowed.push("group");
  }

  if (groupingReady(snapshot)) {
    allowed.push("select");
  }

  if (finalSelectionReady(snapshot)) {
    allowed.push("reflect", "results");
  }

  return allowed.includes(candidate) ? candidate : allowed[allowed.length - 1];
}

function toggleValue(field, value) {
  const selected = state[field];
  const isSelected = selected.includes(value);

  setState((current) => ({
    ...current,
    [field]: isSelected
      ? current[field].filter((item) => item !== value)
      : [...current[field], value],
  }));
}

function toggleShortlist(value) {
  const isSelected = state.shortlistedValues.includes(value);

  if (isSelected) {
    setState((current) => {
      const nextShortlisted = current.shortlistedValues.filter((item) => item !== value);
      const nextAssignments = { ...current.assignments };
      delete nextAssignments[value];

      return {
        ...current,
        shortlistedValues: nextShortlisted,
        assignments: nextAssignments,
      };
    });
    return;
  }

  if (state.shortlistedValues.length >= 25) {
    showToast("This round is capped at 25 values.");
    return;
  }

  setState((current) => ({
    ...current,
    shortlistedValues: [...current.shortlistedValues, value],
  }));
}

function addGroup() {
  if (state.groups.length >= Math.max(state.shortlistedValues.length, 1)) {
    return;
  }

  setState((current) => ({
    ...current,
    groups: [...current.groups, { id: nextGroupId(current.groups), name: "" }],
  }));
}

function removeGroup(groupId) {
  if (state.groups.length <= 1) {
    return;
  }

  setState((current) => {
    const nextAssignments = { ...current.assignments };
    Object.keys(nextAssignments).forEach((value) => {
      if (nextAssignments[value] === groupId) {
        nextAssignments[value] = "";
      }
    });

    const nextReflections = { ...current.reflections };
    delete nextReflections[groupId];

    return {
      ...current,
      groups: current.groups.filter((group) => group.id !== groupId),
      assignments: nextAssignments,
      reflections: nextReflections,
    };
  });
}

function autoGroupRemaining() {
  const unassigned = getUnassignedValues(state);

  if (!unassigned.length) {
    return;
  }

  setState((current) => {
    const nextGroups = [...current.groups];
    const nextAssignments = { ...current.assignments };
    const availableGroupIds = nextGroups
      .filter((group) => getGroupMembers(group.id, current).length === 0)
      .map((group) => group.id);

    unassigned.forEach((value) => {
      let groupId = availableGroupIds.shift();

      if (!groupId) {
        const nextId = nextGroupId(nextGroups);
        nextGroups.push({ id: nextId, name: "" });
        groupId = nextId;
      }

      nextAssignments[value] = groupId;
    });

    return {
      ...current,
      groups: nextGroups,
      assignments: nextAssignments,
    };
  });
}

function toggleFinalGroup(groupId) {
  const activeGroupIds = getActiveGroups(state).map((group) => group.id);
  const isSelected = state.finalGroupIds.includes(groupId);

  if (!isSelected && state.finalGroupIds.length >= 5) {
    showToast("Choose up to 5 final values.");
    return;
  }

  setState((current) => ({
    ...current,
    hasEditedFinalSelection: true,
    finalGroupIds: isSelected
      ? current.finalGroupIds.filter((id) => id !== groupId)
      : activeGroupIds.filter((id) => id === groupId || current.finalGroupIds.includes(id)),
  }));
}

function getGroupMembers(groupId, snapshot = state) {
  return snapshot.shortlistedValues.filter((value) => snapshot.assignments[value] === groupId);
}

function getActiveGroups(snapshot = state) {
  return snapshot.groups.filter((group) => getGroupMembers(group.id, snapshot).length > 0);
}

function getUnassignedValues(snapshot = state) {
  return snapshot.shortlistedValues.filter((value) => !snapshot.assignments[value]);
}

function groupingReady(snapshot = state) {
  const activeGroups = getActiveGroups(snapshot);
  const allAssigned = snapshot.shortlistedValues.length > 0 && getUnassignedValues(snapshot).length === 0;
  const namedGroups = activeGroups.every((group) => getGroupResolvedName(group.id, snapshot));

  return allAssigned && activeGroups.length > 0 && namedGroups;
}

function needsFinalSelection(snapshot = state) {
  return getActiveGroups(snapshot).length > 5;
}

function finalSelectionReady(snapshot = state) {
  if (!groupingReady(snapshot)) {
    return false;
  }

  const activeGroupIds = getActiveGroups(snapshot).map((group) => group.id);
  return (
    snapshot.finalGroupIds.length >= 1 &&
    snapshot.finalGroupIds.length <= 5 &&
    snapshot.finalGroupIds.every((groupId) => activeGroupIds.includes(groupId))
  );
}

function groupingStatus(snapshot = state) {
  const activeGroups = getActiveGroups(snapshot);
  const unassigned = getUnassignedValues(snapshot);

  if (unassigned.length > 0) {
    return `${unassigned.length} ${unassigned.length === 1 ? "value still needs" : "values still need"} a group`;
  }

  if (activeGroups.length === 0) {
    return "Create at least one group";
  }

  if (activeGroups.some((group) => !getGroupResolvedName(group.id, snapshot))) {
    return "Name each active group before continuing";
  }

  return "Grouping is complete";
}

function getGroupById(groupId, snapshot = state) {
  return snapshot.groups.find((group) => group.id === groupId) || { id: groupId, name: "" };
}

function getGroupResolvedName(groupId, snapshot = state) {
  const group = getGroupById(groupId, snapshot);
  const explicitName = group.name.trim();
  if (explicitName) {
    return explicitName;
  }

  const members = getGroupMembers(groupId, snapshot);
  return members[0] || "";
}

function buildSummary() {
  const finalValues = state.finalGroupIds.map((groupId) => getGroupResolvedName(groupId));
  const flattenedValues = state.finalGroupIds.flatMap((groupId) => getGroupMembers(groupId));
  const allReflections = state.finalGroupIds
    .map((groupId) => state.reflections[groupId] || {})
    .map((reflection) => `${reflection.meaning || ""} ${reflection.honored || ""}`.toLowerCase())
    .join(" ");
  const missingReflections = state.finalGroupIds
    .map((groupId) => state.reflections[groupId] || {})
    .map((reflection) => reflection.missing || "")
    .join(" ")
    .toLowerCase();

  const honoredThemes = detectThemes(allReflections);
  const missingThemes = detectThemes(missingReflections);
  const workNeeds = deriveWorkNeeds(flattenedValues);

  const firstParagraph = finalValues.length
    ? `Your final values profile centers on ${naturalList(finalValues)}. These appear to be the clearest anchors for how you define alignment in your life or work right now.`
    : "Your final categories capture the values that currently matter most to you right now.";

  const secondParagraph = honoredThemes.length
    ? `Across your reflections, you seem to do your best when there is ${naturalList(honoredThemes)}.`
    : `Across your reflections, the clearest pattern is a desire for a life and work rhythm that feels aligned, thoughtful, and personally sustainable.`;

  const thirdParagraph = missingThemes.length
    ? `When these values are missing, the friction seems to show up as the absence of ${naturalList(missingThemes)}.`
    : `When these values are missing, the tension is likely to show up quickly in how steady, engaged, and effective the work feels.`;

  const fourthParagraph = workNeeds.length
    ? `Taken together, environments that fit you well are likely to offer ${naturalList(workNeeds)}.`
    : `Taken together, the right environments for you are likely to make your priorities visible in day-to-day life, not just in stated ideals.`;

  return [firstParagraph, secondParagraph, thirdParagraph, fourthParagraph];
}

function getShareMarkers(snapshot = state) {
  return snapshot.finalGroupIds.map((groupId, index) => ({
    ...SHARE_MARKERS[index % SHARE_MARKERS.length],
    label: getGroupResolvedName(groupId, snapshot),
  }));
}

function buildShareText(snapshot = state) {
  const markers = getShareMarkers(snapshot);

  return [
    "Values Exercise",
    markers.map((marker) => marker.emoji).join(""),
    markers.map((marker) => marker.label).join(" • "),
  ].join("\n");
}

function detectThemes(text) {
  return THEMES.filter((theme) => theme.keywords.some((keyword) => text.includes(keyword))).map(
    (theme) => theme.label
  ).slice(0, 3);
}

function deriveWorkNeeds(values) {
  const buckets = [
    {
      label: "clear ownership and thoughtful autonomy",
      matches: ["Autonomy", "Independence", "Freedom", "Trust", "Flexibility"],
    },
    {
      label: "steady support and a dependable foundation",
      matches: ["Security", "Stability", "Job security", "Financial stability", "Support", "Safety"],
    },
    {
      label: "growth, stretch, and real learning",
      matches: ["Growth", "Learning", "Challenge", "Mastery", "Curiosity", "Improvement"],
    },
    {
      label: "strong collaboration and healthy relationships",
      matches: ["Collaboration", "Teamwork", "Belonging", "Community", "Connection", "Respect"],
    },
    {
      label: "meaningful contribution and visible impact",
      matches: ["Impact", "Purpose", "Meaningful Work", "Making a difference", "Service", "Contribution"],
    },
    {
      label: "high standards, quality, and pride in the work",
      matches: ["Craft", "Mastery", "Excellence", "Competence", "Creativity", "Integrity"],
    },
    {
      label: "recognition, influence, and room to lead",
      matches: ["Recognition", "Influence", "Leadership", "Status", "Authority", "Power"],
    },
  ];

  return buckets
    .filter((bucket) => bucket.matches.some((match) => values.includes(match)))
    .map((bucket) => bucket.label)
    .slice(0, 3);
}

function naturalList(items) {
  const clean = items.filter(Boolean);
  if (clean.length === 0) {
    return "";
  }
  if (clean.length === 1) {
    return clean[0];
  }
  if (clean.length === 2) {
    return `${clean[0]} and ${clean[1]}`;
  }
  return `${clean.slice(0, -1).join(", ")}, and ${clean[clean.length - 1]}`;
}

function updateAutosaveStatus() {
  const status = document.getElementById("autosave-status");
  if (!status) {
    return;
  }

  status.textContent = "Saved just now.";
  window.clearTimeout(updateAutosaveStatus.timer);
  updateAutosaveStatus.timer = window.setTimeout(() => {
    const nextStatus = document.getElementById("autosave-status");
    if (nextStatus) {
      nextStatus.textContent = "Autosaving locally.";
    }
  }, 1400);
}

function copyResults() {
  const text = resultsText();

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard
      .writeText(text)
      .then(() => showToast("Results copied to your clipboard."))
      .catch(() => fallbackCopy(text));
    return;
  }

  fallbackCopy(text);
}

function copyShareText() {
  const text = buildShareText();

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard
      .writeText(text)
      .then(() => showToast("Share text copied to your clipboard."))
      .catch(() => fallbackCopy(text));
    return;
  }

  fallbackCopy(text);
}

function fallbackCopy(text) {
  const helper = document.createElement("textarea");
  helper.value = text;
  helper.setAttribute("readonly", "true");
  helper.style.position = "fixed";
  helper.style.opacity = "0";
  document.body.appendChild(helper);
  helper.select();

  try {
    document.execCommand("copy");
    showToast("Results copied to your clipboard.");
  } catch (error) {
    showToast("Copy was blocked. You can still download the text file.");
  }

  document.body.removeChild(helper);
}

function downloadResults() {
  const blob = new Blob([resultsText()], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `professional-values-${stamp}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast("Downloaded your results as a text file.");
}

async function downloadShareImage() {
  const markers = getShareMarkers();
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    showToast("Your browser could not create the share image.");
    return;
  }

  const width = 1400;
  const height = 900;
  canvas.width = width;
  canvas.height = height;

  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch (error) {
      // Font readiness is helpful but not required for export.
    }
  }

  context.fillStyle = "#fff7ef";
  context.fillRect(0, 0, width, height);

  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#fff8f0");
  gradient.addColorStop(1, "#f5e7d7");
  context.fillStyle = gradient;
  roundRect(context, 70, 70, width - 140, height - 140, 42);
  context.fill();

  context.fillStyle = "#cb4a20";
  roundRect(context, 70, 70, width - 140, 18, 18);
  context.fill();

  context.fillStyle = "#70564a";
  context.font = "700 28px Inter, system-ui, sans-serif";
  context.fillText("Values Exercise", 120, 160);

  context.fillStyle = "#1e130f";
  context.font = "700 78px Inter, system-ui, sans-serif";
  wrapCanvasText(context, "My values snapshot", 120, 250, width - 240, 92);

  const tileSize = 118;
  const tileGap = 26;
  const rowWidth = markers.length * tileSize + Math.max(markers.length - 1, 0) * tileGap;
  let tileX = (width - rowWidth) / 2;

  markers.forEach((marker) => {
    context.fillStyle = marker.color;
    roundRect(context, tileX, 355, tileSize, tileSize, 28);
    context.fill();

    context.fillStyle = "#ffffff";
    context.font = "700 54px Inter, system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(marker.emoji, tileX + tileSize / 2, 355 + tileSize / 2 + 4);
    tileX += tileSize + tileGap;
  });

  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillStyle = "#1e130f";
  context.font = "700 34px Inter, system-ui, sans-serif";
  context.fillText("Final values", 120, 565);

  context.font = "500 30px Inter, system-ui, sans-serif";
  const labels = markers.map((marker) => marker.label);
  const labelLines = chunkLabels(labels, 2);
  labelLines.forEach((line, index) => {
    context.fillText(line.join(" • "), 120, 625 + index * 46);
  });

  context.fillStyle = "#70564a";
  context.font = "500 24px Inter, system-ui, sans-serif";
  context.fillText(buildShareText().split("\n")[1], 120, 760);

  const stamp = new Date().toISOString().slice(0, 10);
  canvas.toBlob((blob) => {
    if (!blob) {
      showToast("Your browser could not create the share image.");
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `values-share-${stamp}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("Downloaded your share image.");
  }, "image/png");
}

function resultsText() {
  const summary = buildSummary();
  const lines = [
    "Professional Values Exercise",
    "",
    "Final Values",
    ...state.finalGroupIds.map((groupId) => {
      const members = getGroupMembers(groupId);
      return `- ${getGroupResolvedName(groupId)} (${members.join(", ")})`;
    }),
    "",
    "Summary",
    ...summary,
    "",
    "Reflections",
  ];

  state.finalGroupIds.forEach((groupId) => {
    const members = getGroupMembers(groupId);
    const reflection = state.reflections[groupId] || {};

    lines.push("");
    lines.push(getGroupResolvedName(groupId));
    lines.push(`Grouped values: ${members.join(", ") || "-"}`);
    lines.push(`How you define it: ${reflection.meaning || "-"}`);
    lines.push(`How you recognize it: ${reflection.honored || "-"}`);
    lines.push(`How you know it is missing: ${reflection.missing || "-"}`);
  });

  return lines.join("\n");
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function wrapCanvasText(context, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let currentY = y;

  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;
    if (context.measureText(testLine).width > maxWidth && line) {
      context.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
      return;
    }

    line = testLine;
  });

  if (line) {
    context.fillText(line, x, currentY);
  }
}

function chunkLabels(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function restart() {
  const confirmed = window.confirm("Restart the exercise and clear your saved progress?");
  if (!confirmed) {
    return;
  }

  state = defaultState();
  saveState();
  render();
  showToast("Exercise restarted.");
}

function goBack() {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }

  showToast("No previous page to go back to.");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2400);
}

function formatReflection(text) {
  if (!text) {
    return '<span class="empty-note">No reflection captured yet.</span>';
  }

  return escapeHtml(text).replace(/\n/g, "<br>");
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
