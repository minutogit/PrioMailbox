// tokenutils.js

// Stopwords Set für die Filterung
let stopwordsSet = new Set(); 

// Funktion zum Laden der Stopwords aus der Datei stopwords.txt
function loadStopwords() {
  return fetch('stopwords.txt')
    .then(response => {
      if (!response.ok) {
        throw new Error(`Error fetching file: ${response.statusText}`);
      }
      return response.text();
    })
    .then(data => {
      console.log("Stopwords file loaded successfully.");
      const lines = data.split('\n').map(line => line.split('#')[0].trim());
      const stopwordsArray = lines.join('').split(',').map(word => word.trim());
      stopwordsArray.forEach(word => {
        if (word) {
          stopwordsSet.add(word);
        }
      });
      console.log("Loaded stopwords:", Array.from(stopwordsSet));
    })
    .catch(error => {
      console.error("Error loading stopwords:", error);
    });
}

// Lade die Stopwords beim Start
loadStopwords();


/**
 * Extrahiert und begrenzt die Empfänger aus einem Header.
 * Unterstützt sowohl Arrays als auch Strings mit mehreren E-Mail-Adressen.
 * @param {Array|string} header - Der Header, aus dem die Empfänger extrahiert werden sollen.
 * @param {number} maxCount - Die maximale Anzahl der zu extrahierenden Empfänger.
 * @returns {string} - Eine kommagetrennte Liste der extrahierten Empfänger.
 */
function extractAndLimitRecipients(header, maxCount) {
  let recipients = [];

  // Hilfsfunktion zum Verarbeiten eines Header-Eintrags
  function processHeaderEntry(entry) {
    if (typeof entry === 'string') {
      // Splitte den Eintrag auf Kommas, um einzelne E-Mail-Adressen zu erhalten
      let emails = entry.split(',').map(email => email.trim());
      recipients.push(...emails);
    } else if (Array.isArray(entry)) {
      // Falls der Eintrag ein Array ist, verarbeite jedes Element rekursiv
      entry.forEach(processHeaderEntry);
    }
  }

  // Verarbeite den Header
  if (Array.isArray(header)) {
    header.forEach(processHeaderEntry);
  } else if (typeof header === 'string') {
    processHeaderEntry(header);
  }

  // Bereinige die E-Mail-Adressen
  recipients = recipients.map(email => cleanEmailAddress(email));

  // Begrenze die Anzahl der Empfänger auf maxCount
  recipients = recipients.slice(0, maxCount);

  // Verbinde die Empfänger zu einem kommagetrennten String
  return recipients.join(', ');
}



// Funktion zum Bereinigen von E-Mail-Adressen: Entfernt <>, ersetzt @ durch ein Leerzeichen
function cleanEmailAddress(email) {
  // Entferne < und >, ersetze @ durch ein Leerzeichen
  return email.replace(/[<>]/g, '').replace('@', ' ');
}

// Funktion zur Extraktion von Anhängen
async function extractAttachments(parts, headers) {
  let attachmentCount = 0; // Zähler für Anhänge
  const maxAttachments = 3; // Maximale Anzahl der zu extrahierenden Anhänge

  for (let part of parts) {
    if (part.parts) {
      // Rekursive Verarbeitung der E-Mail-Teile
      await extractAttachments(part.parts, headers);
    } else {
      const disposition = (part.contentDisposition || '').toLowerCase();
      const filename = part.fileName || part.filename || part.name || 'unknown';
      
      // Bedingung zur Erkennung von Anhängen
      if (
        disposition === 'attachment' ||
        (filename !== 'unknown' && !['text/plain', 'text/html'].includes(part.contentType))
      ) {
        // Begrenze die Anzahl der Anhänge auf maximal 3
        if (attachmentCount < maxAttachments) {
          // Speichere die Anhangsinformationen
          headers.attachments.push({
            filename: filename.toLowerCase()
          });
          attachmentCount++; // Inkrementiere den Zähler
        } else {
          break; // Beende die Schleife, wenn 3 Anhänge erreicht wurden
        }
      }
    }
  }
}

// Funktion zur Extraktion der Header-Informationen und Anhänge
async function getHeaders(message) {
  let headers = {};
  headers.attachments = []; // Initialisiere das Array für Anhänge

  // Extrahiere relevante Header-Felder und bereinige E-Mail-Adressen
  headers.subject = message.headers.subject ? message.headers.subject[0] : "";
  headers.from = message.headers.from ? cleanEmailAddress(message.headers.from[0]) : "";

  // Extrahiere maximal 2 Empfänger aus dem "to" Header
  headers.to = message.headers.to ? 
    extractAndLimitRecipients(message.headers.to, 2) : 
    "";

  // Extrahiere maximal 2 Empfänger aus dem "cc" Header
  headers.cc = message.headers.cc ? 
    extractAndLimitRecipients(message.headers.cc, 2) : 
    "";

  headers.bcc = message.headers.bcc ? cleanEmailAddress(message.headers.bcc[0]) : "";
  headers.replyTo = message.headers["reply-to"] ? cleanEmailAddress(message.headers["reply-to"][0]) : "";
  headers.date = message.headers.date ? message.headers.date[0] : "";
  headers.messageId = message.headers["message-id"] ? message.headers["message-id"][0] : "";
  headers.contentType = message.headers["content-type"] ? message.headers["content-type"][0] : "";

  // Starte die Extraktion der Anhänge
  if (message.parts) {
    await extractAttachments(message.parts, headers);
  }

  console.debug(`Extracted attachments: ${JSON.stringify(headers.attachments)}`);

  return headers;
}

// Funktion zum Abrufen des gesamten E-Mail-Inhalts einschließlich Anhänge
function getEmailContent(messageId) {
  return messenger.messages.getFull(messageId).then(async (message) => {
    let body = "";

    // Funktion zur rekursiven Extraktion der Nachrichtenteile
    async function extractParts(parts) {
      for (let part of parts) {
        if (part.parts) {
          // Rekursive Verarbeitung der E-Mail-Teile
          await extractParts(part.parts);
        } else if (part.contentType === "text/plain" || part.contentType === "text/html") {
          let partBody = await getBody(part, part.contentType);
          body += partBody;
        }
      }
    }

    // Starte die Extraktion der Nachrichtenteile und warte auf die Fertigstellung
    await extractParts([message]);

    // Extrahiere die Header-Informationen und Anhänge
    const headers = await getHeaders(message);

    // Erstelle einen Abschnitt für Anhänge
    let attachmentsContent = "";
    if (headers.attachments.length > 0) {
      headers.attachments.forEach((attachment, index) => {
        attachmentsContent += `${attachment.filename}\n`;
      });
    }

    // Konstruiere einen Text, der Header, Anhänge und Body enthält
    let fullContent = `
${headers.from}
${headers.to}
${headers.cc}
${headers.subject}
${attachmentsContent}
${body.trim()}
    `;

    // Gib den kombinierten Inhalt zurück
    return fullContent;
  });
}

async function getBody(part, contentType) {
  // Überprüfe, ob der part überhaupt einen Body hat
  if (!part.body || typeof part.body !== 'string') {
    console.warn("No valid body found for this part:", part);
    return '';  // Leeren String zurückgeben, wenn kein Body vorhanden ist
  }

  let result = part.body;

  if (contentType === "text/html") {
    // Entferne <style>...</style> Tags
    result = result.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

    // HTML-Tags entfernen
    result = result.replace(/<("[^"]*"|'[^']*'|[^'">])*>/g, " ");
    result = result.replace(/&nbsp;/g, "");
  }

  // Unerwünschte Zeichen entfernen
  result = result.replace(
    /([\u0000-\u002f])|([\u003a-\u0040])|([\u005b-\u0060])|([\u007b-\u00bf])|([\u02b9-\u0362])|([\u0374-\u0375])|([\u037A-\u037E])|([\u0384-\u0385])|\u0387/g,
    " "
  );

  return result;
}

function tokenize(text) {
  if (!text) return [];
  //console.log(`Raw Text: ${text}`);

  // HTML-kodierte Zeichen durch ihre entsprechenden Zeichen ersetzen
  const doc = new DOMParser().parseFromString(text, 'text/html');
  const decodedText = doc.body.innerText.trim(); // Präzisere Extraktion von sichtbarem Text

  // Tokenizer-RegEx für Wörter, Schriftzeichen, einzelne Buchstaben und Zahlen
  const regex = /[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*|\p{Script=Han}+/gu;

  // Extrahiere die Zeilen des Originaltexts
  const lines = decodedText.split(/\r?\n/);
  let allTokens = [];
  let allBigrams = [];

  for (const line of lines) {
    // Hole Tokens für jede Zeile damit unterschiedliche header bei bigrams nicht verknüpft werden
    let tokens = line.toLowerCase().match(regex) || [];

    // Erstelle Bigramme bevor die Token nach Länge gefiltert werden, um den Kontext zu bewahren
    const bigrams = getBigrams(tokens, 150);

    // Filtere die Zahlen nach der Bigrammerstellung heraus
    const filteredTokens = tokens.filter(token => !/^\d+$/.test(token));

    // Token-Vorverarbeitung: minimale und maximale Tokenlänge festlegen
    const minTokenLength = 3;  // Minimale Tokenlänge für lateinische Sprachen
    const maxTokenLength = 20; // Maximale Tokenlänge

    // Filtere Tokens basierend auf Länge und Stopwords
    const preprocessedTokens = filteredTokens.filter(token => {
      // Überprüfe, ob der Token aus lateinischen Buchstaben besteht
      const isLatin = /^[a-z]+$/i.test(token);
      return (
        (!isLatin || token.length >= minTokenLength) &&  // Für lateinische Tokens: Länge >= 3
        token.length <= maxTokenLength &&  // Maximal erlaubte Länge
        !stopwordsSet.has(token) // Überprüfung, ob der Token in den Stopwords ist
      );
    });

    // Sammle alle Tokens und Bigrams zeilenweise
    allTokens.push(...preprocessedTokens);
    allBigrams.push(...bigrams);
  }

  // Begrenze die Gesamtzahl der Tokens und Bigrams auf 150
  const totalTokens = allTokens.slice(0, 150);
  const totalBigrams = allBigrams.slice(0, 150);

  // Füge die Tokens und Bigrams zusammen
  let finalTokens = totalTokens.concat(totalBigrams);

  // Entferne Semikolons aus den finalen Tokens
  finalTokens = finalTokens.map(token => token.replace(/;/g, ''));

  // Ausgabe der Anzahl der finalen Tokens und Bigrams in der Konsole
  // console.log(`Final token: ${finalTokens}`);

  return finalTokens;
}

// Funktion zur Erstellung der Bigramme (begrenzt auf die ersten 100 Bigramme)
function getBigrams(tokens, maxbigrams) {
  const bigrams = [];

  // Erstelle Bigramme, indem jeweils zwei aufeinanderfolgende Tokens verbunden werden
  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.push(`${tokens[i]}_${tokens[i + 1]}`);
    if (bigrams.length >= maxbigrams) break; // Begrenze auf die ersten 100 Bigramme
  }

  return bigrams;
}
