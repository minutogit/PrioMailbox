// settings.js

function trans(messageName, placeholders = {}) {
  const message = browser.i18n.getMessage(messageName, Object.values(placeholders));

  if (!message) {
    console.warn(`No translation found for key "${messageName}".`);
    return messageName; // Fallback auf den Schlüssel, wenn keine Übersetzung gefunden wurde
  }

  return message;
}

document.addEventListener("DOMContentLoaded", () => {
  // Elemente aus dem DOM
  const tagsContainer = document.getElementById("tags-container");
  const thresholdInput = document.getElementById("threshold");
  const tagOnTrainingCheckbox = document.getElementById("tagOnTraining");
  const removeOnClassifyCheckbox = document.getElementById("removeOnClassify");
  const form = document.getElementById("settings-form");
  const allAccountsCheckbox = document.getElementById("all-accounts-checkbox");

  document.getElementById("settings-title").textContent = trans("setting_title");
  document.getElementById("auto-tag-title").innerHTML = `${trans("setting_autoTagTitle")} <span class="info-icon" data-tooltip="${trans('setting_autoTagTooltip')}">ⓘ</span>`;
  document.getElementById("all-accounts-label").textContent = trans("setting_allAccountsLabel");
  document.getElementById("select-tags-title").innerHTML = `${trans("setting_selectTagsTitle")} <span class="info-icon" data-tooltip="${trans('setting_selectTagsTooltip')}">ⓘ</span>`;
  document.getElementById("threshold-title").innerHTML = `${trans("setting_thresholdTitle")} <span class="info-icon" data-tooltip="${trans('setting_thresholdTooltip')}">ⓘ</span>`;
  document.getElementById("threshold-label").textContent = trans("setting_thresholdLabel");
  document.getElementById("set-tags-title").textContent = trans("setting_setTagsTitle");
  document.getElementById("tag-on-training-label").textContent = trans("setting_tagOnTrainingLabel");
  document.getElementById("remove-on-classify-label").textContent = trans("setting_removeOnClassifyLabel");
  document.getElementById("backup-restore-title").textContent = trans("setting_backupRestoreTitle");
  document.getElementById("backup-button").textContent = trans("setting_backupButton");
  document.getElementById("restore-button").textContent = trans("setting_restoreButton");
  document.getElementById("save-button").textContent = trans("setting_saveButton");

  // Variablen deklarieren und an window binden
  window.allTags = [];
  window.selectedTags = [];
  window.bayesData = {};
  window.allAccounts = [];
  window.selectedAccounts = [];
  window.threshold = 99;
  window.tagOnTraining = true;
  window.removeOnClassify = false;

  window.tagKeyToNameMap = {};
  window.tagNameToKeyMap = {};

  // Lade alle verfügbaren Tags, Konten und Einstellungen
  Promise.all([
    browser.messages.listTags(),
    browser.accounts.list(),
    browser.storage.local.get([
      "selectedTags",
      "bayesData",
      "selectedAccounts",
      "threshold",
      "tagOnTraining",
      "removeOnClassify",
    ]),
  ])
    .then(([tags, accounts, result]) => {
      window.allTags = tags;
      window.allAccounts = accounts;
      window.bayesData = result.bayesData || {};
      window.selectedAccounts = result.selectedAccounts || [];
      window.threshold =
        result.threshold !== undefined ? result.threshold : 99;
      window.tagOnTraining =
        result.tagOnTraining !== undefined
          ? result.tagOnTraining
          : true;
      window.removeOnClassify =
        result.removeOnClassify !== undefined
          ? result.removeOnClassify
          : false;

      // Setze den Status der Checkboxen
      tagOnTrainingCheckbox.checked = window.tagOnTraining;
      removeOnClassifyCheckbox.checked = window.removeOnClassify;

      // Mapping erstellen
      window.allTags.forEach((tag) => {
        window.tagKeyToNameMap[tag.key] = tag.tag;
        window.tagNameToKeyMap[tag.tag] = tag.key;
      });

      // Konvertiere selectedTags von Tag-Keys zu Tag-Namen
      const storedSelectedTags = result.selectedTags || [];
      window.selectedTags = storedSelectedTags.map(
        (tagKey) => window.tagKeyToNameMap[tagKey] || null
      );

      // Überprüfe, ob alle Konten ausgewählt sind
      let allAccountsSelected =
        window.selectedAccounts.length === window.allAccounts.length;
      allAccountsCheckbox.checked = allAccountsSelected;

      window.renderTags();
      window.renderThreshold();
    })
    .catch((error) => {
      console.error("Error loading settings:", error);
    });

  // Funktionen an window binden
  window.renderTags = function () {
    tagsContainer.innerHTML = "";

    // Begrenze die Anzahl der Dropdowns auf maximal 3 (im Standardfall)
    const maxDropdowns = 3;

    // Erstelle eine Liste der bereits ausgewählten Tags
    const usedTagNames = window.selectedTags.filter((tagName) => tagName);

    for (let i = 0; i < 3; i++) {
      const div = document.createElement("div");
      div.className = "tag-item";

      // Dropdown-Menü (Select)
      const select = document.createElement("select");
      select.id = `tag-select-${i}`;
      select.dataset.index = i;
      select.style.minWidth = "200px";

      // Standardoption
      const defaultOption = document.createElement("option");
      defaultOption.value = "";
      defaultOption.textContent = trans("settings_defaultOption");
      select.appendChild(defaultOption);

      // Optionen hinzufügen, ausschließend bereits ausgewählte Tags
      window.allTags.forEach((tag) => {
        if (
          !usedTagNames.includes(tag.tag) ||
          tag.tag === window.selectedTags[i]
        ) {
          const option = document.createElement("option");
          option.value = tag.tag;
          option.textContent = tag.tag;
          select.appendChild(option);
        }
      });

      // Setze den ausgewählten Wert
      if (window.selectedTags[i]) {
        select.value = window.selectedTags[i];
      } else {
        window.selectedTags[i] = null;
      }

      // Event Listener für Dropdown-Änderungen
      select.addEventListener("change", (e) => {
        const index = parseInt(e.target.dataset.index);
        window.selectedTags[index] = e.target.value || null;

        // Re-render die Dropdowns, um die verfügbaren Optionen zu aktualisieren
        window.renderTags();
      });

      // Span für die Tokenanzahl
      const tokenCountSpan = document.createElement("span");
      tokenCountSpan.className = "token-count";
      tokenCountSpan.style.marginLeft = "auto";

      // Button zum Löschen der Trainingsdaten
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = trans("settings_deleteTrainingData");

      // Initialisiere Zustandsvariablen für den Löschvorgang
      button.deletionPending = false;
      button.deletionTimeout = null;
      button.countdownInterval = null;

      // Wenn ein Tag ausgewählt ist, Tokenanzahl anzeigen und Button aktivieren
      if (window.selectedTags[i]) {
        const tagName = window.selectedTags[i];
        const totalUniqueTokens =
          window.bayesData[tagName]?.totalUniqueTokens || 0;
        tokenCountSpan.textContent = `${totalUniqueTokens} Tokens `;

        button.disabled = totalUniqueTokens <= 0;

        button.addEventListener("click", () => {
          // Lade die neuesten bayesData aus dem Speicher
          browser.storage.local
            .get("bayesData")
            .then((result) => {
              window.bayesData = result.bayesData || {};

              if (
                window.bayesData[tagName] &&
                window.bayesData[tagName].trainingCount > 0
              ) {
                if (button.deletionPending) {
                  // Löschvorgang abbrechen
                  clearTimeout(button.deletionTimeout);
                  clearInterval(button.countdownInterval);
                  button.textContent = trans("settings_deleteTrainingData");
                  button.style.backgroundColor = "#e74c3c"; // Ursprüngliche Farbe
                  button.deletionPending = false;
                  console.log(
                    `Deletion of training data for "${tagName}" has been canceled.`
                  );
                } else {
                  // Startet den 5-Sekunden-Countdown
                  button.deletionPending = true;
                  let countdown = 5;
                  button.textContent = trans("settings_stopDeletion", {countdown});
                  button.style.backgroundColor = "#f39c12"; // Orange Farbe während des Countdowns

                  button.countdownInterval = setInterval(() => {
                    countdown--;
                    if (countdown > 0) {
                      button.textContent = trans("settings_stopDeletion", {countdown});
                    } else {
                      clearInterval(button.countdownInterval);
                    }
                  }, 1000);

                  button.deletionTimeout = setTimeout(() => {
                    // Trainingsdaten löschen
                    window.deleteTrainingDataForTag(
                      tagName,
                      tokenCountSpan,
                      button
                    );

                    button.deletionPending = false;
                    button.textContent = trans("settings_deleteTrainingData");
                    button.style.backgroundColor = "#e74c3c"; // Ursprüngliche Farbe
                  }, 5000);
                }
              } else {
                alert(trans("settings_noTrainingData", { tagName }));
              }
            })
            .catch((error) => {
              console.error(
                "Error loading bayesData:",
                error
              );
              alert(trans("settings_loadTrainingDataError"));
            });
        });
      } else {
        tokenCountSpan.textContent = "";
        button.disabled = true;
      }

      // Füge Elemente zum Div hinzu
      div.appendChild(select);
      div.appendChild(tokenCountSpan);
      div.appendChild(button);

      tagsContainer.appendChild(div);
    }
  };

  window.deleteTrainingDataForTag = function (
    tagName,
    tokenCountSpan,
    button
  ) {
    // Setze die bayesData-Struktur für das Tag zurück
    window.bayesData[tagName] = {
      tokenList: {},
      trainingCount: 0,
      totalPositiveTokens: 0,
      totalNegativeTokens: 0,
      uniquePositiveTokens: 0,
      uniqueNegativeTokens: 0,
      totalUniqueTokens: 0,
    };

    // Speichere die aktualisierten bayesData
    browser.storage.local
      .set({ bayesData: window.bayesData })
      .then(() => {
        alert(trans("settings_trainingDataDeleted", { tagName }));
        console.log(
          `Training data for "${tagName}" has been successfully deleted.`
        );

        // Sende eine Nachricht an background.js, um bayesData neu zu laden
        browser.runtime.sendMessage({ action: "refreshBayesData" });

        // Aktualisiere die Anzeige
        tokenCountSpan.textContent = `0 Tokens `;
        button.disabled = true;
      })
      .catch((error) => {
        console.error(
          `Error deleting training data for "${tagName}":`,
          error
        );
        alert(trans("settings_deleteTrainingDataError", { tagName }));
      });
  };

  window.renderThreshold = function () {
    thresholdInput.value = window.threshold;
  };

  // Eingabevalidierung für Threshold
  thresholdInput.addEventListener("input", () => {
    let value = thresholdInput.value;
    value = value.replace(/\D/g, "");
    if (value !== "") {
      let intValue = parseInt(value, 10);
      if (intValue < 1) intValue = 1;
      if (intValue > 99) intValue = 99;
      thresholdInput.value = intValue;
    } else {
      thresholdInput.value = "";
    }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    // Sammle die ausgewählten Tags aus den Dropdowns
    window.selectedTags = [];
    const selects = document.querySelectorAll("#tags-container select");
    selects.forEach((select, index) => {
      if (select && select.value) {
        window.selectedTags[index] = select.value;
      }
    });

    // Überprüfe, ob die individuelle Kontenliste sichtbar ist
    const individualAccountsContainer = document.getElementById(
      "individual-accounts-container"
    );
    if (
      individualAccountsContainer &&
      individualAccountsContainer.style.display !== "none"
    ) {
      // Sammle ausgewählte Konten aus der individuellen Liste
      window.selectedAccounts = Array.from(
        document.querySelectorAll(
          "#individual-accounts-container input[type=checkbox]:checked"
        )
      ).map((input) => input.id.replace(/^account-/, ""));
    } else {
      // Verwende den Status der "Alle Konten" Checkbox
      if (allAccountsCheckbox.checked) {
        window.selectedAccounts = window.allAccounts.map(
          (account) => account.id
        );
      } else {
        window.selectedAccounts = [];
      }
    }

    window.threshold = parseInt(thresholdInput.value, 10);

    // Validierung des Threshold-Wertes
    if (
      isNaN(window.threshold) ||
      window.threshold < 1 ||
      window.threshold > 99
    ) {
      alert(trans("settings_invalidThreshold"));
      return;
    }

    // Speichere die Einstellungen
    // Konvertiere selectedTags von Tag-Namen zu Tag-Keys
    const selectedTagKeys = window.selectedTags.map(
      (tagName) => window.tagNameToKeyMap[tagName] || tagName
    );

    browser.storage.local
      .set({
        selectedTags: selectedTagKeys,
        selectedAccounts: window.selectedAccounts,
        threshold: window.threshold,
        tagOnTraining: tagOnTrainingCheckbox.checked,
        removeOnClassify: removeOnClassifyCheckbox.checked,
      })
      .then(() => {
        alert(trans("settings_saved"));

        // Senden der Nachrichten, um die Änderungen in background.js zu aktualisieren
        browser.runtime.sendMessage({ action: "updateContextMenu" });
        browser.runtime.sendMessage({
          action: "updateThreshold",
          threshold: window.threshold,
        });
        browser.runtime.sendMessage({
          action: "updateRemoveOnClassify",
          removeOnClassify: removeOnClassifyCheckbox.checked,
        });

        console.log("Settings successfully saved:", {
          selectedTags: selectedTagKeys,
          selectedAccounts: window.selectedAccounts,
          threshold: window.threshold,
          tagOnTraining: tagOnTrainingCheckbox.checked,
          removeOnClassify: removeOnClassifyCheckbox.checked,
        });
      })
      .catch((error) => {
        console.error("Error saving settings:", error);
        alert(trans("settings_saveError"));
      });
  });

  // Funktion zum Neuladen der Einstellungen
  window.reloadSettings = function () {
    console.log("Reloading settings...");
    browser.storage.local
      .get([
        "selectedTags",
        "bayesData",
        "selectedAccounts",
        "threshold",
        "tagOnTraining",
        "removeOnClassify",
      ])
      .then((result) => {
        console.log("Current settings:", result);
        window.bayesData = result.bayesData || {};
        window.threshold =
          result.threshold !== undefined ? result.threshold : 99;
        window.tagOnTraining =
          result.tagOnTraining !== undefined
            ? result.tagOnTraining
            : true;
        window.removeOnClassify =
          result.removeOnClassify !== undefined
            ? result.removeOnClassify
            : false;

        // Setze den Status der Checkboxen
        tagOnTrainingCheckbox.checked = window.tagOnTraining;
        removeOnClassifyCheckbox.checked = window.removeOnClassify;

        // Konvertiere selectedTags von Tag-Keys zu Tag-Namen
        const storedSelectedTags = result.selectedTags || [];
        window.selectedTags = storedSelectedTags.map(
          (tagKey) => window.tagKeyToNameMap[tagKey] || null
        );

        // Überprüfe, ob alle Konten ausgewählt sind
        window.selectedAccounts = result.selectedAccounts || [];
        let allAccountsSelected =
          window.selectedAccounts.length === window.allAccounts.length;
        allAccountsCheckbox.checked = allAccountsSelected;

        window.renderTags();
        window.renderThreshold();
      })
      .catch((error) => {
        console.error("Error reloading settings:", error);
      });
  };

  // Event-Listener zum Neuladen der Einstellungen
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      console.log(
        "Settings page is now visible. Reloading settings."
      );
      window.reloadSettings();
    }
  });

  window.addEventListener("focus", () => {
    console.log(
      "Settings page has gained focus. Reloading settings."
    );
    window.reloadSettings();
  });
});
