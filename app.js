const STORAGE_KEY = "quark-science-bowl-tracker-v1";
const ALL = "__all__";

function createId() {
  return crypto.randomUUID();
}

function createSession(number = 1) {
  return {
    id: createId(),
    name: `Practice Session ${number}`,
    startedAt: new Date().toISOString(),
    completedAt: null,
    responses: [],
  };
}

function createDefaultState() {
  return {
    version: 3,
    currentSession: createSession(),
    sessions: [],
    draft: {
      student: "",
      setName: "",
      round: "1",
      subject: "Biology",
    },
    filters: {
      student: ALL,
      setName: ALL,
      subject: ALL,
      comparisonMetric: "accuracy",
    },
  };
}

let state = loadState();
let activeView = "home";
let pendingAction = null;
let toastTimer = null;

const elements = {
  homeButton: document.querySelector("#homeButton"),
  views: {
    home: document.querySelector("#homeView"),
    session: document.querySelector("#sessionView"),
    data: document.querySelector("#dataView"),
  },
  navButtons: document.querySelectorAll("[data-go-view]"),
  startSessionButton: document.querySelector("#startSessionButton"),
  viewDataButton: document.querySelector("#viewDataButton"),
  sessionMenuTitle: document.querySelector("#sessionMenuTitle"),
  sessionMenuCopy: document.querySelector("#sessionMenuCopy"),
  homeStudentCount: document.querySelector("#homeStudentCount"),
  homeSessionCount: document.querySelector("#homeSessionCount"),
  homeQuestionCount: document.querySelector("#homeQuestionCount"),
  homeAccuracy: document.querySelector("#homeAccuracy"),
  saveState: document.querySelector("#saveState"),
  sessionName: document.querySelector("#sessionName"),
  sessionQuestionTotal: document.querySelector("#sessionQuestionTotal"),
  studentName: document.querySelector("#studentName"),
  studentProfiles: document.querySelector("#studentProfiles"),
  questionSet: document.querySelector("#questionSet"),
  roundNumber: document.querySelector("#roundNumber"),
  difficultyChip: document.querySelector("#difficultyChip"),
  subject: document.querySelector("#subject"),
  errorReason: document.querySelector("#errorReason"),
  questionNote: document.querySelector("#questionNote"),
  questionNumber: document.querySelector("#questionNumber"),
  dateChip: document.querySelector("#dateChip"),
  accuracyRing: document.querySelector("#accuracyRing"),
  accuracyValue: document.querySelector("#accuracyValue"),
  accuracyMessage: document.querySelector("#accuracyMessage"),
  answeredSummary: document.querySelector("#answeredSummary"),
  correctCount: document.querySelector("#correctCount"),
  incorrectCount: document.querySelector("#incorrectCount"),
  errorCount: document.querySelector("#errorCount"),
  nobodyCount: document.querySelector("#nobodyCount"),
  sessionStudentList: document.querySelector("#sessionStudentList"),
  activityBody: document.querySelector("#activityBody"),
  emptyState: document.querySelector("#emptyState"),
  undoButton: document.querySelector("#undoButton"),
  clearButton: document.querySelector("#clearButton"),
  endSessionButton: document.querySelector("#endSessionButton"),
  exportButton: document.querySelector("#exportButton"),
  dataStudentFilter: document.querySelector("#dataStudentFilter"),
  dataSetFilter: document.querySelector("#dataSetFilter"),
  dataSubjectFilter: document.querySelector("#dataSubjectFilter"),
  comparisonMetric: document.querySelector("#comparisonMetric"),
  comparisonChart: document.querySelector("#comparisonChart"),
  comparisonNote: document.querySelector("#comparisonNote"),
  dataStudentCount: document.querySelector("#dataStudentCount"),
  dataQuestionCount: document.querySelector("#dataQuestionCount"),
  dataAccuracy: document.querySelector("#dataAccuracy"),
  dataAverageRound: document.querySelector("#dataAverageRound"),
  studentSummaryBody: document.querySelector("#studentSummaryBody"),
  studentSummaryEmpty: document.querySelector("#studentSummaryEmpty"),
  questionLedgerBody: document.querySelector("#questionLedgerBody"),
  ledgerEmpty: document.querySelector("#ledgerEmpty"),
  ledgerCount: document.querySelector("#ledgerCount"),
  clearQuestionSelect: document.querySelector("#clearQuestionSelect"),
  clearQuestionButton: document.querySelector("#clearQuestionButton"),
  clearStudentSelect: document.querySelector("#clearStudentSelect"),
  clearStudentButton: document.querySelector("#clearStudentButton"),
  clearAllDataButton: document.querySelector("#clearAllDataButton"),
  toast: document.querySelector("#toast"),
  toastIcon: document.querySelector("#toastIcon"),
  toastMessage: document.querySelector("#toastMessage"),
  confirmModal: document.querySelector("#confirmModal"),
  modalTitle: document.querySelector("#modalTitle"),
  modalCopy: document.querySelector("#modalCopy"),
  modalIcon: document.querySelector("#modalIcon"),
  cancelModal: document.querySelector("#cancelModal"),
  confirmModalButton: document.querySelector("#confirmModalButton"),
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return createDefaultState();
    if (saved.version === 3 && saved.currentSession && Array.isArray(saved.sessions)) {
      return normalizeV3(saved);
    }
    return migrateLegacyState(saved);
  } catch {
    return createDefaultState();
  }
}

function normalizeV3(saved) {
  const base = createDefaultState();
  return {
    ...base,
    ...saved,
    version: 3,
    currentSession: normalizeSession(saved.currentSession),
    sessions: saved.sessions.map(normalizeSession),
    draft: { ...base.draft, ...(saved.draft || {}) },
    filters: { ...base.filters, ...(saved.filters || {}) },
  };
}

function migrateLegacyState(saved) {
  const migrated = createDefaultState();
  const legacyStudent = cleanName(saved.student);

  migrated.currentSession = normalizeSession({
    id: saved.sessionId,
    name: saved.session || "Practice Session 1",
    startedAt: saved.sessionStartedAt,
    responses: saved.responses || [],
    fallbackStudent: legacyStudent,
  });

  migrated.sessions = (saved.history || []).map((session) =>
    normalizeSession({
      ...session,
      fallbackStudent: session.student || legacyStudent,
    })
  );

  migrated.draft.student = legacyStudent === "Unnamed student" ? "" : legacyStudent;
  migrated.filters.student =
    saved.historyStudent && saved.historyStudent !== "__all__"
      ? saved.historyStudent
      : ALL;
  return migrated;
}

function normalizeSession(session = {}) {
  const fallbackStudent = session.fallbackStudent || session.student || "";
  return {
    id: session.id || createId(),
    name: session.name || "Practice Session",
    startedAt: session.startedAt || new Date().toISOString(),
    completedAt: session.completedAt || null,
    responses: (session.responses || []).map((response, index) =>
      normalizeResponse(response, index, fallbackStudent)
    ),
  };
}

function normalizeResponse(response, index, fallbackStudent = "") {
  const result = response.result === "No answer" ? "Error" : response.result;
  const nobodyTried = result === "Nobody tried";
  return {
    id: response.id || createId(),
    number: index + 1,
    student: nobodyTried ? "" : cleanName(response.student || fallbackStudent),
    setName: response.setName || response.set || "Unspecified set",
    round: normalizeRound(response.round || response.roundNumber || ""),
    subject: response.subject || "Biology",
    type: response.type || "Toss-up",
    note: response.note || "",
    result: result || "Incorrect",
    errorReason:
      result === "Error"
        ? response.errorReason || (response.result === "No answer" ? "Unspecified" : "Other")
        : "",
    timestamp: response.timestamp || new Date().toISOString(),
  };
}

function cleanName(value) {
  return String(value || "").trim() || "Unnamed student";
}

function canonical(value) {
  return String(value || "").trim().toLocaleLowerCase();
}

function normalizeRound(value) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  elements.saveState.innerHTML = '<span class="save-dot"></span>Saved on this device';
}

function init() {
  elements.dateChip.textContent = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date());

  syncInputsFromState();

  bindEvents();
  renderAll();
  setView("home");
}

function syncInputsFromState() {
  elements.sessionName.value = state.currentSession.name;
  elements.studentName.value = state.draft.student;
  elements.questionSet.value = state.draft.setName;
  elements.roundNumber.value = state.draft.round;
  elements.subject.value = state.draft.subject;
}

function bindEvents() {
  elements.homeButton.addEventListener("click", () => setView("home"));
  elements.navButtons.forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.goView));
  });
  elements.startSessionButton.addEventListener("click", () => setView("session"));
  elements.viewDataButton.addEventListener("click", () => setView("data"));

  elements.sessionName.addEventListener("input", (event) => {
    state.currentSession.name = event.target.value;
    saveState();
  });

  elements.studentName.addEventListener("input", (event) => {
    state.draft.student = event.target.value;
    saveState();
  });

  elements.questionSet.addEventListener("input", (event) => {
    state.draft.setName = event.target.value;
    saveState();
  });

  elements.roundNumber.addEventListener("input", (event) => {
    state.draft.round = event.target.value;
    updateDifficultyChip();
    saveState();
  });

  elements.subject.addEventListener("change", (event) => {
    state.draft.subject = event.target.value;
    saveState();
  });

  document.querySelectorAll(".response-button").forEach((button) => {
    button.addEventListener("click", () => recordResponse(button.dataset.result));
  });

  elements.undoButton.addEventListener("click", undoLast);
  elements.clearButton.addEventListener("click", () => openModal("clear"));
  elements.endSessionButton.addEventListener("click", () => openModal("end"));
  elements.exportButton.addEventListener("click", exportSpreadsheet);

  elements.clearQuestionButton.addEventListener("click", () => {
    const responseId = elements.clearQuestionSelect.value;
    const record = getAllRecords().find(({ response }) => response.id === responseId);
    if (!record) return;
    openModal("clear-question", {
      responseId,
      label: formatQuestionOption(record),
    });
  });

  elements.clearStudentButton.addEventListener("click", () => {
    const student = elements.clearStudentSelect.value;
    if (!student) return;
    openModal("clear-student", { student });
  });

  elements.clearAllDataButton.addEventListener("click", () => openModal("clear-all"));

  elements.activityBody.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-delete-id]");
    if (deleteButton) deleteResponse(deleteButton.dataset.deleteId);
  });

  elements.activityBody.addEventListener("change", (event) => {
    const studentInput = event.target.closest("[data-edit-student-id]");
    if (studentInput) updateResponseStudent(studentInput.dataset.editStudentId, studentInput.value);
  });

  elements.questionLedgerBody.addEventListener("change", (event) => {
    const studentInput = event.target.closest("[data-edit-student-id]");
    if (studentInput) updateResponseStudent(studentInput.dataset.editStudentId, studentInput.value);
  });

  elements.studentSummaryBody.addEventListener("click", (event) => {
    const row = event.target.closest("[data-student-name]");
    if (!row) return;
    state.filters.student = row.dataset.studentName;
    saveState();
    renderData();
  });

  elements.dataStudentFilter.addEventListener("change", (event) => {
    state.filters.student = event.target.value;
    saveState();
    renderData();
  });

  elements.dataSetFilter.addEventListener("change", (event) => {
    state.filters.setName = event.target.value;
    saveState();
    renderData();
  });

  elements.dataSubjectFilter.addEventListener("change", (event) => {
    state.filters.subject = event.target.value;
    saveState();
    renderData();
  });

  elements.comparisonMetric.addEventListener("change", (event) => {
    state.filters.comparisonMetric = event.target.value;
    saveState();
    renderComparison();
  });

  elements.comparisonChart.addEventListener("click", (event) => {
    const row = event.target.closest("[data-compare-student]");
    if (!row) return;
    state.filters.student = row.dataset.compareStudent;
    saveState();
    renderData();
  });

  elements.cancelModal.addEventListener("click", closeModal);
  elements.confirmModalButton.addEventListener("click", confirmModalAction);
  elements.confirmModal.addEventListener("click", (event) => {
    if (event.target === elements.confirmModal) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    const typing = document.activeElement.matches("input, textarea, select");
    if (typing || !elements.confirmModal.hidden || activeView !== "session") return;

    const keyMap = {
      "1": "Correct",
      "2": "Incorrect",
      "3": "Error",
      "4": "Nobody tried",
    };
    if (keyMap[event.key]) {
      event.preventDefault();
      recordResponse(keyMap[event.key]);
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      undoLast();
    }
  });
}

function setView(view) {
  activeView = view;
  Object.entries(elements.views).forEach(([name, section]) => {
    section.hidden = name !== view;
  });
  elements.navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.goView === view);
  });
  if (view === "data") renderData();
  if (view === "session") renderSession();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function recordResponse(result) {
  const nobodyTried = result === "Nobody tried";
  const enteredStudent = elements.studentName.value.trim();
  if (!nobodyTried && !enteredStudent) {
    showToast("!", "Choose or enter the student who answered");
    elements.studentName.focus();
    return;
  }

  const selectedType = document.querySelector('input[name="questionType"]:checked');
  const response = {
    id: createId(),
    number: state.currentSession.responses.length + 1,
    student: nobodyTried ? "" : cleanName(enteredStudent),
    setName: elements.questionSet.value.trim() || "Unspecified set",
    round: normalizeRound(elements.roundNumber.value),
    subject: elements.subject.value,
    type: selectedType.value,
    note: elements.questionNote.value.trim(),
    result,
    errorReason: result === "Error" ? elements.errorReason.value : "",
    timestamp: new Date().toISOString(),
  };

  state.draft.student = enteredStudent;
  state.draft.setName = elements.questionSet.value;
  state.draft.round = elements.roundNumber.value;
  state.draft.subject = elements.subject.value;
  state.currentSession.responses.push(response);
  elements.questionNote.value = "";
  saveState();
  renderAll();

  const messages = {
    Correct: ["✓", `${response.student} marked correct`],
    Incorrect: ["×", `${response.student} marked incorrect`],
    Error: ["!", `${response.student}: ${response.errorReason}`],
    "Nobody tried": ["–", "Marked nobody tried"],
  };
  showToast(...messages[result]);
}

function undoLast() {
  if (!state.currentSession.responses.length) return;
  state.currentSession.responses.pop();
  saveState();
  renderAll();
  showToast("↶", "Last response removed");
}

function deleteResponse(id) {
  state.currentSession.responses = state.currentSession.responses.filter(
    (response) => response.id !== id
  );
  renumberCurrentResponses();
  saveState();
  renderAll();
  showToast("×", "Response removed");
}

function updateResponseStudent(id, value) {
  const response = findResponse(id);
  if (!response || response.result === "Nobody tried") return;
  response.student = cleanName(value);
  state.draft.student = response.student;
  elements.studentName.value = response.student;
  saveState();
  renderAll();
  showToast("✓", `Response reassigned to ${response.student}`);
}

function findResponse(id) {
  const current = state.currentSession.responses.find((response) => response.id === id);
  if (current) return current;
  for (const session of state.sessions) {
    const response = session.responses.find((item) => item.id === id);
    if (response) return response;
  }
  return null;
}

function renumberCurrentResponses() {
  renumberResponses(state.currentSession);
}

function renumberResponses(session) {
  session.responses.forEach((response, index) => {
    response.number = index + 1;
  });
}

function pruneEmptySavedSessions() {
  state.sessions = state.sessions.filter((session) => session.responses.length);
}

function removeMatchingResponses(session, matcher) {
  const before = session.responses.length;
  session.responses = session.responses.filter((response) => !matcher(response));
  if (session.responses.length !== before) renumberResponses(session);
  return before - session.responses.length;
}

function clearQuestionById(responseId) {
  let removed = removeMatchingResponses(
    state.currentSession,
    (response) => response.id === responseId
  );

  if (!removed) {
    for (const session of state.sessions) {
      removed = removeMatchingResponses(session, (response) => response.id === responseId);
      if (removed) break;
    }
  }

  if (!removed) return 0;
  pruneEmptySavedSessions();
  saveState();
  renderAll();
  return removed;
}

function clearStudentData(student) {
  const target = canonical(student);
  const matcher = (response) => canonical(response.student) === target;
  let removed = removeMatchingResponses(state.currentSession, matcher);

  state.sessions.forEach((session) => {
    removed += removeMatchingResponses(session, matcher);
  });

  if (!removed) return 0;
  pruneEmptySavedSessions();
  if (canonical(state.filters.student) === target) state.filters.student = ALL;
  saveState();
  renderAll();
  return removed;
}

function clearAllWorkbookData() {
  state = createDefaultState();
  syncInputsFromState();
  saveState();
  renderAll();
  setView("data");
}

function countResults(responses) {
  const counts = { Correct: 0, Incorrect: 0, Error: 0, "Nobody tried": 0 };
  responses.forEach((response) => {
    if (Object.hasOwn(counts, response.result)) counts[response.result] += 1;
  });
  counts.attempted = counts.Correct + counts.Incorrect + counts.Error;
  counts.total = responses.length;
  counts.accuracy = counts.attempted
    ? Math.round((counts.Correct / counts.attempted) * 100)
    : null;
  return counts;
}

function difficultyForRound(round) {
  if (!round) return "Unknown";
  if (round <= 3) return "Foundational";
  if (round <= 6) return "Moderate";
  if (round <= 9) return "Advanced";
  return "Championship";
}

function updateDifficultyChip() {
  const round = normalizeRound(elements.roundNumber.value);
  elements.difficultyChip.textContent = round
    ? `Round ${round} · ${difficultyForRound(round)}`
    : "Round not set";
}

function renderAll() {
  renderHome();
  renderSession();
  renderDataOptions();
  renderData();
}

function renderHome() {
  const records = getAllRecords();
  const students = getStudentNames(records);
  const counts = countResults(records.map((record) => record.response));
  const sessionCount =
    state.sessions.length + (state.currentSession.responses.length ? 1 : 0);

  elements.homeStudentCount.textContent = students.length;
  elements.homeSessionCount.textContent = sessionCount;
  elements.homeQuestionCount.textContent = records.length;
  elements.homeAccuracy.textContent = counts.accuracy === null ? "—" : `${counts.accuracy}%`;

  const inProgress = state.currentSession.responses.length;
  elements.sessionMenuTitle.textContent = inProgress ? "Resume session" : "Start a session";
  elements.sessionMenuCopy.textContent = inProgress
    ? `${inProgress} ${inProgress === 1 ? "question" : "questions"} currently logged in ${state.currentSession.name || "this session"}.`
    : "Record each student's response as questions are read.";
}

function renderSession() {
  const responses = state.currentSession.responses;
  const counts = countResults(responses);

  elements.sessionName.value = state.currentSession.name;
  elements.sessionQuestionTotal.textContent = responses.length;
  elements.questionNumber.textContent = responses.length + 1;
  elements.correctCount.textContent = counts.Correct;
  elements.incorrectCount.textContent = counts.Incorrect;
  elements.errorCount.textContent = counts.Error;
  elements.nobodyCount.textContent = counts["Nobody tried"];
  elements.accuracyValue.textContent = counts.accuracy === null ? "—" : `${counts.accuracy}%`;
  elements.answeredSummary.textContent =
    `${counts.attempted} student ${counts.attempted === 1 ? "attempt" : "attempts"}` +
    (counts["Nobody tried"] ? ` · ${counts["Nobody tried"]} unattempted` : "");
  elements.undoButton.disabled = responses.length === 0;
  elements.clearButton.disabled = responses.length === 0;
  elements.endSessionButton.disabled = responses.length === 0;
  setRing(elements.accuracyRing, counts.accuracy);

  if (counts.accuracy === null) {
    elements.accuracyMessage.textContent = "Log the first student attempt to begin.";
  } else if (counts.accuracy >= 80) {
    elements.accuracyMessage.textContent = "The group is having a strong round.";
  } else if (counts.accuracy >= 60) {
    elements.accuracyMessage.textContent = "A solid session with useful review points.";
  } else {
    elements.accuracyMessage.textContent = "This session is surfacing practice priorities.";
  }

  updateDifficultyChip();
  renderStudentProfiles();
  renderSessionStudentList(responses);
  renderActivity(responses);
}

function setRing(element, accuracy) {
  element.style.background = `conic-gradient(var(--green) ${
    accuracy === null ? 0 : accuracy * 3.6
  }deg, #e9edef 0deg)`;
}

function renderStudentProfiles() {
  elements.studentProfiles.innerHTML = getStudentNames(getAllRecords())
    .map((student) => `<option value="${escapeHTML(student)}"></option>`)
    .join("");
}

function getStudentNames(records) {
  const names = new Map();
  records.forEach(({ response }) => {
    if (response.student) names.set(canonical(response.student), response.student);
  });
  return [...names.values()].sort((a, b) => a.localeCompare(b));
}

function groupStudentStats(responses) {
  const students = new Map();
  responses.forEach((response) => {
    if (!response.student) return;
    const key = canonical(response.student);
    if (!students.has(key)) students.set(key, { name: response.student, responses: [] });
    students.get(key).responses.push(response);
  });
  return [...students.values()]
    .map((student) => ({
      ...student,
      counts: countResults(student.responses),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function renderSessionStudentList(responses) {
  const students = groupStudentStats(responses);
  if (!students.length) {
    elements.sessionStudentList.innerHTML =
      '<div class="empty-mini">Student results will appear here.</div>';
    return;
  }

  elements.sessionStudentList.innerHTML = students
    .map(
      (student) => `
        <div class="mini-student-row">
          <span>${escapeHTML(student.name)}</span>
          <span>${student.counts.accuracy === null ? "—" : `${student.counts.accuracy}%`}</span>
        </div>
      `
    )
    .join("");
}

function renderActivity(responses) {
  elements.emptyState.hidden = responses.length > 0;
  elements.activityBody.innerHTML = [...responses]
    .reverse()
    .map((response) => {
      const resultClass = response.result.toLowerCase().replaceAll(" ", "-");
      const resultLabel =
        response.result === "Error"
          ? `${response.result} · ${response.errorReason}`
          : response.result;
      const time = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(response.timestamp));
      return `
        <tr>
          <td>${response.number}</td>
          <td class="student-cell">
            ${
              response.student
                ? `<input class="table-student-input" data-edit-student-id="${response.id}" value="${escapeHTML(response.student)}" aria-label="Student for question ${response.number}" />`
                : "—"
            }
          </td>
          <td>${escapeHTML(response.setName)}</td>
          <td>${response.round || "—"}</td>
          <td>${escapeHTML(response.subject)}</td>
          <td>${escapeHTML(response.type)}</td>
          <td><span class="result-badge result-${resultClass}">${escapeHTML(resultLabel)}</span></td>
          <td class="note-cell" title="${escapeHTML(response.note || "No note")}">${escapeHTML(response.note || "—")}</td>
          <td>${time}</td>
          <td><button class="delete-row" data-delete-id="${response.id}" type="button" aria-label="Delete question ${response.number}">×</button></td>
        </tr>
      `;
    })
    .join("");
}

function getAllSessions() {
  const sessions = [...state.sessions];
  if (state.currentSession.responses.length) {
    sessions.push({ ...state.currentSession, isCurrent: true });
  }
  return sessions;
}

function getAllRecords() {
  return getAllSessions().flatMap((session) =>
    session.responses.map((response) => ({ session, response }))
  );
}

function renderDataOptions() {
  const records = getAllRecords();
  const students = getStudentNames(records);
  const sets = [...new Set(records.map(({ response }) => response.setName))].sort();
  const subjects = [...new Set(records.map(({ response }) => response.subject))].sort();

  if (
    state.filters.student !== ALL &&
    !students.some((student) => canonical(student) === canonical(state.filters.student))
  ) {
    state.filters.student = ALL;
  }
  if (state.filters.setName !== ALL && !sets.includes(state.filters.setName)) {
    state.filters.setName = ALL;
  }
  if (state.filters.subject !== ALL && !subjects.includes(state.filters.subject)) {
    state.filters.subject = ALL;
  }

  elements.dataStudentFilter.innerHTML = `
    <option value="${ALL}">All students</option>
    ${students
      .map(
        (student) =>
          `<option value="${escapeHTML(student)}">${escapeHTML(student)}</option>`
      )
      .join("")}
  `;
  elements.dataSetFilter.innerHTML = `
    <option value="${ALL}">All sets</option>
    ${sets
      .map((setName) => `<option value="${escapeHTML(setName)}">${escapeHTML(setName)}</option>`)
      .join("")}
  `;
  elements.dataSubjectFilter.innerHTML = `
    <option value="${ALL}">All subjects</option>
    ${subjects
      .map((subject) => `<option value="${escapeHTML(subject)}">${escapeHTML(subject)}</option>`)
      .join("")}
  `;

  elements.dataStudentFilter.value = state.filters.student;
  elements.dataSetFilter.value = state.filters.setName;
  elements.dataSubjectFilter.value = state.filters.subject;
}

function getFilteredRecords() {
  return getAllRecords().filter(({ response }) => {
    const studentMatches =
      state.filters.student === ALL ||
      canonical(response.student) === canonical(state.filters.student);
    const setMatches =
      state.filters.setName === ALL || response.setName === state.filters.setName;
    const subjectMatches =
      state.filters.subject === ALL || response.subject === state.filters.subject;
    return studentMatches && setMatches && subjectMatches;
  });
}

function getComparisonRecords() {
  return getAllRecords().filter(({ response }) => {
    const setMatches =
      state.filters.setName === ALL || response.setName === state.filters.setName;
    const subjectMatches =
      state.filters.subject === ALL || response.subject === state.filters.subject;
    return setMatches && subjectMatches;
  });
}

function renderData() {
  renderDataOptions();
  renderClearDataControls();
  const records = getFilteredRecords();
  const responses = records.map(({ response }) => response);
  const counts = countResults(responses);
  const studentStats = groupStudentStats(responses);
  const numberedRounds = responses
    .map((response) => response.round)
    .filter((round) => Number.isFinite(round));
  const averageRound = numberedRounds.length
    ? numberedRounds.reduce((sum, round) => sum + round, 0) / numberedRounds.length
    : null;

  elements.dataStudentCount.textContent = studentStats.length;
  elements.dataQuestionCount.textContent = responses.length;
  elements.dataAccuracy.textContent = counts.accuracy === null ? "—" : `${counts.accuracy}%`;
  elements.dataAverageRound.textContent =
    averageRound === null ? "—" : averageRound.toFixed(1).replace(".0", "");
  elements.ledgerCount.textContent = `${records.length} ${
    records.length === 1 ? "row" : "rows"
  }`;
  elements.exportButton.disabled = records.length === 0;

  renderComparison();
  renderStudentSummary(studentStats);
  renderQuestionLedger(records);
}

function renderClearDataControls() {
  const records = getAllRecords().sort(
    (a, b) =>
      new Date(b.response.timestamp).getTime() - new Date(a.response.timestamp).getTime()
  );
  const students = getStudentNames(records);
  const previousQuestion = elements.clearQuestionSelect.value;
  const previousStudent = elements.clearStudentSelect.value;

  elements.clearQuestionSelect.innerHTML = records.length
    ? records
        .map(
          (record) =>
            `<option value="${escapeHTML(record.response.id)}">${escapeHTML(formatQuestionOption(record))}</option>`
        )
        .join("")
    : '<option value="">No questions logged</option>';
  elements.clearQuestionButton.disabled = records.length === 0;
  if (records.some(({ response }) => response.id === previousQuestion)) {
    elements.clearQuestionSelect.value = previousQuestion;
  }

  elements.clearStudentSelect.innerHTML = students.length
    ? students
        .map((student) => `<option value="${escapeHTML(student)}">${escapeHTML(student)}</option>`)
        .join("")
    : '<option value="">No students logged</option>';
  elements.clearStudentButton.disabled = students.length === 0;
  if (students.some((student) => canonical(student) === canonical(previousStudent))) {
    elements.clearStudentSelect.value = previousStudent;
  }

  elements.clearAllDataButton.disabled = records.length === 0;
}

function formatQuestionOption({ session, response }) {
  const date = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(response.timestamp));
  const student = response.student || "Nobody tried";
  const round = response.round ? `Round ${response.round}` : "Round ?";
  return `${date} - ${student} - ${session.name} - ${response.setName} - ${round} - Q${response.number} - ${response.result}`;
}

function renderComparison() {
  const metric = state.filters.comparisonMetric || "accuracy";
  elements.comparisonMetric.value = metric;
  const students = groupStudentStats(
    getComparisonRecords().map(({ response }) => response)
  ).map((student) => {
    const rounds = student.responses
      .map((response) => response.round)
      .filter((round) => Number.isFinite(round));
    const averageRound = rounds.length
      ? rounds.reduce((sum, round) => sum + round, 0) / rounds.length
      : 0;
    const values = {
      accuracy: student.counts.accuracy ?? 0,
      attempts: student.counts.attempted,
      correct: student.counts.Correct,
      averageRound,
    };
    return { ...student, averageRound, comparisonValue: values[metric] };
  });

  students.sort(
    (a, b) => b.comparisonValue - a.comparisonValue || a.name.localeCompare(b.name)
  );

  if (!students.length) {
    elements.comparisonChart.innerHTML =
      '<div class="comparison-empty">Log student responses to compare them here.</div>';
    elements.comparisonNote.textContent =
      "The comparison follows the selected question set and subject filters.";
    return;
  }

  const metricLabels = {
    accuracy: "Accuracy",
    attempts: "Attempts",
    correct: "Correct",
    averageRound: "Average round",
  };
  const maxValue =
    metric === "accuracy"
      ? 100
      : Math.max(...students.map((student) => student.comparisonValue), 1);

  elements.comparisonChart.innerHTML = students
    .map((student, index) => {
      const width = Math.max(0, (student.comparisonValue / maxValue) * 100);
      const formattedValue =
        metric === "accuracy"
          ? `${student.comparisonValue}%`
          : metric === "averageRound"
            ? student.comparisonValue.toFixed(1).replace(".0", "")
            : student.comparisonValue;
      return `
        <button class="comparison-row" data-compare-student="${escapeHTML(student.name)}" type="button" aria-label="View ${escapeHTML(student.name)} data">
          <span class="comparison-rank">${index + 1}</span>
          <span class="comparison-student">
            <strong>${escapeHTML(student.name)}</strong>
            <small>${student.counts.Correct} correct · ${student.counts.Incorrect} incorrect · ${student.counts.Error} errors</small>
          </span>
          <span class="comparison-track"><span class="comparison-bar" style="width: ${width}%"></span></span>
          <span class="comparison-value">${formattedValue}</span>
        </button>
      `;
    })
    .join("");

  elements.comparisonNote.textContent =
    `${metricLabels[metric]} comparison · Click a student to open their individual data.`;
}

function renderStudentSummary(studentStats) {
  elements.studentSummaryEmpty.hidden = studentStats.length > 0;
  elements.studentSummaryBody.innerHTML = studentStats
    .map((student) => {
      const rounds = student.responses
        .map((response) => response.round)
        .filter((round) => Number.isFinite(round));
      const averageRound = rounds.length
        ? rounds.reduce((sum, round) => sum + round, 0) / rounds.length
        : null;
      return `
        <tr data-student-name="${escapeHTML(student.name)}" title="View only ${escapeHTML(student.name)}">
          <td>${escapeHTML(student.name)}</td>
          <td>${student.counts.attempted}</td>
          <td>${student.counts.Correct}</td>
          <td>${student.counts.Incorrect}</td>
          <td>${student.counts.Error}</td>
          <td class="accuracy-cell">${student.counts.accuracy === null ? "—" : `${student.counts.accuracy}%`}</td>
          <td>${averageRound === null ? "—" : averageRound.toFixed(1).replace(".0", "")}</td>
        </tr>
      `;
    })
    .join("");
}

function renderQuestionLedger(records) {
  elements.ledgerEmpty.hidden = records.length > 0;
  elements.questionLedgerBody.innerHTML = [...records]
    .sort(
      (a, b) =>
        new Date(b.response.timestamp).getTime() - new Date(a.response.timestamp).getTime()
    )
    .map(({ session, response }) => {
      const date = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(response.timestamp));
      const resultClass = response.result.toLowerCase().replaceAll(" ", "-");
      return `
        <tr>
          <td>${date}</td>
          <td class="student-cell">
            ${
              response.student
                ? `<input class="table-student-input" data-edit-student-id="${response.id}" value="${escapeHTML(response.student)}" aria-label="Student for ${escapeHTML(session.name)} question ${response.number}" />`
                : "—"
            }
          </td>
          <td>${escapeHTML(session.name)}</td>
          <td>${escapeHTML(response.setName)}</td>
          <td>${response.round || "—"}</td>
          <td>${difficultyForRound(response.round)}</td>
          <td>${escapeHTML(response.subject)}</td>
          <td>${escapeHTML(response.type)}</td>
          <td><span class="result-badge result-${resultClass}">${escapeHTML(response.result)}</span></td>
          <td>${escapeHTML(response.errorReason || "—")}</td>
          <td class="note-cell" title="${escapeHTML(response.note || "No note")}">${escapeHTML(response.note || "—")}</td>
        </tr>
      `;
    })
    .join("");
}

function openModal(action, payload = {}) {
  pendingAction = { action, ...payload };
  elements.confirmModal.classList.toggle("danger-modal", action !== "end");
  if (action === "end") {
    elements.modalIcon.textContent = "✓";
    elements.modalTitle.textContent = "End and save this session?";
    elements.modalCopy.textContent =
      "The responses will remain available in the student workbook, and a fresh session will be prepared.";
    elements.confirmModalButton.textContent = "End & save";
  } else if (action === "clear") {
    elements.modalIcon.textContent = "×";
    elements.modalTitle.textContent = "Clear the current session?";
    elements.modalCopy.textContent =
      "Every response in this in-progress session will be removed. Saved sessions will not be affected.";
    elements.confirmModalButton.textContent = "Clear session";
  } else if (action === "clear-question") {
    elements.modalIcon.textContent = "×";
    elements.modalTitle.textContent = "Clear this question?";
    elements.modalCopy.textContent =
      `${payload.label || "This question"} will be removed from the workbook and all stats. This cannot be undone.`;
    elements.confirmModalButton.textContent = "Clear question";
  } else if (action === "clear-student") {
    elements.modalIcon.textContent = "×";
    elements.modalTitle.textContent = `Clear ${payload.student}'s data?`;
    elements.modalCopy.textContent =
      `Every response attributed to ${payload.student} will be removed from the workbook. Other students' rows will stay. This cannot be undone.`;
    elements.confirmModalButton.textContent = "Clear student";
  } else if (action === "clear-all") {
    elements.modalIcon.textContent = "×";
    elements.modalTitle.textContent = "Clear the entire spreadsheet?";
    elements.modalCopy.textContent =
      "All sessions, students, and question rows saved in this browser will be deleted. This cannot be undone.";
    elements.confirmModalButton.textContent = "Clear everything";
  }
  elements.confirmModal.hidden = false;
  elements.confirmModalButton.focus();
}

function closeModal() {
  elements.confirmModal.hidden = true;
  elements.confirmModal.classList.remove("danger-modal");
  pendingAction = null;
}

function confirmModalAction() {
  if (!pendingAction) return;
  const action = pendingAction.action;

  if (action === "end") {
    state.currentSession.name =
      elements.sessionName.value.trim() || `Practice Session ${state.sessions.length + 1}`;
    state.currentSession.completedAt = new Date().toISOString();
    state.sessions.push({
      ...state.currentSession,
      responses: state.currentSession.responses.map((response) => ({ ...response })),
    });
    state.currentSession = createSession(state.sessions.length + 1);
    elements.sessionName.value = state.currentSession.name;
    saveState();
    renderAll();
    closeModal();
    setView("home");
    showToast("✓", "Session saved to the workbook");
    return;
  }

  if (action === "clear") {
    state.currentSession.responses = [];
    saveState();
    renderAll();
    closeModal();
    showToast("×", "Current session cleared");
    return;
  }

  if (action === "clear-question") {
    const removed = clearQuestionById(pendingAction.responseId);
    closeModal();
    showToast(removed ? "×" : "!", removed ? "Question cleared" : "Question was already cleared");
    return;
  }

  if (action === "clear-student") {
    const student = pendingAction.student;
    const removed = clearStudentData(student);
    closeModal();
    showToast(
      removed ? "×" : "!",
      removed
        ? `${removed} ${removed === 1 ? "row" : "rows"} cleared for ${student}`
        : `No rows found for ${student}`
    );
    return;
  }

  if (action === "clear-all") {
    clearAllWorkbookData();
    closeModal();
    showToast("×", "Entire spreadsheet cleared");
  }
}

function exportSpreadsheet() {
  const records = getFilteredRecords();
  if (!records.length) {
    showToast("!", "There is no data to export");
    return;
  }

  const rows = [
    [
      "Date",
      "Student",
      "Session",
      "Question Set",
      "Round",
      "Difficulty",
      "Subject",
      "Question Type",
      "Response",
      "Error Reason",
      "Question Note",
      "Time",
    ],
    ...records.map(({ session, response }) => [
      new Date(response.timestamp).toLocaleDateString(),
      response.student || "",
      session.name,
      response.setName,
      response.round || "",
      difficultyForRound(response.round),
      response.subject,
      response.type,
      response.result,
      response.errorReason,
      response.note,
      new Date(response.timestamp).toLocaleTimeString(),
    ]),
  ];

  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  const studentLabel =
    state.filters.student === ALL
      ? "all-students"
      : state.filters.student.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  link.href = url;
  link.download = `science-bowl-${studentLabel}-${date}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("↓", "Spreadsheet exported");
}

function showToast(icon, message) {
  clearTimeout(toastTimer);
  elements.toastIcon.textContent = icon;
  elements.toastMessage.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2400);
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

init();
