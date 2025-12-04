const DEBUG_MODE = true;

let botConfig = {
    isActive: false,
    courses: [],
    refreshInterval: 10000,
};

let refreshTimer = null;
let isProcessing = false;

async function init() {
    console.log("[Class Sniper] Content script cargado");

    const data = await chrome.storage.local.get(["isActive", "courses", "refreshInterval"]);
    if (data.isActive) {
        botConfig.isActive = data.isActive;
        botConfig.courses = data.courses || [];
        botConfig.refreshInterval = data.refreshInterval * 1000;
    }

    chrome.runtime.onMessage.addListener(handleMessage);

    if (isHomePage()) {
        if (botConfig.isActive) {
            clickAsignacionButton();
        }
    } else if (isRegistrationPage() && botConfig.isActive) {
        startBot();
    }
}

function isHomePage() {
    const buttons = document.querySelectorAll("button.btn-success.text-uppercase");
    for (const btn of buttons) {
        if (btn.textContent.includes("Asignación")) {
            return true;
        }
    }
    return false;
}

function isRegistrationPage() {
    return document.querySelector("accordion-group") !== null;
}

function clickAsignacionButton() {
    const buttons = document.querySelectorAll("button.btn-success.text-uppercase");
    for (const btn of buttons) {
        if (btn.textContent.includes("Asignación")) {
            log("Clickeando botón de Asignación..." + (DEBUG_MODE ? " (navegación permitida en DEBUG)" : ""));
            btn.click();
            return true;
        }
    }
    log("⚠️ No se encontró el botón de Asignación");
    return false;
}

async function processRegistration() {
    if (!isRegistrationPage()) {
        log("⚠️ No estamos en la página de registro");
        return;
    }

    if (isProcessing) {
        log("⏳ Ya hay un proceso en ejecución...");
        return;
    }

    isProcessing = true;
    log("🔍 Iniciando búsqueda de espacios disponibles...");

    try {
        for (const course of botConfig.courses) {
            const success = await processCourse(course);
            if (success) {
                log(`✅ ¡Asignado exitosamente a ${course.code}!`);
                stopBot();
                showSuccessNotification(course);
                break;
            }
        }
    } catch (error) {
        log(`❌ Error: ${error.message}`);
    } finally {
        isProcessing = false;
    }
}

async function processCourse(course) {
    log(`📚 Procesando curso: ${course.code}`);

    const acordeon = findAccordion(course.code);
    if (!acordeon) {
        log(`⚠️ No se encontró el curso ${course.code}`);
        return false;
    }

    await expandAccordion(acordeon);

    const tabla = acordeon.querySelector("table tbody");
    if (!tabla) {
        log(`⚠️ No se encontró la tabla de secciones para ${course.code}`);
        return false;
    }

    for (const seccionDeseada of course.sections) {
        const fila = findSection(tabla, seccionDeseada);
        if (!fila) {
            continue;
        }

        const disponibles = getAvailableSpaces(fila);
        log(`   Sección ${seccionDeseada}: ${disponibles} espacios`);

        if (disponibles > 0) {
            const asignado = await assignToSection(fila, course.code, seccionDeseada);
            if (asignado) {
                return true;
            }
        }
    }

    return false;
}

function findAccordion(courseCode) {
    const acordeones = document.querySelectorAll("accordion-group");
    for (const acordeon of acordeones) {
        const texto = acordeon.textContent;
        if (texto.includes(courseCode)) {
            return acordeon;
        }
    }
    return null;
}

async function expandAccordion(acordeon) {
    return new Promise((resolve) => {
        const toggle = acordeon.querySelector(".accordion-toggle");
        if (toggle) {
            const isExpanded = acordeon.querySelector("table") !== null;
            if (!isExpanded) {
                toggle.click();
                setTimeout(resolve, 1000);
            } else {
                resolve();
            }
        } else {
            resolve();
        }
    });
}

function findSection(tbody, sectionNumber) {
    const filas = tbody.querySelectorAll("tr");

    for (const fila of filas) {
        const celdas = fila.querySelectorAll("td");
        if (celdas.length === 0) continue;

        const seccionTexto = celdas[1]?.textContent.trim();

        let numeroSeccion = null;
        if (seccionTexto.includes("Sección:")) {
            numeroSeccion = parseInt(seccionTexto.split(":")[1]?.trim());
        } else if (seccionTexto.includes("Sección")) {
            numeroSeccion = parseInt(seccionTexto.replace(/\D/g, ""));
        } else {
            numeroSeccion = parseInt(seccionTexto);
        }

        if (numeroSeccion === sectionNumber) {
            return fila;
        }
    }

    return null;
}

function getAvailableSpaces(fila) {
    const celdas = fila.querySelectorAll("td");

    const disponiblesTexto = celdas[4]?.textContent.trim();
    if (disponiblesTexto) {
        const match = disponiblesTexto.match(/-?\d+/);
        if (match) {
            return parseInt(match[0]);
        }
    }

    return 0;
}

async function assignToSection(fila, courseCode, sectionNumber) {
    log(`🎯 Intentando asignar a ${courseCode} - Sección ${sectionNumber}...`);

    const botonAsignar = fila.querySelector("button.btn-success");

    if (!botonAsignar) {
        log(`⚠️ No se encontró el botón de asignar`);
        return false;
    }

    if (botonAsignar.disabled || botonAsignar.hasAttribute("disabled")) {
        log(`⚠️ El botón está deshabilitado`);
        return false;
    }

    if (DEBUG_MODE) {
        log(`🐛 DEBUG: Botón de asignar encontrado y habilitado (no se clickeó)`);
        log(`🐛 DEBUG: En modo normal, aquí se haría click y se confirmaría la asignación`);
        return true;
    }

    botonAsignar.click();

    await sleep(500);

    const modalAsignar = await waitForModal();
    if (!modalAsignar) {
        log(`⚠️ No apareció el modal de confirmación`);
        return false;
    }

    const botonConfirmar = modalAsignar.querySelector("button.btn-success");
    if (botonConfirmar) {
        log(`✓ Confirmando asignación...`);
        botonConfirmar.click();
        await sleep(1000);
        return true;
    }

    return false;
}

async function waitForModal() {
    return new Promise((resolve) => {
        let attempts = 0;
        const interval = setInterval(() => {
            const modals = document.querySelectorAll('.modal.fade.show, .modal.fade[style*="display: block"]');
            if (modals.length > 0) {
                clearInterval(interval);
                resolve(modals[modals.length - 1]);
            }

            attempts++;
            if (attempts > 20) {
                clearInterval(interval);
                resolve(null);
            }
        }, 100);
    });
}

function startBot() {
    if (botConfig.isActive && refreshTimer === null) {
        log("🚀 Bot iniciado" + (DEBUG_MODE ? " (MODO DEBUG - no clickeará botones de asignar)" : ""));

        processRegistration();

        refreshTimer = setInterval(() => {
            log("🔄 Refrescando página...");
            hasProcessedRegistration = false;
            window.location.reload();
        }, botConfig.refreshInterval);
    }
}

function stopBot() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
    botConfig.isActive = false;
    log("⏹️ Bot detenido");
}

function handleMessage(message, sender, sendResponse) {
    if (message.action === "start") {
        botConfig = {
            isActive: true,
            courses: message.config.courses,
            refreshInterval: message.config.refreshInterval,
        };

        if (isHomePage()) {
            clickAsignacionButton();
        } else if (isRegistrationPage()) {
            startBot();
        } else {
            log("⚠️ No estamos en una página válida (ni inicio ni registro)");
        }
    } else if (message.action === "stop") {
        stopBot();
    }
}

function log(message) {
    console.log(`[Class Sniper] ${message}`);

    chrome.runtime.sendMessage({
        action: "log",
        message: message,
    });
}

function showSuccessNotification(course) {
    chrome.runtime.sendMessage({
        action: "notify",
        title: "¡Asignación exitosa! 🎉",
        message: `Te has asignado a ${course.code}`,
    });

    alert(`✅ ¡Asignación exitosa!\n\nTe has asignado al curso ${course.code}`);
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

let hasProcessedRegistration = false;

const observer = new MutationObserver(() => {
    if (isRegistrationPage() && botConfig.isActive && !hasProcessedRegistration && !isProcessing) {
        log("🔍 Detectada página de registro mediante observer");
        hasProcessedRegistration = true;
        setTimeout(() => {
            startBot();
        }, 1000);
    }
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

init();
