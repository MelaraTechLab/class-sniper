chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "notify") {
        chrome.notifications.create({
            type: "basic",
            iconUrl: "icons/icon128.png",
            title: message.title,
            message: message.message,
            priority: 2,
            requireInteraction: true,
        });

        setTimeout(() => {
            chrome.notifications.create({
                type: "basic",
                iconUrl: "icons/icon128.png",
                title: message.title,
                message: message.message + "\n\n¡Revisa tu asignación!",
                priority: 2,
                requireInteraction: true,
            });
        }, 3000);
    }
});

chrome.runtime.onInstalled.addListener(() => {
    console.log("Class Sniper instalado");
});
