function trans(messageName, placeholders = {}) {
    const message = messenger.i18n.getMessage(messageName, Object.values(placeholders));

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
        const messageParagraph = document.createElement('p');
        messageParagraph.textContent = message;  // Use textContent for safety
        popupContent.appendChild(messageParagraph);
        
        // Optional: Close popup after 5 seconds
        setTimeout(() => {
            window.close();
        }, 5000);
    } 
    // If no message is passed, display the settings link and help link
    else {
        const header = document.createElement('h1');
        header.textContent = 'PrioMailbox';
        popupContent.appendChild(header);

        const settingsButton = document.createElement('button');
        settingsButton.textContent = trans('popup_settingsButton');
        settingsButton.id = 'settings-button';
        settingsButton.style.marginRight = '10px'; // Add margin to the right
        popupContent.appendChild(settingsButton);

        const helpButton = document.createElement('button');
        helpButton.textContent = trans('popup_helpButton');
        helpButton.id = 'help-button';
        popupContent.appendChild(helpButton);

        // Event listener for the button to open the settings page
        settingsButton.addEventListener('click', () => {
            messenger.runtime.openOptionsPage(); // Opens the settings
        });

        // Event listener for the button to open the help page
        helpButton.addEventListener('click', () => {
            // Help URL is static, independent of the locale
            const helpUrl = messenger.runtime.getURL(`help/help.html`);
            messenger.tabs.create({ url: helpUrl });
        });
    }
});