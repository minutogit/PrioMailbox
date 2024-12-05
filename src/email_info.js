function trans(messageName, placeholders = {}) {
  const message = messenger.i18n.getMessage(messageName, Object.values(placeholders));

  if (!message) {
    console.warn(`No translation found for key "${messageName}".`);
    return messageName; // Fallback auf den Schlüssel, wenn keine Übersetzung gefunden wurde
  }

  return message;
}

function getWaitTimeInSeconds(donationData) {
  const { usage_counter, donation_key } = donationData;
  if (usage_counter <= 30 || donation_key) {
    return 0;
  }
  return Math.min(usage_counter - 30, 15);
}

document.addEventListener("DOMContentLoaded", async () => {
  // Spenden-Daten abrufen
  const { donation_handler } = await messenger.storage.local.get('donation_handler');
  const donationData = donation_handler || { usage_counter: 0, donation_key: '' };
  const waitTime = getWaitTimeInSeconds(donationData);

    // Spenden-Nachricht und Button setzen
    const donationMessageDiv = document.getElementById('donation-message');
    const donationText = document.getElementById('donation-text');
    const waitButton = document.getElementById('wait-button');
  
    donationText.innerHTML = trans("emailinfo_donation_message");
    waitButton.textContent = trans("emailinfo_donation_button_ok");
  
    // Event Listener für den Spenden-Link hinzufügen
    const donationLink = document.getElementById('donation-link');
    donationLink.addEventListener('click', (event) => {
      event.preventDefault();
      messenger.runtime.openOptionsPage(); // Öffnet die Einstellungen
    });

  if (waitTime === 0) {
    // Informationen sofort anzeigen
    displayEmailInfo();
  } else {
    // Spenden-Nachricht und Countdown anzeigen
    const donationMessageDiv = document.getElementById('donation-message');
    const waitButton = document.getElementById('wait-button');
    donationMessageDiv.style.display = 'block';

    // Fenstergröße auf feste Werte setzen
    messenger.windows.getCurrent().then((windowInfo) => {
      messenger.windows.update(windowInfo.id, {
        width: 700,
        height: 300
      });
    }).catch((error) => {
      console.error("Error adjusting window size:", error);
    });

    let remainingSeconds = waitTime;
    waitButton.textContent = `OK (${remainingSeconds})`;
    waitButton.disabled = true;

    const countdownInterval = setInterval(() => {
      remainingSeconds--;
      if (remainingSeconds > 0) {
        waitButton.textContent = `OK (${remainingSeconds})`;
      } else {
        clearInterval(countdownInterval);
        waitButton.textContent = 'OK';
        waitButton.disabled = false;
      }
    }, 1000);

    waitButton.addEventListener('click', () => {
      donationMessageDiv.style.display = 'none';
      displayEmailInfo();
    });
  }
});

function displayEmailInfo() {
  const tableBody = document.getElementById("probabilities-table");
  const tokenTablesContainer = document.getElementById("token-tables-container");
  const toggleButton = document.getElementById("toggle-tokens-button");
  tokenTablesContainer.style.display = 'none'; // Token-Tabellen anfangs ausblenden
  let tagKeyToNameMap = {};
  let tagNameToKeyMap = {};

  // Setze HTML-Übersetzungen mit der trans-Funktion
  document.getElementById('email-info-title').textContent = trans("emailinfo_title");
  document.getElementById('emailinfo_label_tag').textContent = trans("emailinfo_label_tag");
  document.getElementById('emailinfo_label_probability').textContent = trans("emailinfo_label_probability");
  document.getElementById('emailinfo_label_known_tokens').textContent = trans("emailinfo_label_known_tokens");

  Promise.all([
    messenger.storage.local.get(["bayesInfoData", "bayesData"]),
    messenger.messages.listTags()
  ]).then(([result, tags]) => {
    const probabilities = result.bayesInfoData || [];
    const bayesData = result.bayesData || {};

    // Mapping von Tag-Key zu Tag-Name und umgekehrt erstellen
    tags.forEach((tag) => {
      tagKeyToNameMap[tag.key] = tag.tag;
      tagNameToKeyMap[tag.tag] = tag.key;
    });

    probabilities.forEach((item) => {
      const row = document.createElement("tr");

      const tagCell = document.createElement("td");
      tagCell.textContent = item.tag;
      row.appendChild(tagCell);

      const probCell = document.createElement("td");

      if (!bayesData[item.tag]) {
        probCell.textContent = "50%";
      } else if (!bayesData[item.tag].trainingCount) {
        probCell.textContent = "50%";
      } else {
        probCell.textContent = item.probability + "%";
      }

      row.appendChild(probCell);

      // Hinzufügen der Zelle für bekannte Tokens
      const knownTokensCell = document.createElement("td");
      if (item.knownTokenPercentage !== undefined) {
        knownTokensCell.textContent = item.knownTokenPercentage + "%";
      } else {
        knownTokensCell.textContent = "0.00%"; // Fallback, falls nicht definiert
      }
      row.appendChild(knownTokensCell);

      tableBody.appendChild(row);

      // Verarbeitung der TokenContributions, um Top 5 positive und negative Tokens zu finden
      const tokenContributions = item.tokenContributions || [];

      // Filtere die Tokens, die in der E-Mail vorhanden sind
      const tokensInEmail = tokenContributions.filter(tc => tc.isPresent);

      // Top 5 positive Tokens (höchste positive Beiträge)
      const topPositiveTokens = tokensInEmail
        .filter(tc => tc.contribution > 0)
        .sort((a, b) => b.contribution - a.contribution)
        .slice(0, 5);

      // Top 5 negative Tokens (niedrigste negative Beiträge)
      const topNegativeTokens = tokensInEmail
        .filter(tc => tc.contribution < 0)
        .sort((a, b) => a.contribution - b.contribution)
        .slice(0, 5);

      // Erstelle eine Tabelle für das aktuelle Schlagwort
      const tokenTable = document.createElement("table");
      tokenTable.style.marginTop = "15px";
      tokenTable.style.width = "100%";

      const tokenTableHeader = document.createElement("thead");
      const tokenTableHeaderRow = document.createElement("tr");
      const tokenTableHeaderCell = document.createElement("th");
      tokenTableHeaderCell.colSpan = 3;
      tokenTableHeaderCell.style.textAlign = "left";
      tokenTableHeaderCell.textContent = trans("emailinfo_top_tokens", { "1": item.tag });
      tokenTableHeaderRow.appendChild(tokenTableHeaderCell);
      tokenTableHeader.appendChild(tokenTableHeaderRow);
      tokenTable.appendChild(tokenTableHeader);

      const tokenTableSubHeader = document.createElement("tr");
      const tokenSubHeaderToken = document.createElement("th");
      tokenSubHeaderToken.textContent = trans("emailinfo_token");
      const tokenSubHeaderContribution = document.createElement("th");
      tokenSubHeaderContribution.textContent = trans("emailinfo_probability");
      const tokenSubHeaderType = document.createElement("th");
      tokenSubHeaderType.textContent = trans("emailinfo_type");
      tokenTableSubHeader.appendChild(tokenSubHeaderToken);
      tokenSubHeaderContribution.style.width = '20%';
      tokenSubHeaderType.style.width = '20%';
      tokenTableSubHeader.appendChild(tokenSubHeaderContribution);
      tokenTableSubHeader.appendChild(tokenSubHeaderType);
      tokenTable.appendChild(tokenTableSubHeader);

      const tokenTableBody = document.createElement("tbody");

      // Füge die positiven Tokens hinzu
      topPositiveTokens.forEach(tc => {
        const tr = document.createElement("tr");
        const tdToken = document.createElement("td");
        tdToken.textContent = tc.token;
        tdToken.classList.add("positive-token");

        const tdContribution = document.createElement("td");
        tdContribution.textContent = (tc.tokenProbability * 100).toFixed(2) + "%";

        const tdType = document.createElement("td");
        tdType.textContent = trans("emailinfo_positive");
        tr.appendChild(tdToken);
        tr.appendChild(tdContribution);
        tr.appendChild(tdType);
        tokenTableBody.appendChild(tr);
      });

      // Füge die negativen Tokens hinzu
      topNegativeTokens.forEach(tc => {
        const tr = document.createElement("tr");
        const tdToken = document.createElement("td");
        tdToken.textContent = tc.token;
        tdToken.classList.add("negative-token");

        const tdContribution = document.createElement("td");
        tdContribution.textContent = (tc.tokenProbability * 100).toFixed(2) + "%";

        const tdType = document.createElement("td");
        tdType.textContent = trans("emailinfo_negative");
        tr.appendChild(tdToken);
        tr.appendChild(tdContribution);
        tr.appendChild(tdType);
        tokenTableBody.appendChild(tr);
      });

      tokenTable.appendChild(tokenTableBody);
      tokenTablesContainer.appendChild(tokenTable);
    });

    // Entferne bayesInfoData nach der Anzeige
    messenger.storage.local.remove(["bayesInfoData"]);

    // Fenstergröße nach dem Laden des Inhalts anpassen
    adjustWindowSize();
  }).catch((error) => {
    console.error("Error loading Bayes info data:", error);
  });

  // Event Listener für den Toggle-Button hinzufügen
  if (toggleButton) {
    toggleButton.addEventListener('click', () => {
      if (tokenTablesContainer.style.display === 'none' || tokenTablesContainer.style.display === '') {
        tokenTablesContainer.style.display = 'block';
        toggleButton.innerHTML = '&#9650;'; // Pfeil nach oben
      } else {
        tokenTablesContainer.style.display = 'none';
        toggleButton.innerHTML = '&#9660;'; // Pfeil nach unten
      }

      adjustWindowSize();
    });
  }
}

function adjustWindowSize() {
  // Warten, bis der Inhalt gerendert wurde
  setTimeout(() => {
    const body = document.body;
    const html = document.documentElement;

    const height = Math.max(
      body.scrollHeight, body.offsetHeight,
      html.clientHeight, html.scrollHeight, html.offsetHeight
    );

    const width = Math.max(
      body.scrollWidth, body.offsetWidth,
      html.clientWidth, html.scrollWidth, html.offsetWidth
    );

    messenger.windows.getCurrent().then((windowInfo) => {
      messenger.windows.update(windowInfo.id, {
        width: Math.min(width + 5, 800),
        height: Math.min(height + 50, 600)
      });
    }).catch((error) => {
      console.error("Error adjusting window size:", error);
    });
  }, 600);
}
