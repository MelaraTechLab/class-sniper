let state = {
    isActive: false,
    courses: [],
    refreshInterval: 10,
    logs: [],
};

const elements = {
    toggleBtn: document.getElementById("toggleBtn"),
    statusIndicator: document.getElementById("statusIndicator"),
    statusText: document.getElementById("statusText"),
    coursesList: document.getElementById("coursesList"),
    addCourseBtn: document.getElementById("addCourseBtn"),
    addCourseModal: document.getElementById("addCourseModal"),
    courseCode: document.getElementById("courseCode"),
    courseSections: document.getElementById("courseSections"),
    saveCourseBtn: document.getElementById("saveCourseBtn"),
    cancelCourseBtn: document.getElementById("cancelCourseBtn"),
    refreshInterval: document.getElementById("refreshInterval"),
    activityLog: document.getElementById("activityLog"),
};

async function init() {
    await loadState();
    updateUI();
    setupEventListeners();
}

async function loadState() {
    const data = await chrome.storage.local.get(["isActive", "courses", "refreshInterval", "logs"]);
    state.isActive = data.isActive || false;
    state.courses = data.courses || [];
    state.refreshInterval = data.refreshInterval || 10;
    state.logs = data.logs || [];
}

async function saveState() {
    await chrome.storage.local.set(state);
}

function setupEventListeners() {
    elements.toggleBtn.addEventListener("click", toggleBot);
    elements.addCourseBtn.addEventListener("click", showAddCourseModal);
    elements.saveCourseBtn.addEventListener("click", saveCourse);
    elements.cancelCourseBtn.addEventListener("click", hideAddCourseModal);
    elements.refreshInterval.addEventListener("change", updateRefreshInterval);
}

async function toggleBot() {
    state.isActive = !state.isActive;
    await saveState();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, {
        action: state.isActive ? "start" : "stop",
        config: {
            courses: state.courses,
            refreshInterval: state.refreshInterval * 1000,
        },
    });

    updateUI();
    addLog(state.isActive ? "Bot iniciado" : "Bot detenido");
}

function updateUI() {
    elements.statusIndicator.classList.toggle("active", state.isActive);
    elements.statusText.textContent = state.isActive ? "Activo" : "Inactivo";

    elements.toggleBtn.textContent = state.isActive ? "⏸️ Detener" : "▶️ Iniciar";
    elements.toggleBtn.classList.toggle("active", state.isActive);

    elements.refreshInterval.value = state.refreshInterval;

    renderCourses();
    renderLogs();
}

function renderCourses() {
    if (state.courses.length === 0) {
        elements.coursesList.innerHTML = '<div class="empty-state">No hay cursos configurados</div>';
        return;
    }

    elements.coursesList.innerHTML = state.courses
        .map(
            (course, index) => `
    <div class="course-item">
      <div class="course-info">
        <div class="course-code">${course.code}</div>
        <div class="course-sections">Secciones: ${course.sections.join(", ")}</div>
      </div>
      <button class="delete-btn" data-index="${index}">🗑️</button>
    </div>
  `
        )
        .join("");

    document.querySelectorAll(".delete-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            const index = parseInt(e.target.dataset.index);
            deleteCourse(index);
        });
    });
}

function showAddCourseModal() {
    elements.addCourseModal.style.display = "flex";
    elements.courseCode.value = "";
    elements.courseSections.value = "";
    elements.courseCode.focus();
}

function hideAddCourseModal() {
    elements.addCourseModal.style.display = "none";
}

async function saveCourse() {
    const code = elements.courseCode.value.trim().toUpperCase();
    const sectionsText = elements.courseSections.value.trim();

    if (!code || !sectionsText) {
        alert("Por favor completa todos los campos");
        return;
    }

    const sections = sectionsText
        .split(",")
        .map((s) => parseInt(s.trim()))
        .filter((s) => !isNaN(s));

    if (sections.length === 0) {
        alert("Por favor ingresa al menos una sección válida");
        return;
    }

    const exists = state.courses.some((c) => c.code === code);
    if (exists) {
        alert("Este curso ya está en la lista");
        return;
    }

    state.courses.push({ code, sections });
    await saveState();

    hideAddCourseModal();
    updateUI();
    addLog(`Curso agregado: ${code} (Secciones: ${sections.join(", ")})`);
}

async function deleteCourse(index) {
    const course = state.courses[index];
    if (confirm(`¿Eliminar ${course.code}?`)) {
        state.courses.splice(index, 1);
        await saveState();
        updateUI();
        addLog(`Curso eliminado: ${course.code}`);
    }
}

async function updateRefreshInterval() {
    state.refreshInterval = parseInt(elements.refreshInterval.value);
    await saveState();
    addLog(`Intervalo actualizado: ${state.refreshInterval}s`);
}

async function addLog(message) {
    const timestamp = new Date().toLocaleTimeString();
    state.logs.unshift({ time: timestamp, message });

    if (state.logs.length > 50) {
        state.logs = state.logs.slice(0, 50);
    }

    await saveState();
    renderLogs();
}

function renderLogs() {
    if (state.logs.length === 0) {
        elements.activityLog.innerHTML = '<div class="empty-state">Sin actividad reciente</div>';
        return;
    }

    elements.activityLog.innerHTML = state.logs
        .map(
            (log) => `
    <div class="log-entry">
      <div class="log-time">${log.time}</div>
      <div>${log.message}</div>
    </div>
  `
        )
        .join("");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "log") {
        addLog(message.message);
    }
});

init();
