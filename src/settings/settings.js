// settings.js

function trans(messageName, placeholders = {}) {
  const message = messenger.i18n.getMessage(messageName, Object.values(placeholders));

  if (!message) {
      console.warn(`No translation found for key "${messageName}".`);
      return messageName; // Fallback to the key if no translation is found
  }

  return message;
}

document.addEventListener("DOMContentLoaded", () => {
  // Elements from the DOM
  const tagsContainer = document.getElementById("tags-container");
  const thresholdInput = document.getElementById("threshold");
  const tagOnTrainingCheckbox = document.getElementById("tagOnTraining");
  const removeOnClassifyCheckbox = document.getElementById("removeOnClassify");
  const form = document.getElementById("settings-form");
  const allAccountsCheckbox = document.getElementById("all-accounts-checkbox");
  const backupSection = document.getElementById("backup-restore-section");
  const backupButton = document.getElementById("backup-button");
  const restoreButton = document.getElementById("restore-button");
  const restoreFileInput = document.getElementById("restore-file-input");
  const individualAccountsContainer = document.getElementById("individual-accounts-container");

  document.getElementById("settings-title").textContent = trans("setting_title");

  const donationEmailInput = document.getElementById("donation-email");
  const requestDonationCodeButton = document.getElementById("request-donation-code-button");
  const donationCodeInput = document.getElementById("donation-code-input");
  const donationMessage = document.getElementById("donation-message");
  const donationError = document.getElementById("donation-error");

  // Securely adding tooltip content without innerHTML
  const autoTagTitle = document.getElementById("auto-tag-title");
  autoTagTitle.textContent = trans("setting_autoTagTitle");
  const autoTagTooltip = document.createElement("span");
  autoTagTooltip.className = "info-icon";
  autoTagTooltip.setAttribute("data-tooltip", trans("setting_autoTagTooltip"));
  autoTagTooltip.textContent = "ⓘ";
  autoTagTitle.appendChild(autoTagTooltip);

  document.getElementById("all-accounts-label").textContent = trans("setting_allAccountsLabel");

  // Securely adding tooltip content for select-tags-title
  const selectTagsTitle = document.getElementById("select-tags-title");
  selectTagsTitle.textContent = trans("setting_selectTagsTitle");
  const selectTagsTooltip = document.createElement("span");
  selectTagsTooltip.className = "info-icon";
  selectTagsTooltip.setAttribute("data-tooltip", trans("setting_selectTagsTooltip"));
  selectTagsTooltip.textContent = "ⓘ";
  selectTagsTitle.appendChild(selectTagsTooltip);

  // Securely adding tooltip content for threshold-title
  const thresholdTitle = document.getElementById("threshold-title");
  thresholdTitle.textContent = trans("setting_thresholdTitle");
  const thresholdTooltip = document.createElement("span");
  thresholdTooltip.className = "info-icon";
  thresholdTooltip.setAttribute("data-tooltip", trans("setting_thresholdTooltip"));
  thresholdTooltip.textContent = "ⓘ";
  thresholdTitle.appendChild(thresholdTooltip);

  document.getElementById("threshold-label").textContent = trans("setting_thresholdLabel");
  document.getElementById("set-tags-title").textContent = trans("setting_setTagsTitle");
  document.getElementById("tag-on-training-label").textContent = trans("setting_tagOnTrainingLabel");
  document.getElementById("remove-on-classify-label").textContent = trans("setting_removeOnClassifyLabel");
  document.getElementById("backup-restore-title").textContent = trans("setting_backupRestoreTitle");
  document.getElementById("backup-button").textContent = trans("setting_backupButton");
  document.getElementById("restore-button").textContent = trans("setting_restoreButton");
  document.getElementById("save-button").textContent = trans("setting_saveButton");

  // Initialize variables and bind to window
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

  // Load all available tags, accounts, and settings
  Promise.all([
      messenger.messages.listTags(),
      messenger.accounts.list(),
      messenger.storage.local.get([
          "selectedTags",
          "bayesData",
          "selectedAccounts",
          "threshold",
          "tagOnTraining",
          "removeOnClassify",
          "donation_handler" 
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

      // Set the status of checkboxes
      tagOnTrainingCheckbox.checked = window.tagOnTraining;
      removeOnClassifyCheckbox.checked = window.removeOnClassify;

      // Laden der vorhandenen donation_handler Daten
      window.donationHandler = result.donation_handler;
      console.log("Donation data loaded:", window.donationHandler);

      // Setze das E-Mail-Feld auf die gespeicherte donation_mail
      if (window.donationHandler && window.donationHandler.donation_mail) {
          donationEmailInput.value = window.donationHandler.donation_mail;
      } else {
          donationEmailInput.value = '';
      }

      if (window.donationHandler && window.donationHandler.donation_key) {
        donationCodeInput.value = window.donationHandler.donation_key;
        requestDonationCodeButton.disabled = true; // Button deaktivieren
        donationEmailInput.disabled = true;
        donationCodeInput.disabled = true;
        console.log("Donation code is already present. Button and inputs are disabled.");
    }

      // **Neuer Code zur Überprüfung und Vorfüllung des Spenden-Codes**
      if (window.donationHandler && window.donationHandler.donation_key) {
          donationCodeInput.value = window.donationHandler.donation_key;
          // **Deaktiviere den "Spenden-Code anfordern" Button und die Eingabefelder**
          requestDonationCodeButton.disabled = true;
          donationEmailInput.disabled = true;
          donationCodeInput.disabled = true;
          console.log("Donation code is already present. Request button and input fields disabled.");
      } else {
          donationCodeInput.value = '';
          requestDonationCodeButton.disabled = false;
          donationEmailInput.disabled = false;
          donationCodeInput.disabled = false;
}

      // Create mapping
      window.allTags.forEach((tag) => {
          window.tagKeyToNameMap[tag.key] = tag.tag;
          window.tagNameToKeyMap[tag.tag] = tag.key;
      });

      // Convert selectedTags from tag keys to tag names
      const storedSelectedTags = result.selectedTags || [];
      window.selectedTags = storedSelectedTags.map(
          (tagKey) => window.tagKeyToNameMap[tagKey] || null
      );

      // Check if all accounts are selected
      let allAccountsSelected =
          window.selectedAccounts.length === window.allAccounts.length;
      allAccountsCheckbox.checked = allAccountsSelected;

      // Show backup-restore section
      if (backupSection) {
          backupSection.style.display = "block";
      }

      // Show "All Accounts" checkbox and individual accounts list
      if (allAccountsCheckbox && individualAccountsContainer) {
          allAccountsCheckbox.parentElement.style.display = "block";
          individualAccountsContainer.style.display = "block";
      }

      window.renderTags();
      window.renderThreshold();

      // Load accounts and render individual accounts
      renderIndividualAccounts();
      updateAllAccountsCheckbox(); // Update the state of "All Accounts" checkbox after rendering

  })
  .catch((error) => {
      console.error("Error loading settings:", error);
  });

  // Functions
  function renderIndividualAccounts() {
      individualAccountsContainer.innerHTML = "";
      window.allAccounts.forEach((account) => {
          const div = document.createElement("div");
          div.className = "account-item";

          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.id = `account-${account.id}`;
          checkbox.checked = window.selectedAccounts.includes(account.id);

          const label = document.createElement("label");
          label.htmlFor = `account-${account.id}`;
          label.textContent = account.name;

          // Event listener for individual account checkbox
          checkbox.addEventListener("change", () => {
              if (checkbox.checked) {
                  if (!window.selectedAccounts.includes(account.id)) {
                      window.selectedAccounts.push(account.id);
                  }
              } else {
                  window.selectedAccounts = window.selectedAccounts.filter(id => id !== account.id);
              }

              saveSelectedAccounts();
              updateAllAccountsCheckbox();
          });

          div.appendChild(checkbox);
          div.appendChild(label);
          individualAccountsContainer.appendChild(div);
      });
  }

  // Function to save selected accounts to local storage
  function saveSelectedAccounts() {
      messenger.storage.local.set({ selectedAccounts: window.selectedAccounts }).then(() => {
          console.log("Selected accounts saved:", window.selectedAccounts);
      }).catch((error) => {
          console.error("Error saving selected accounts:", error);
      });
  }

  // Function to update the state of "All Accounts" checkbox
  function updateAllAccountsCheckbox() {
      if (!allAccountsCheckbox) return;
      if (window.selectedAccounts.length === window.allAccounts.length && window.allAccounts.length > 0) {
          allAccountsCheckbox.checked = true;
          allAccountsCheckbox.indeterminate = false;
      } else if (window.selectedAccounts.length > 0 && window.selectedAccounts.length < window.allAccounts.length) {
          allAccountsCheckbox.checked = false;
          allAccountsCheckbox.indeterminate = true;
      } else {
          allAccountsCheckbox.checked = false;
          allAccountsCheckbox.indeterminate = false;
      }
  }

  // Override renderTags function to allow dynamic number of dropdowns
  window.renderTags = function () {
      tagsContainer.innerHTML = "";

      // Create a list of already selected tags
      const usedTagNames = window.selectedTags.filter((tagName) => tagName);

      // Calculate the number of needed dropdowns: number of selected tags + 1, up to all tags
      let dropdownCount = usedTagNames.length + 1;
      if (dropdownCount > window.allTags.length) {
          dropdownCount = window.allTags.length;
      }

      for (let i = 0; i < dropdownCount; i++) {
          const div = document.createElement("div");
          div.className = "tag-item";

          // Dropdown menu (Select)
          const select = document.createElement("select");
          select.id = `tag-select-${i}`;
          select.dataset.index = i;
          select.style.minWidth = "200px";

          // Default option
          const defaultOption = document.createElement("option");
          defaultOption.value = "";
          defaultOption.textContent = trans("settings_defaultOption");
          select.appendChild(defaultOption);

          // Add options, excluding already selected tags except for the current dropdown
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

          // Set the selected value
          if (window.selectedTags[i]) {
              select.value = window.selectedTags[i];
          } else {
              window.selectedTags[i] = null;
          }

          // Event listener for dropdown changes
          select.addEventListener("change", (e) => {
              const index = parseInt(e.target.dataset.index);
              window.selectedTags[index] = e.target.value || null;

              // Re-render the dropdowns to update available options
              window.renderTags();
          });

          // Span for token count
          const tokenCountSpan = document.createElement("span");
          tokenCountSpan.className = "token-count";
          tokenCountSpan.style.marginLeft = "auto";

          // Button to delete training data
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = trans("settings_deleteTrainingData");

          // Initialize state variables for deletion process
          button.deletionPending = false;
          button.deletionTimeout = null;
          button.countdownInterval = null;

          // If a tag is selected, display token count and enable button
          if (window.selectedTags[i]) {
              const tagName = window.selectedTags[i];
              const totalUniqueTokens =
                  window.bayesData[tagName]?.totalUniqueTokens || 0;
              tokenCountSpan.textContent = `${totalUniqueTokens} Tokens `;

              button.disabled = totalUniqueTokens <= 0;

              button.addEventListener("click", () => {
                  // Load the latest bayesData from storage
                  messenger.storage.local
                      .get("bayesData")
                      .then((result) => {
                          window.bayesData = result.bayesData || {};

                          if (
                              window.bayesData[tagName] &&
                              window.bayesData[tagName].trainingCount > 0
                          ) {
                              if (button.deletionPending) {
                                  // Cancel deletion process
                                  clearTimeout(button.deletionTimeout);
                                  clearInterval(button.countdownInterval);
                                  button.textContent = trans("settings_deleteTrainingData");
                                  button.style.backgroundColor = "#e74c3c"; // Original color
                                  button.deletionPending = false;
                                  console.log(
                                      `Deletion of training data for "${tagName}" has been canceled.`
                                  );
                              } else {
                                  // Start 5-second countdown
                                  button.deletionPending = true;
                                  let countdown = 5;
                                  button.textContent = trans("settings_stopDeletion", { countdown });
                                  button.style.backgroundColor = "#f39c12"; // Orange color during countdown

                                  button.countdownInterval = setInterval(() => {
                                      countdown--;
                                      if (countdown > 0) {
                                          button.textContent = trans("settings_stopDeletion", { countdown });
                                      } else {
                                          clearInterval(button.countdownInterval);
                                      }
                                  }, 1000);

                                  button.deletionTimeout = setTimeout(() => {
                                      // Delete training data
                                      window.deleteTrainingDataForTag(
                                          tagName,
                                          tokenCountSpan,
                                          button
                                      );

                                      button.deletionPending = false;
                                      button.textContent = trans("settings_deleteTrainingData");
                                      button.style.backgroundColor = "#e74c3c"; // Original color
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

          // Append elements to div
          div.appendChild(select);
          div.appendChild(tokenCountSpan);
          div.appendChild(button);

          tagsContainer.appendChild(div);
      }
  };

  // Delete training data function
  if (typeof window.deleteTrainingDataForTag !== 'function') {
      window.deleteTrainingDataForTag = function (
          tagName,
          tokenCountSpan,
          button
      ) {
          // Reset bayesData structure for the tag
          window.bayesData[tagName] = {
              tokenList: {},
              trainingCount: 0,
              totalPositiveTokens: 0,
              totalNegativeTokens: 0,
              uniquePositiveTokens: 0,
              uniqueNegativeTokens: 0,
              totalUniqueTokens: 0,
          };

          // Save updated bayesData
          messenger.storage.local
              .set({ bayesData: window.bayesData })
              .then(() => {
                  alert(trans("settings_trainingDataDeleted", { tagName }));
                  console.log(
                      `Training data for "${tagName}" has been successfully deleted.`
                  );

                  // Send message to background.js to reload bayesData
                  messenger.runtime.sendMessage({ action: "refreshBayesData" });

                  // Update display
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
  }

  // Override renderThreshold function
  window.renderThreshold = function () {
      if (thresholdInput) {
          thresholdInput.value = window.threshold;
      } else {
          console.error("thresholdInput is not present in the DOM.");
      }
  };

  // **Neuer Code zur automatischen Überprüfung des Spenden-Codes**
  donationCodeInput.addEventListener("input", async () => {
    const code = donationCodeInput.value.trim();
    if (code.length === 16) {
        const email = donationEmailInput.value.trim().toLowerCase();
        if (!email) {
            donationError.textContent = "Bitte geben Sie eine gültige E-Mail-Adresse ein.";
            donationError.style.display = "block";
            donationMessage.style.display = "none";
            return;
        }

        // Berechne SHA256 Hash der E-Mail und nehme die ersten 16 Zeichen
        const encoder = new TextEncoder();
        const data = encoder.encode(email);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const fullHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        const cryptedemail = fullHash.substring(0, 16);
        console.debug("cryptedemail :", cryptedemail, " code:", code);

        try {
            const isValid = await messenger.runtime.sendMessage({
                action: "verifyDonationCode",
                cryptedemail: cryptedemail,
                code: code
            });

            if (isValid) {
                donationMessage.textContent = "Spenden-Code erfolgreich überprüft. Vielen Dank für Ihre Unterstützung!";
                donationMessage.style.display = "block";
                donationError.style.display = "none";

                // Spenden-Code in der Datenbank speichern
                messenger.storage.local.get('donation_handler').then(storageResult => {
                    const donationData = storageResult.donation_handler || {};
                    donationData.donation_key = code;
                    donationData.donation_mail = email;
                    donationData.last_check_date = new Date().toISOString().split('T')[0];
                    donationData.usage_counter = 0;

                    messenger.storage.local.set({ donation_handler: donationData })
                        .then(() => {
                            console.log("Spenden-Code erfolgreich gespeichert.");
                            // **Deaktiviere den "Spenden-Code anfordern" Button und die Eingabefelder**
                            requestDonationCodeButton.disabled = true;
                            donationEmailInput.disabled = true;
                            donationCodeInput.disabled = true;
                        })
                        .catch((error) => {
                            console.error("Fehler beim Speichern des Spenden-Codes:", error);
                        });
                });
            } else {
                donationError.textContent = "Der eingegebene Spenden-Code ist ungültig.";
                donationError.style.display = "block";
                donationMessage.style.display = "none";

                // Blende die Fehlermeldung nach 5 Sekunden aus
                setTimeout(() => {
                    donationError.style.display = "none";
                }, 5000);
            }
        } catch (error) {
            console.error("Fehler bei der Überprüfung des Spenden-Codes:", error);
            donationError.textContent = "Ein unerwarteter Fehler ist aufgetreten.";
            donationError.style.display = "block";
            donationMessage.style.display = "none";
        }
    } else {
        // Wenn der Code weniger als 16 Zeichen ist, reaktiviere die Buttons und Eingabefelder
        if (code.length < 16) {
            requestDonationCodeButton.disabled = false;
            donationEmailInput.disabled = false;
        }
    }
  });


  // Input validation for Threshold
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

  // Form submission handling
  form.addEventListener("submit", (e) => {
      e.preventDefault();
      // Collect selected tags from the dropdowns
      window.selectedTags = [];
      const selects = document.querySelectorAll("#tags-container select");
      selects.forEach((select, index) => {
          if (select && select.value) {
              window.selectedTags[index] = select.value;
          }
      });

      // Check if the individual accounts list is visible
      if (
          individualAccountsContainer &&
          individualAccountsContainer.style.display !== "none"
      ) {
          // Collect selected accounts from the individual list
          window.selectedAccounts = Array.from(
              document.querySelectorAll(
                  "#individual-accounts-container input[type=checkbox]:checked"
              )
          ).map((input) => input.id.replace(/^account-/, ""));
      } else {
          // Use the status of the "All Accounts" checkbox
          if (allAccountsCheckbox.checked) {
              window.selectedAccounts = window.allAccounts.map(
                  (account) => account.id
              );
          } else {
              window.selectedAccounts = [];
          }
      }

      window.threshold = parseInt(thresholdInput.value, 10);

      // Validation of threshold value
      if (
          isNaN(window.threshold) ||
          window.threshold < 1 ||
          window.threshold > 99
      ) {
          alert(trans("settings_invalidThreshold"));
          return;
      }

      // Save settings
      // Convert selectedTags from tag names to tag keys
      const selectedTagKeys = window.selectedTags.map(
          (tagName) => window.tagNameToKeyMap[tagName] || tagName
      );

      messenger.storage.local
          .set({
              selectedTags: selectedTagKeys,
              selectedAccounts: window.selectedAccounts,
              threshold: window.threshold,
              tagOnTraining: tagOnTrainingCheckbox.checked,
              removeOnClassify: removeOnClassifyCheckbox.checked,
          })
          .then(() => {
              alert(trans("settings_saved"));

              // Send messages to update changes in background.js
              messenger.runtime.sendMessage({ action: "updateContextMenu" });
              messenger.runtime.sendMessage({
                  action: "updateThreshold",
                  threshold: window.threshold,
              });
              messenger.runtime.sendMessage({
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

  // Function to reload settings
  window.reloadSettings = function () {
      console.log("Reloading settings...");
      messenger.storage.local
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

              // Set the status of checkboxes
              tagOnTrainingCheckbox.checked = window.tagOnTraining;
              removeOnClassifyCheckbox.checked = window.removeOnClassify;

              // Convert selectedTags from tag keys to tag names
              const storedSelectedTags = result.selectedTags || [];
              window.selectedTags = storedSelectedTags.map(
                  (tagKey) => window.tagKeyToNameMap[tagKey] || null
              );

              // Check if all accounts are selected
              window.selectedAccounts = result.selectedAccounts || [];
              let allAccountsSelected =
                  window.selectedAccounts.length === window.allAccounts.length;
              allAccountsCheckbox.checked = allAccountsSelected;

              window.renderTags();
              window.renderThreshold();
              renderIndividualAccounts();
              updateAllAccountsCheckbox();

          })
          .catch((error) => {
              console.error("Error reloading settings:", error);
          });
  };

  // Event listeners to reload settings
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

  // Backup functionality
  backupButton.addEventListener("click", () => {
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');

      const formattedDate = `${year}${month}${day}`;
      const fileName = `PrioMailbox-TrainDB-${formattedDate}.zip`;

      messenger.storage.local.get("bayesData").then((result) => {
          const bayesData = result.bayesData || {};
          const jsonData = JSON.stringify(bayesData, null, 2);

          const zip = new JSZip();
          zip.file("bayesData.json", jsonData);

          zip.generateAsync({ type: "blob" }).then((content) => {
              const url = URL.createObjectURL(content);
              const a = document.createElement("a");
              a.href = url;
              a.download = fileName;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
          }).catch((error) => {
              console.error("Error creating ZIP backup:", error);
              alert(trans("settings_backupError"));
          });
      }).catch((error) => {
          console.error("Error backing up training data:", error);
          alert(trans("settings_backupError"));
      });
  });

  // Restore functionality
  restoreButton.addEventListener("click", () => {
      restoreFileInput.click();
  });

  restoreFileInput.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (!file) {
          return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
          const arrayBuffer = e.target.result;

          JSZip.loadAsync(arrayBuffer).then((zip) => {
              return zip.file("bayesData.json").async("string");
          }).then((jsonData) => {
              const importedBayesData = JSON.parse(jsonData);

              if (typeof importedBayesData !== 'object') {
                  throw new Error(trans("settings_invalidDataError"));
              }

              // Save the restored data
              messenger.storage.local.set({ bayesData: importedBayesData }).then(() => {
                  alert(trans("settings_restoreSuccess"));
                  console.log("Training data has been successfully restored.");

                  // Send message to background.js to reload bayesData
                  messenger.runtime.sendMessage({ action: "refreshBayesData" });

                  // Update display
                  window.reloadSettings();
              }).catch((error) => {
                  console.error("Error saving training data:", error);
                  alert(trans("settings_restoreError"));
              });
          }).catch((error) => {
              console.error("Error processing ZIP file:", error);
              alert(trans("settings_invalidZipError"));
          });
      };

      reader.readAsArrayBuffer(file);
  });

  // Event listener for "All Accounts" checkbox
  allAccountsCheckbox.addEventListener("change", () => {
      const isChecked = allAccountsCheckbox.checked;
      const accountCheckboxes = individualAccountsContainer.querySelectorAll("input[type='checkbox']");
      accountCheckboxes.forEach((checkbox) => {
          checkbox.checked = isChecked;
      });

      // Update selected accounts
      window.selectedAccounts = isChecked ? window.allAccounts.map(account => account.id) : [];
      saveSelectedAccounts();
  });

  // **Handle 'Spenden-Code anfordern' Button-Klick**
  let isRequestDonationCodeAllowed = true; // Status, ob der Button aktiviert ist

  requestDonationCodeButton.addEventListener("click", async () => {
      if (!isRequestDonationCodeAllowed) {
          alert("Bitte warten Sie 10 Sekunden, bevor Sie erneut klicken.");
          return;
      }

      let email = donationEmailInput.value.trim().toLowerCase();
      donationEmailInput.value = email; // Aktualisiere das Eingabefeld mit der normalisierten E-Mail

      // Entferne Leerzeichen und stelle sicher, dass die E-Mail-Adresse klein geschrieben ist
      email = email.replace(/\s+/g, '');

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
          alert("Bitte geben Sie eine gültige E-Mail-Adresse ein.");
          return;
      }

      // Deaktiviere den Button für 10 Sekunden
      isRequestDonationCodeAllowed = false;
      requestDonationCodeButton.disabled = true;

      // Berechne SHA-256 Hash der E-Mail und nehme die ersten 16 Zeichen
      const encoder = new TextEncoder();
      const data = encoder.encode(email);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const fullHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      const cryptedemail = fullHash.substring(0, 16);

      console.log("Berechneter cryptedemail:", cryptedemail); // Debugging-Log

      // Sende Nachricht zum Anfordern des Spenden-Codes
      try {
          const response = await messenger.runtime.sendMessage({
              action: "requestDonationCode",
              email: email // Hier sendest du die normalisierte E-Mail
          });

          if (response.success) {
              donationMessage.textContent = "Ein Spenden-Code wurde an Ihre E-Mail-Adresse gesendet.";
              donationMessage.style.display = "block";
              donationError.style.display = "none";
          } else {
              donationError.textContent = response.message || "Keine Spende gefunden.";
              donationError.style.display = "block";
              donationMessage.style.display = "none";

              // Blende die Fehlermeldung nach 5 Sekunden aus
              setTimeout(() => {
                  donationError.style.display = "none";
              }, 5000);
          }
      } catch (error) {
          console.error("Fehler beim Anfordern des Spenden-Codes:", error);
          donationError.textContent = "Ein unerwarteter Fehler ist aufgetreten.";
          donationError.style.display = "block";
          donationMessage.style.display = "none";
      } finally {
          // Aktiviere den Button nach 10 Sekunden wieder
          setTimeout(() => {
              isRequestDonationCodeAllowed = true;
              requestDonationCodeButton.disabled = false;
          }, 10000);
      }
  });


  // **Neuer Code zum Reaktivieren der Buttons und Eingabefelder, wenn der Spenden-Code entfernt wird**
  donationCodeInput.addEventListener("input", () => {
      if (donationCodeInput.value.trim() === "") {
          requestDonationCodeButton.disabled = false; // **Aktiviere den "Spenden-Code anfordern" Button**
          donationEmailInput.disabled = false; // **Aktiviere die E-Mail-Eingabe**
          console.log("Donation code input cleared. Verify and Request buttons enabled.");
      }
  });

  // Öffnet die Spendenseite im Systembrowser
  document.getElementById("donate-button").addEventListener("click", () => {
      const donationUrl = "https://priomailbox.innere-leichtigkeit.de/donation.html"; 
      messenger.runtime.sendMessage({
          action: "openUrlInSystemBrowser",
          url: donationUrl
      });
  });
});
