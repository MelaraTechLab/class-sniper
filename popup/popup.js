let state = {
    isActive: false,
    courses: [],
    refreshInterval: 10,
    logs: [],
};

const icons = {
    trash: `
        <svg class="icon" viewBox="0 0 24 24" role="presentation">
            <path d="M6 7h12m-9 3v6m6-6v6M9 7V5.6a1.6 1.6 0 0 1 1.6-1.6h2.8A1.6 1.6 0 0 1 15 5.6V7m3 0v11.2A1.8 1.8 0 0 1 16.2 20H7.8A1.8 1.8 0 0 1 6 18.2V7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        </svg>
    `,
};

const elements = {
    toggleBtn: document.getElementById("toggleBtn"),
    toggleBtnLabel: document.querySelector("#toggleBtn .btn-label"),
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

    elements.toggleBtn.dataset.state = state.isActive ? "running" : "idle";
    if (elements.toggleBtnLabel) {
        elements.toggleBtnLabel.textContent = state.isActive ? "Detener" : "Iniciar";
    } else {
        elements.toggleBtn.textContent = state.isActive ? "Detener" : "Iniciar";
    }
    elements.toggleBtn.classList.toggle("active", state.isActive);

    elements.refreshInterval.value = state.refreshInterval;

    renderCourses();
    renderLogs();
}

function renderCourses() {
    if (state.courses.length === 0) {
        elements.coursesList.innerHTML = `
            <div class="empty-state">
                No hay cursos configurados todavía. Usa el botón para agregar uno nuevo.
            </div>
        `;
        return;
    }

    elements.coursesList.innerHTML = state.courses
        .map(
            (course, index) => `
                <article class="course-item">
                    <div class="course-chip">${course.code}</div>
                    <div class="course-info">
                        <p class="course-label">Secciones</p>
                        <p class="course-sections">${course.sections.join(", ")}</p>
                    </div>
                    <button class="icon-button delete-btn" data-index="${index}" aria-label="Eliminar ${course.code}">
                        ${icons.trash}
                    </button>
                </article>
            `
        )
        .join("");

    document.querySelectorAll(".delete-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            const index = parseInt(e.currentTarget.dataset.index, 10);
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
        elements.activityLog.innerHTML = `
            <div class="empty-state">
                Sin actividad reciente. Aquí aparecerán los eventos del bot.
            </div>
        `;
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
