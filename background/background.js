chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "notify") {
        chrome.notifications.create({
            type: "basic",
            iconUrl: "icons/icon128.png",
            title: message.title,
            message: message.message,
            priority: 2,
        });
    }
});

chrome.runtime.onInstalled.addListener(() => {
    console.log("Class Sniper instalado");
});
