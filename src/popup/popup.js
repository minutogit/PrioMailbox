function trans(messageName, placeholders = {}) {
    const message = browser.i18n.getMessage(messageName, Object.values(placeholders));

    if (!message) {
        console.warn(`No translation found for key "${messageName}".`);
        return messageName; // Fallback to the key if no translation is found
    }

    return message;
}

document.addEventListener('DOMContentLoaded', () => {
    const popupContent = document.querySelector('.popup-page');

    // Display message
    const params = new URLSearchParams(window.location.search);
    const message = params.get('message');

    // If a message is passed, display it
    if (message) {
        popupContent.innerHTML = `<p>${message}</p>`;
        
        // Optional: Close popup after 5 seconds
        setTimeout(() => {
            window.close();
        }, 5000);
    } 
    // If no message is passed, display the settings link and help link
    else {
        popupContent.innerHTML = `
            <h1>PrioMailbox</h1>
            <button id="settings-button">${trans('popup_settingsButton')}</button>
            <button id="help-button">${trans('popup_helpButton')}</button>
        `;

        const settingsButton = document.getElementById('settings-button');
        const helpButton = document.getElementById('help-button');

        // Event listener for the button to open the settings page
        settingsButton.addEventListener('click', () => {
            browser.runtime.openOptionsPage(); // Opens the settings
        });

        // Event listener for the button to open the help page
        helpButton.addEventListener('click', () => {
            // Help URL is static, independent of the locale
            const helpUrl = browser.runtime.getURL(`help/help.html`);
            browser.tabs.create({ url: helpUrl });
        });
    }
});
