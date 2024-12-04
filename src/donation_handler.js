// donation_handler.js

/**
 * Generiert eine Checksum aus last_check_date und usage_counter.
 * @param {string} lastCheckDate - Das Datum der letzten Prüfung im ISO-Format.
 * @param {number} usageCounter - Der Nutzungszähler.
 * @returns {string} - Die ersten 8 Zeichen des SHA-256-Hash.
 */
function generateChecksum(lastCheckDate, usageCounter) {
    const data = `${lastCheckDate}${usageCounter}`;
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    // SHA-256-Hash generieren
    return crypto.subtle.digest('SHA-256', dataBuffer).then(hashBuffer => {
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const fullHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return fullHash.substring(0, 8);
    }).catch(() => '00000000'); // Fallback bei Fehler
}

async function verifyDonationCode(cryptedemail, code) {
    // Berechne SHA-256 Hash der cryptedemail
    const encoder = new TextEncoder();
    const data = encoder.encode(cryptedemail);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const fullHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const computedCode = fullHash.substring(0, 16);

    // Vergleiche den berechneten Code mit dem eingegebenen Code
    return computedCode === code;
}

/**
 * Aktualisiert den Nutzungszähler und das letzte Prüfungsdatum sowie die Checksum.
 * Wenn die Checksum nicht mit der berechneten übereinstimmt, wird der usage_counter auf 30 gesetzt.
 */
async function updateUsageData() {
    console.debug(`updateUsageData`);
    const currentData = await messenger.storage.local.get(['donation_handler']);
    const donationHandler = currentData.donation_handler || {};

    const today = new Date().toISOString().split('T')[0]; // Heutiges Datum im Format YYYY-MM-DD
    const lastCheckDate = donationHandler.last_check_date ? donationHandler.last_check_date.split('T')[0] : '';

    // Berechne die erwartete Checksum basierend auf usage_counter und last_check_date
    const expectedChecksum = await generateChecksum(donationHandler.usage_counter, lastCheckDate);

    // Überprüfe, ob die gespeicherte Checksum mit der berechneten übereinstimmt
    if (donationHandler.checksum !== expectedChecksum) {

        // Hohen UsageCounter, da vermutlich manuell der Zähler geändert wurde.
        const resetUsageCounter = 7*6;
        const newChecksum = await generateChecksum(resetUsageCounter, lastCheckDate);

        // Aktualisiere die lokalen Daten mit dem neuen usage_counter und checksum
        await messenger.storage.local.set({
            donation_handler: {
                ...donationHandler,
                last_check_date: today,
                usage_counter: resetUsageCounter,
                checksum: newChecksum // Neue Checksum speichern
            }
        });

        return; // Abbrechen, da wir die Daten bereits korrigiert haben
    }

    // Wenn die Checksum korrekt ist, prüfe, ob ein neuer Tag begonnen hat
    if (today == lastCheckDate) {
        // Ein neuer Tag hat begonnen
        const newUsageCounter = (donationHandler.usage_counter || 0) + 1;
        const newLastCheckDate = today;

        // Generiere neue Checksum
        const newChecksum = await generateChecksum(newUsageCounter, newLastCheckDate);

        await messenger.storage.local.set({
            donation_handler: {
                ...donationHandler,
                usage_counter: newUsageCounter,
                last_check_date: newLastCheckDate,
                checksum: newChecksum
            }
        });
    }
}




/**
 * Überprüft, ob eine Spende für die gegebene E-Mail-Adresse existiert.
 * @param {string} email - Die E-Mail-Adresse des Benutzers.
 * @returns {Promise<boolean>} - Ein Promise, das `true` zurückgibt, wenn eine Spende gefunden wurde, sonst `false`.
 */
async function check_donation(email) {
    const url = 'https://priomailbox.innere-leichtigkeit.de/check_donation.php'; // URL zur PHP-Datei
    const normalizedEmail = email.trim().toLowerCase(); // E-Mail normalisieren (klein schreiben, Leerzeichen entfernen)

    // SHA-256 Hash generieren und die ersten 16 Zeichen extrahieren
    const encoder = new TextEncoder();
    const data = encoder.encode(normalizedEmail);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const fullHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const shortHash = fullHash.substring(0, 16); // Nur die ersten 16 Zeichen

    // Sende den Hash und die E-Mail an den Server
    try {
        const formData = new FormData();
        formData.append('hash', shortHash);
        formData.append('email', normalizedEmail);

        const response = await fetch(url, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            console.error(`Fehler beim Serveraufruf: ${response.statusText} (Status: ${response.status})`);
            return false;
        }

        const result = await response.json();
        console.log(`Serverantwort:`, result); // Protokolliere das vollständige Ergebnis

        if (result.success) {
            console.log(`Spende gefunden für E-Mail: ${normalizedEmail}`);
            return true; // Spende gefunden
        } else {
            console.log(`Keine Spende gefunden für E-Mail: ${normalizedEmail}`);
            return false; // Keine Spende gefunden
        }
    } catch (error) {
        console.error("Fehler bei der Überprüfung der Spende:", error);
        return false; // Fehler bei der Anfrage
    }
}

// Listener für Nachrichten
messenger.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "requestDonationCode") {
        const { email } = message;
        if (!email) {
            sendResponse({ success: false, message: "E-Mail-Adresse fehlt." });
            return;
        }

        // Rufe die Funktion check_donation auf
        check_donation(email)
            .then((hasDonated) => {
                if (hasDonated) {
                    // Wenn eine Spende gefunden wurde, sende die Anfrage zur PHP-Datei
                    // Dies könnte eine zusätzliche Aktion erfordern, z.B. das Senden einer E-Mail
                    // Abhängig von deiner Backend-Implementierung
                    sendResponse({ success: true, message: "Spenden-Code wurde per E-Mail gesendet." });
                } else {
                    sendResponse({ success: false, message: "Keine Spende gefunden." });
                }
            })
            .catch((error) => {
                console.error("Error checking donation:", error);
                sendResponse({ success: false, message: "Fehler bei der Spendenprüfung." });
            });
        return true; // Ermöglicht eine asynchrone Antwort
    }

    if (message.action === "verifyDonationCode") {
        const { cryptedemail, code } = message; // Destrukturiere zuerst die Nachricht
        console.log("message.action verifyDonationCode", message);

        if (!cryptedemail || !code) {
            sendResponse(false);
            console.debug("!cryptedemail || !code");
            return;
        }

        verifyDonationCode(cryptedemail, code)
            .then((isValid) => {
                sendResponse(isValid);
            })
            .catch((error) => {
                console.error("Error verifying donation code:", error);
                sendResponse(false);
            });
        return true; // Ermöglicht eine asynchrone Antwort
    }

    // Weitere Nachrichten können hier verarbeitet werden

    return false; // Keine Aktion für andere Nachrichten
});
