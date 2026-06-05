const STORAGE_KEY = "professional-values-exercise-v2";
const LEGACY_STORAGE_KEY = "professional-values-exercise-v1";

const STEPS = [
  { id: "welcome", label: "Welcome" },
  { id: "highlight", label: "Highlight" },
  { id: "shortlist", label: "Shortlist" },
  { id: "group", label: "Group" },
  { id: "rank", label: "Rank" },
  { id: "reflect", label: "Reflect" },
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
    rankedGroupIds: [],
    reflections: {},
  };
}

function createDefaultGroups() {
  return [1, 2, 3].map((index) => ({ id: `group-${index}`, name: "" }));
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
  const groups = createDefaultGroups();
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
    rankedGroupIds: [],
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
  let rankedGroupIds = uniqueIds(base.rankedGroupIds, activeGroups.map((group) => group.id));
  rankedGroupIds = rankedGroupIds.concat(
    activeGroups.map((group) => group.id).filter((groupId) => !rankedGroupIds.includes(groupId))
  );

  const reflections = {};
  rankedGroupIds.forEach((groupId) => {
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
    rankedGroupIds,
    reflections,
  });

  return {
    currentStep,
    highlightedValues,
    shortlistedValues,
    groups,
    assignments,
    rankedGroupIds,
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

  while (result.length < 3) {
    result.push({ id: nextGroupId(result), name: "" });
  }

  return result.slice(0, 5);
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
    case "rank":
      renderRank();
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
        <div class="panel-hero">
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
          <p class="panel-copy">Your progress saves on this device, and most people finish in about 10 to 15 minutes.</p>
        </div>

        <div class="welcome-grid">
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
            <strong class="welcome-step-title">Group &amp; rank</strong>
            <p class="support-copy">Combine related ideas, name them in your own words, and order what matters most.</p>
          </div>
          <div class="welcome-step">
            <span class="welcome-step-number">4</span>
            <strong class="welcome-step-title">Define &amp; reflect</strong>
            <p class="support-copy">Describe what each value means, how it shows up, and what happens when it is missing.</p>
          </div>
        </div>

        <div class="button-row">
          <p class="microcopy">Start whenever you're ready.</p>
          <div class="button-group">
            <button class="button button-primary" data-action="goto" data-step="highlight">
              Start exercise
            </button>
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
          <p class="eyebrow">Highlight</p>
          <h2 class="panel-title">Highlight any values that fit.</h2>
          <p class="panel-copy">Start broad. No limit.</p>
        </div>

        <div class="section-head">
          <div>
            <h3 class="section-title">Values list</h3>
            <p class="support-copy">Tap to highlight.</p>
          </div>
          <div class="counter-pill">
            <span>Highlighted</span>
            <strong>${count}</strong>
          </div>
        </div>

        <div class="helper-card">
          <div>
            <strong>Tip</strong>
            <p class="counter-note">If it matters to your life, your work, or both, mark it.</p>
          </div>
          <div class="save-pill">
            <span>No limit in this round</span>
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
          <p class="eyebrow">Shortlist</p>
          <h2 class="panel-title">Pick your top 25.</h2>
          <p class="panel-copy">Choose up to 25 from your highlights.</p>
        </div>

        <div class="section-head">
          <div>
            <h3 class="section-title">Your highlighted values</h3>
            <p class="support-copy">Only your strongest values.</p>
          </div>
          <div class="counter-pill ${atLimit ? "is-warning" : ""}">
            <span>Shortlisted</span>
            <strong>${count}/25</strong>
          </div>
        </div>

        <div class="helper-card">
          <div>
            <strong>Tip</strong>
            <p class="counter-note">Ask: would I really miss this?</p>
          </div>
          <div class="save-pill">
            <span>Up to 25 values</span>
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

  app.innerHTML = `
    <section class="${panelClass("group")}">
      <div class="panel-inner">
        <div class="panel-hero">
          <p class="eyebrow">Group</p>
          <h2 class="panel-title">Group related values.</h2>
          <p class="panel-copy">Name your groups, then drag values into them.</p>
        </div>

        <div class="section-head">
          <div>
            <h3 class="section-title">Your categories</h3>
            <p class="support-copy">Each group becomes one final value.</p>
          </div>
          <div class="counter-pill ${ready ? "" : "is-warning"}">
            <span>Active groups</span>
            <strong>${activeGroups.length}/3-5</strong>
          </div>
        </div>

        <div class="helper-card">
          <div>
            <strong>Tip</strong>
            <p class="counter-note">Related ideas can live together. Outliers are fine.</p>
          </div>
          <div class="save-pill">
            <span>${status}</span>
          </div>
        </div>

        <div class="group-grid">
          ${state.groups.map((group, index) => renderGroupCard(group, index)).join("")}
        </div>

        <div class="button-row">
          <div class="button-group">
            <button class="button button-secondary" data-action="add-group" ${state.groups.length >= 5 ? "disabled" : ""}>
              Add group
            </button>
          </div>
          <p class="microcopy">Use 3 to 5 groups.</p>
        </div>

        <article class="shortlist-tray" data-drop-group="">
          <div class="dropzone-head">
            <h3 class="dropzone-title">Shortlist</h3>
            <span class="dropzone-count">${unassigned.length}</span>
          </div>
          <div class="dropzone-items">
            ${
              unassigned.length
                ? unassigned.map((value) => renderDragPill(value)).join("")
                : '<p class="dropzone-empty">All values are assigned.</p>'
            }
          </div>
        </article>

        <div class="button-row">
          <div class="button-group">
            <button class="button button-ghost" data-action="goto" data-step="shortlist">Back</button>
          </div>
          <div class="button-group">
            <button class="button button-primary" data-action="goto" data-step="rank" ${ready ? "" : "disabled"}>
              Continue to ranking
            </button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderRank() {
  app.innerHTML = `
    <section class="${panelClass("rank")}">
      <div class="panel-inner">
        <div class="panel-hero">
          <p class="eyebrow">Rank</p>
          <h2 class="panel-title">Rank your final values.</h2>
          <p class="panel-copy">Put the most important at the top.</p>
        </div>

        <div class="helper-card">
          <div>
            <strong>Tip</strong>
            <p class="counter-note">If two clash, which one wins?</p>
          </div>
          <div class="save-pill">
            <span>${state.rankedGroupIds.length} final values</span>
          </div>
        </div>

        <div class="rank-list">
          ${state.rankedGroupIds.map((groupId, index) => renderRankItem(groupId, index)).join("")}
        </div>

        <div class="button-row">
          <div class="button-group">
            <button class="button button-ghost" data-action="goto" data-step="group">Back</button>
          </div>
          <div class="button-group">
            <button class="button button-primary" data-action="goto" data-step="reflect">
              Continue to reflection
            </button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderReflect() {
  const startedCount = state.rankedGroupIds.filter((groupId) => {
    const reflection = state.reflections[groupId] || {};
    return Boolean(reflection.meaning || reflection.honored || reflection.missing);
  }).length;

  app.innerHTML = `
    <section class="${panelClass("reflect")}">
      <div class="panel-inner">
        <div class="panel-hero">
          <p class="eyebrow">Reflect</p>
          <h2 class="panel-title">Add notes for each value.</h2>
          <p class="panel-copy">Keep them short and concrete.</p>
        </div>

        <div class="section-head">
          <div>
            <h3 class="section-title">Reflections</h3>
            <p class="support-copy">Autosaves on this device.</p>
          </div>
          <div class="counter-pill">
            <span>Started</span>
            <strong>${startedCount}/${state.rankedGroupIds.length}</strong>
          </div>
        </div>

        <div class="helper-card">
          <div>
            <strong>Tip</strong>
            <p class="counter-note">Say what it means, what it looks like, and what is missing.</p>
          </div>
          <p class="autosave" id="autosave-status">Autosaving locally.</p>
        </div>

        <div class="reflection-list">
          ${state.rankedGroupIds.map((groupId, index) => renderReflectionCard(groupId, index)).join("")}
        </div>

        <div class="button-row">
          <div class="button-group">
            <button class="button button-ghost" data-action="goto" data-step="rank">Back</button>
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

  app.innerHTML = `
    <section class="${panelClass("results")}">
      <div class="panel-inner">
        <div class="panel-hero">
          <p class="eyebrow">Results</p>
          <h2 class="panel-title">Your values snapshot.</h2>
          <p class="panel-copy">A simple version you can revisit or share.</p>
        </div>

        <div class="results-layout">
          <div class="summary-card">
            <h3 class="result-rank">Ranked values</h3>
            <ol class="result-list">
              ${state.rankedGroupIds.map((groupId) => {
                const group = getGroupById(groupId);
                return `<li>${escapeHtml(group.name.trim())}</li>`;
              }).join("")}
            </ol>
          </div>

          <div class="summary-card">
            <h3 class="result-rank">Concise summary</h3>
            ${summary.map((paragraph) => `<p>${paragraph}</p>`).join("")}
          </div>
        </div>

        <div class="results-list">
          ${state.rankedGroupIds.map((groupId, index) => renderResultCard(groupId, index)).join("")}
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
  const memberCount = getGroupMembers(group.id).length;
  const canRemove = state.groups.length > 3;

  return `
    <article class="group-card">
      <div class="group-card-head">
        <div>
          <h3 class="group-title">Group ${index + 1}</h3>
          <p class="group-note">${memberCount} ${memberCount === 1 ? "value" : "values"} assigned</p>
        </div>
        <button class="button button-ghost button-inline" data-action="remove-group" data-group-id="${group.id}" ${canRemove ? "" : "disabled"}>
          Remove
        </button>
      </div>
      <label class="group-label" for="name-${group.id}">Final value or phrase</label>
      <input
        id="name-${group.id}"
        class="text-input"
        type="text"
        maxlength="80"
        data-action="rename-group"
        data-group-id="${group.id}"
        value="${escapeAttribute(group.name)}"
        placeholder="Example: Meaningful contribution"
      />
      <div class="group-dropzone" data-drop-group="${group.id}">
        <div class="dropzone-head">
          <h4 class="dropzone-title">Values</h4>
          <span class="dropzone-count">${memberCount}</span>
        </div>
        <div class="dropzone-items">
          ${
            memberCount
              ? getGroupMembers(group.id).map((value) => renderDragPill(value)).join("")
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

function renderRankItem(groupId, index) {
  const group = getGroupById(groupId);
  const members = getGroupMembers(groupId);

  return `
    <div class="rank-item">
      <div class="rank-position">${index + 1}</div>
      <div class="rank-content">
        <p class="rank-value">${escapeHtml(group.name.trim())}</p>
        <div class="chip-list chip-list-compact">
          ${members.map((value) => `<span class="chip">${escapeHtml(value)}</span>`).join("")}
        </div>
      </div>
      <div class="rank-actions">
        <button
          class="icon-button"
          data-action="move-rank"
          data-group-id="${groupId}"
          data-direction="up"
          aria-label="Move ${escapeAttribute(group.name.trim())} up"
          ${index === 0 ? "disabled" : ""}
        >
          ↑
        </button>
        <button
          class="icon-button"
          data-action="move-rank"
          data-group-id="${groupId}"
          data-direction="down"
          aria-label="Move ${escapeAttribute(group.name.trim())} down"
          ${index === state.rankedGroupIds.length - 1 ? "disabled" : ""}
        >
          ↓
        </button>
      </div>
    </div>
  `;
}

function renderReflectionCard(groupId, index) {
  const group = getGroupById(groupId);
  const members = getGroupMembers(groupId);
  const reflection = state.reflections[groupId] || { meaning: "", honored: "", missing: "" };

  return `
    <article class="reflection-card">
      <div class="reflection-head">
        <div>
          <h3 class="reflection-value">${escapeHtml(group.name.trim())}</h3>
          <div class="chip-list chip-list-compact">
            ${members.map((value) => `<span class="chip">${escapeHtml(value)}</span>`).join("")}
          </div>
        </div>
        <div class="reflection-rank">Rank #${index + 1}</div>
      </div>

      <div class="field-group">
        <label for="meaning-${groupId}">What does this value mean to you in your life or work?</label>
        <textarea id="meaning-${groupId}" class="text-area" data-action="update-reflection" data-group-id="${groupId}" data-field="meaning" placeholder="Describe what this value means in your day-to-day life or work.">${escapeHtml(reflection.meaning)}</textarea>
      </div>

      <div class="field-group">
        <label for="honored-${groupId}">What does it look like when this value is honored?</label>
        <textarea id="honored-${groupId}" class="text-area" data-action="update-reflection" data-group-id="${groupId}" data-field="honored" placeholder="Describe the signals, behaviors, or conditions that show this value is present.">${escapeHtml(reflection.honored)}</textarea>
      </div>

      <div class="field-group">
        <label for="missing-${groupId}">What does it look like when this value is missing?</label>
        <textarea id="missing-${groupId}" class="text-area" data-action="update-reflection" data-group-id="${groupId}" data-field="missing" placeholder="Describe the friction, absence, or warning signs you notice when this value is not present.">${escapeHtml(reflection.missing)}</textarea>
      </div>
    </article>
  `;
}

function renderResultCard(groupId, index) {
  const group = getGroupById(groupId);
  const members = getGroupMembers(groupId);
  const reflection = state.reflections[groupId] || {};

  return `
    <article class="result-card">
      <h3 class="section-title">${index + 1}. ${escapeHtml(group.name.trim())}</h3>
      <div class="chip-list chip-list-compact">
        ${members.map((value) => `<span class="chip">${escapeHtml(value)}</span>`).join("")}
      </div>
      <h4>What it means to you in your life or work</h4>
      <p>${formatReflection(reflection.meaning)}</p>
      <h4>When it is honored</h4>
      <p>${formatReflection(reflection.honored)}</p>
      <h4>When it is missing</h4>
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
        rankedGroupIds: [],
      }));
      break;
    case "clear-shortlist":
      setState((current) => ({
        ...current,
        shortlistedValues: [],
        assignments: {},
        rankedGroupIds: [],
      }));
      break;
    case "add-group":
      addGroup();
      break;
    case "remove-group":
      removeGroup(groupId);
      break;
    case "move-rank":
      moveRank(groupId, target.dataset.direction);
      break;
    case "copy-results":
      copyResults();
      break;
    case "download-results":
      downloadResults();
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
    } else {
      showToast("Finish grouping and naming 3 to 5 categories before moving ahead.");
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
    allowed.push("rank", "reflect", "results");
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
  if (state.groups.length >= 5) {
    return;
  }

  setState((current) => ({
    ...current,
    groups: [...current.groups, { id: nextGroupId(current.groups), name: "" }],
  }));
}

function removeGroup(groupId) {
  if (state.groups.length <= 3) {
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

function moveRank(groupId, direction) {
  const currentIndex = state.rankedGroupIds.indexOf(groupId);
  if (currentIndex === -1) {
    return;
  }

  const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (nextIndex < 0 || nextIndex >= state.rankedGroupIds.length) {
    return;
  }

  const nextRanked = [...state.rankedGroupIds];
  [nextRanked[currentIndex], nextRanked[nextIndex]] = [nextRanked[nextIndex], nextRanked[currentIndex]];

  setState((current) => ({
    ...current,
    rankedGroupIds: nextRanked,
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
  const namedGroups = activeGroups.every((group) => group.name.trim());

  return allAssigned && activeGroups.length >= 3 && activeGroups.length <= 5 && namedGroups;
}

function groupingStatus(snapshot = state) {
  const activeGroups = getActiveGroups(snapshot);
  const unassigned = getUnassignedValues(snapshot);

  if (unassigned.length > 0) {
    return `${unassigned.length} ${unassigned.length === 1 ? "value still needs" : "values still need"} a group`;
  }

  if (activeGroups.length < 3) {
    return "Create at least 3 active groups";
  }

  if (activeGroups.some((group) => !group.name.trim())) {
    return "Name each active group before continuing";
  }

  return "Grouping is complete";
}

function getGroupById(groupId, snapshot = state) {
  return snapshot.groups.find((group) => group.id === groupId) || { id: groupId, name: "" };
}

function buildSummary() {
  const rankedGroups = state.rankedGroupIds.map((groupId) => getGroupById(groupId));
  const topThree = rankedGroups.slice(0, 3).map((group) => group.name.trim());
  const flattenedValues = state.rankedGroupIds.flatMap((groupId) => getGroupMembers(groupId));
  const allReflections = state.rankedGroupIds
    .map((groupId) => state.reflections[groupId] || {})
    .map((reflection) => `${reflection.meaning || ""} ${reflection.honored || ""}`.toLowerCase())
    .join(" ");
  const missingReflections = state.rankedGroupIds
    .map((groupId) => state.reflections[groupId] || {})
    .map((reflection) => reflection.missing || "")
    .join(" ")
    .toLowerCase();

  const honoredThemes = detectThemes(allReflections);
  const missingThemes = detectThemes(missingReflections);
  const workNeeds = deriveWorkNeeds(flattenedValues);

  const firstParagraph = topThree.length
    ? `Your final values profile centers on ${naturalList(topThree)}. These appear to be the strongest anchors for how you define alignment in your life or work right now.`
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

function resultsText() {
  const summary = buildSummary();
  const lines = [
    "Professional Values Exercise",
    "",
    "Ranked Final Values",
    ...state.rankedGroupIds.map((groupId, index) => {
      const group = getGroupById(groupId);
      const members = getGroupMembers(groupId);
      return `${index + 1}. ${group.name.trim()} (${members.join(", ")})`;
    }),
    "",
    "Summary",
    ...summary,
    "",
    "Reflections",
  ];

  state.rankedGroupIds.forEach((groupId, index) => {
    const group = getGroupById(groupId);
    const members = getGroupMembers(groupId);
    const reflection = state.reflections[groupId] || {};

    lines.push("");
    lines.push(`${index + 1}. ${group.name.trim()}`);
    lines.push(`Grouped values: ${members.join(", ") || "-"}`);
    lines.push(`What it means to you in your life or work: ${reflection.meaning || "-"}`);
    lines.push(`When it is honored: ${reflection.honored || "-"}`);
    lines.push(`When it is missing: ${reflection.missing || "-"}`);
  });

  return lines.join("\n");
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
