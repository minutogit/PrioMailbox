//background.js

let selectedTags = [];
let bayesData = {};
let allTags = [];
let selectedAccounts = [];
let threshold = 0.99; // Standardwert 0.99 (99%)
let removeOnClassify = true; // Standardwert true
const maxTokenCount = 10000; // Maximale Anzahl der Tokens in der Datenbank.
let tagKeyToNameMap = {}; // Mapping von Tag-Key zu Tag-Name
let tagNameToKeyMap = {}; // Mapping von Tag-Name zu Tag-Key
const lastCheckTimestamps = {}; // Stores the last check timestamp for each folder to optimize performance (in milliseconds) 


// translate-Funktion zur Nutzung von i18n
function trans(messageName, placeholders = []) {
  const message = messenger.i18n.getMessage(messageName, placeholders);

  if (!message) {
    console.warn(`No translation found for key "${messageName}"`);
    return messageName; // Fallback auf den Schlüssel, wenn keine Übersetzung gefunden wurde
  }

  return message;
}

console.log("Available functions in messenger.messages:", Object.keys(messenger.messages));


function initialize() {
  console.log("Initializing...");
  Promise.all([
    messenger.storage.local.get([
      "selectedTags",
      "bayesData",
      "selectedAccounts",
      "threshold",
      "tagOnTraining",
      "removeOnClassify",
    ]),
    messenger.messages.listTags(),
  ])
    .then(([storageResult, tags]) => {
      allTags = tags;
      selectedTags = storageResult.selectedTags || [];
      bayesData = storageResult.bayesData || {};
      selectedAccounts = storageResult.selectedAccounts || [];
      threshold =
        typeof storageResult.threshold === "number" &&
        !isNaN(storageResult.threshold)
          ? storageResult.threshold / 100
          : 0.99;

      // Setze den Standardwert von 'tagOnTraining' auf true, falls nicht vorhanden
      tagOnTraining =
        storageResult.tagOnTraining !== undefined
          ? storageResult.tagOnTraining
          : true;

      // Setze den Standardwert von 'removeOnClassify' auf false, falls nicht vorhanden
      removeOnClassify =
        storageResult.removeOnClassify !== undefined
          ? storageResult.removeOnClassify
          : false;
      
      /// Überprüfe und initialisiere oder lade donation_handler
      messenger.storage.local.get('donation_handler').then(storageResult => {
        if (!storageResult.donation_handler) {
            // Wenn donation_handler nicht existiert, initialisiere ihn
            const today = new Date().toISOString().split('T')[0]; // Aktuelles Datum im Format YYYY-MM-DD
            const defaultDonationData = {
                donation_key: '',
                donation_mail: '',
                last_check_date: today, // Aktuelles Datum ohne Uhrzeit
                usage_counter: 0
            };

            // Generiere die Checksum und speichere die Daten
            generateChecksum(defaultDonationData.usage_counter, defaultDonationData.last_check_date)
                .then(checksum => {
                    defaultDonationData.checksum = checksum; // Setze die generierte Checksum
                    messenger.storage.local.set({ donation_handler: defaultDonationData });
                })
                .catch(error => {
                    console.error("Error generating checksum:", error);
                });
        } else {
            // Wenn donation_handler existiert, lade die vorhandenen Daten
            const donationHandler = storageResult.donation_handler;
        }
      }).catch(error => {
        console.error("Error accessing donation data:", error);
      });
            
      // Speichere Standardwerte, wenn sie nicht existieren
      let settingsToSave = {};
      if (storageResult.tagOnTraining === undefined) {
        settingsToSave.tagOnTraining = true;
      }
      if (storageResult.removeOnClassify === undefined) {
        settingsToSave.removeOnClassify = false;
      }
      if (Object.keys(settingsToSave).length > 0) {
        messenger.storage.local.set(settingsToSave);
      }

      // Mapping von Tag-Key zu Tag-Name erstellen
      allTags.forEach((tag) => {
        tagKeyToNameMap[tag.key] = tag.tag;
        tagNameToKeyMap[tag.tag] = tag.key;
      });

      // Konvertiere selectedTags von Tag-Keys zu Tag-Namen
      selectedTags = selectedTags.map(
        (tagKey) => tagKeyToNameMap[tagKey] || tagKey
      );

      // Sicherstellen, dass die Struktur korrekt ist
      selectedTags.forEach((tagName) => {
        if (!bayesData[tagName]) {
          // Initialisiere die gesamte Struktur, wenn das Tag neu ist
          bayesData[tagName] = {
            tokenList: {},
            trainingCount: 0,
            totalPositiveTokens: 0,
            totalNegativeTokens: 0,
            uniquePositiveTokens: 0,
            uniqueNegativeTokens: 0,
            totalUniqueTokens: 0,
          };
        } else {
          // Falls das Tag bereits existiert, sicherstellen, dass die neuen Felder vorhanden sind
          bayesData[tagName].tokenList =
            bayesData[tagName].tokenList || {};
          bayesData[tagName].trainingCount =
            bayesData[tagName].trainingCount || 0;
          bayesData[tagName].totalPositiveTokens =
            bayesData[tagName].totalPositiveTokens || 0;
          bayesData[tagName].totalNegativeTokens =
            bayesData[tagName].totalNegativeTokens || 0;
          bayesData[tagName].uniquePositiveTokens =
            bayesData[tagName].uniquePositiveTokens || 0;
          bayesData[tagName].uniqueNegativeTokens =
            bayesData[tagName].uniqueNegativeTokens || 0;
          bayesData[tagName].totalUniqueTokens =
            bayesData[tagName].totalUniqueTokens || 0;
        }
      });

      console.log("Settings loaded:", selectedTags);
      console.log("Bayes data loaded:", bayesData);
      console.log("Selected accounts:", selectedAccounts);
      console.log("Threshold:", threshold);
      console.log("All tags loaded:", allTags);
      console.log("Tag-on-training status:", tagOnTraining);
      console.log("RemoveOnClassify status:", removeOnClassify);

      createContextMenu();
      messenger.messages.onNewMailReceived.addListener(onNewMailReceived);

    // Listener to handle new mails (workaround since onNewMailReceived is unreliable)

    // Check new mails when the displayed folder changes
    messenger.mailTabs.onDisplayedFolderChanged.addListener(onFolderDisplayed);

    // Check new mails when the Thunderbird window gains focus
    messenger.windows.onFocusChanged.addListener((windowId) => {
      if (windowId === messenger.windows.WINDOW_ID_NONE) {
        return; // No active window
      }
      messenger.mailTabs.query({ active: true }).then((tabs) => {
        if (tabs.length > 0 && tabs[0].displayedFolder) {
          onFolderDisplayed(tabs[0], tabs[0].displayedFolder);
        }
      }).catch(() => console.error("Error in onFocusChanged listener."));
    });

    // Check new mails when switching to a tab with a folder
    messenger.tabs.onActivated.addListener(async (activeInfo) => {
      try {
        const tab = await messenger.tabs.get(activeInfo.tabId);
        if (tab && tab.mailTab) {
          const mailTab = await messenger.mailTabs.get(tab.id);
          if (mailTab.displayedFolder) {
            onFolderDisplayed(mailTab, mailTab.displayedFolder);
          }
        }
      } catch (error) {
        console.error("Error in onActivated listener:", error);
      }
    });

    // Sheduler for updateUsageData
    messenger.alarms.create("updateUsageDataAlarm", { periodInMinutes: 10 });
    messenger.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === "updateUsageDataAlarm") {
        updateUsageData();
      }
    });

    })
    .catch((error) => {
      console.error("Error during initialization:", error);
    });
}

function openPopupWithMessage(messageText) {
  messenger.browserAction
    .setPopup({
      popup: `popup/popup.html?message=${encodeURIComponent(messageText)}`,
    })
    .then(() => {
      messenger.browserAction.openPopup().then(() => {
        messenger.browserAction.setPopup({ popup: "popup/popup.html" });
      });
    })
    .catch((error) => {
      console.error("Error opening popup:", error);
    });
}


function createContextMenu() {
  messenger.menus
    .removeAll()
    .then(() => {
      // Aktuelle Tags abrufen und Mappings aktualisieren
      messenger.messages.listTags().then((tags) => {
        allTags = tags;
        tagKeyToNameMap = {};
        tagNameToKeyMap = {};
        allTags.forEach((tag) => {
          tagKeyToNameMap[tag.key] = tag.tag;
          tagNameToKeyMap[tag.tag] = tag.key;
        });

        // Hauptmenüeintrag für PrioMailbox
        // Context menu for messages
        messenger.menus.create({
          id: "priomailbox",
          title: "PrioMailbox",
          contexts: ["message_list"],
        });

        // Context menu for folders
        messenger.menus.create({
          id: "priomailbox-folder",
          title: "PrioMailbox",
          contexts: ["folder_pane"],
        });

        messenger.menus.create({
          id: "classify-folder",
          parentId: "priomailbox-folder",
          title: trans("classifyMenu"),
          contexts: ["folder_pane"]
        });

        if (selectedTags.length === 0) {
          // Menüeintrag "Schlagwort auswählen" wenn keine Tags ausgewählt sind
          messenger.menus.create({
            id: "select_tag",
            parentId: "priomailbox",
            title: trans("selectTagMenu"),
            contexts: ["message_list"],
          });
        } else {
          // Untermenüeintrag für E-Mail-Infos
          messenger.menus.create({
            id: "show_info",
            parentId: "priomailbox",
            title: trans("emailInfoMenu"),
            contexts: ["message_list"],
          });

          // Untermenüeintrag für Klassifizieren
          messenger.menus.create({
            id: "classify",
            parentId: "priomailbox",
            title: trans("classifyMenu"),
            contexts: ["message_list"],
          });

          // Trenner im Menü
          messenger.menus.create({
            id: "separator_top",
            parentId: "priomailbox",
            type: "separator",
            contexts: ["message_list"],
          });

          // Erstelle Menüeinträge für ausgewählte Tags
          selectedTags.forEach((tagName) => {
            const tagKey = tagNameToKeyMap[tagName];
            if (tagKey) {
              // Hauptmenüeintrag für das Schlagwort mit Platzhalter
              messenger.menus.create({
                id: `tag_${tagKey}`,
                parentId: "priomailbox",
                title: trans("trainTagMenu", [tagName]),
                contexts: ["message_list"],
              });

              // Untermenüeintrag: Lerne als [Schlagwort]
              messenger.menus.create({
                id: `learn_${tagKey}`,
                parentId: `tag_${tagKey}`,
                title: trans("learnTagMenu", [tagName]),
                contexts: ["message_list"],
              });

              // Untermenüeintrag: Lerne als nicht [Schlagwort]
              messenger.menus.create({
                id: `unlearn_${tagKey}`,
                parentId: `tag_${tagKey}`,
                title: trans("unlearnTagMenu", [tagName]),
                contexts: ["message_list"],
              });
            }
          });
        }
      });
    })
    .catch((error) => {
      console.error("Error creating context menu:", error);
    });
}




initialize();

messenger.storage.onChanged.addListener((changes, area) => {
  if (area === "local") {
    if (changes.selectedTags) {
      selectedTags = changes.selectedTags.newValue.map(
        (tagKey) => tagKeyToNameMap[tagKey] || tagKey
      );
      // Aktualisiere die Tags und Mappings
      messenger.messages.listTags().then((tags) => {
        allTags = tags;
        tagKeyToNameMap = {};
        tagNameToKeyMap = {};
        allTags.forEach((tag) => {
          tagKeyToNameMap[tag.key] = tag.tag;
          tagNameToKeyMap[tag.tag] = tag.key;
        });
        createContextMenu();
      });
    }
    if (changes.selectedAccounts) {
      selectedAccounts = changes.selectedAccounts.newValue;
    }
    if (changes.threshold) {
      threshold = changes.threshold.newValue / 100;
    }
    if (changes.removeOnClassify) {
      removeOnClassify = changes.removeOnClassify.newValue;
      console.log("RemoveOnClassify updated:", removeOnClassify);
    }
  }
});

messenger.menus.onClicked.addListener((info, tab) => {
  console.log("Menu item clicked:", info.menuItemId);
  console.log("Info object:", info);

  if (info.menuItemId === "classify-folder") {
    if (info.selectedFolder) {
      classifyFolder(info.selectedFolder);
    } else {
      console.error("No folder selected for classification.");
    }
    return;
  }

  if (info.selectedMessages && info.selectedMessages.messages.length > 0) {
    const messageId = info.selectedMessages.messages[0].id;

    if (info.menuItemId === "select_tag") {
      messenger.runtime.openOptionsPage().catch((error) => {
        console.error("Error opening settings page:", error);
      });
      return;
    }

    selectMessage(messageId)
      .then(() => {
        handleMenuClick(info, messageId);
      })
      .catch((error) => {
        console.error("Error selecting message:", error);
      });      
  } else {
    console.log("No message selected. Assuming folder operation.");
  }
});


function handleMenuClick(info, messageId) {
  // Lade die neuesten bayesData bei jedem Klick
  messenger.storage.local
    .get("bayesData")
    .then((result) => {
      bayesData = result.bayesData || {}; // Stelle sicher, dass die neuesten Daten geladen sind

      // Aktualisiere die Tags und Mappings
      messenger.messages.listTags().then((tags) => {
        allTags = tags;
        tagKeyToNameMap = {};
        tagNameToKeyMap = {};
        allTags.forEach((tag) => {
          tagKeyToNameMap[tag.key] = tag.tag;
          tagNameToKeyMap[tag.tag] = tag.key;
        });

        const messages = info.selectedMessages.messages;

        if (info.menuItemId.startsWith("learn_") || info.menuItemId.startsWith("unlearn_")) {
          const isPositive = info.menuItemId.startsWith("learn_");
          const tagKey = info.menuItemId.split("_")[1]; // Extrahiere den tagKey
          const tagName = tagKeyToNameMap[tagKey]; // Hole den korrekten tagName aus der Map

          if (!tagName) {
            console.warn(`No valid tag name for key "${tagKey}" found.`);
            return;
          }

          messages.forEach((message) => {
            learnTagFromMail(message.id, tagName, isPositive);
            const popupMessage = trans(isPositive ? 'trainingCompleteMessage' : 'untrainingCompleteMessage', [tagName]);
            openPopupWithMessage(popupMessage);
          });
        } else if (info.menuItemId === "classify") {
          messages.forEach((message) => {
            classifyEmail(message.id);
          });
          const popupMessage = trans("classificationCompleteMessage");
          openPopupWithMessage(popupMessage);
        } else if (info.menuItemId === "show_info") {
          const messageId = messages[0].id;
          showEMailInfo(messageId);
        }
      });
    })
    .catch((error) => {
      console.error("Error loading bayesData:", error);
    });
}


async function classifyFolder(folder) {
    console.log("classifyFolder executed for", folder);

    let folderToQuery = {
        accountId: folder.accountId,
        path: folder.path
    };

  try {
    let page = await messenger.messages.list(folderToQuery);
    
    while (true) {
        for (let message of page.messages) {
            console.log("Verarbeite Nachricht:", message);
            classifyEmail(message.id);
        }

        if (page.id) {
            page = await messenger.messages.continueList(page.id);
        } else {
            break;
        }
    }
  } catch (error) {
    console.error("Error retrieving messages:", error);
  }
  openPopupWithMessage(trans("classificationCompleteMessage"));
}


function selectMessage(messageId) {
  return messenger.mailTabs
    .setSelectedMessages([messageId])
    .then(() => {
      console.log(`Message with ID ${messageId} selected.`);
    })
    .catch((error) => {
      console.error("Error selecting message:", error);
    });
}

function getMessageTags(messageId) {
  return messenger.messages.get(messageId).then((message) => {
    console.log(`Retrieved tags for message ${messageId}:`, message.tags);
    return message.tags || [];
  });
}

/**
 * workarround to check all new mails
 * Listener function that checks for new emails in the displayed folder and classifies them.
 * On the first visit to a folder, it stores the date of the newest email but does not process any emails.
 * 
 * @param {object} tab - Information about the active tab.
 * @param {object} folder - Information about the displayed folder.
 */

/**
 * Handles the display of a folder and checks for new emails.
 * @param {Object} tab - The mail tab object.
 * @param {Object} folder - The folder object.
 */
async function onFolderDisplayed(tab, folder) {
  const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
  console.debug("onFolderDisplayed")
  if (folder && folder.accountId && folder.path) {
    const accountId = folder.accountId;

    // Check if the account is in the list of selected accounts
    if (!selectedAccounts.includes(accountId)) {
      console.log(`Account ${accountId} is not selected. Skipping folder ${folder.path}.`);
      return;
    }

    try {
      const folderKey = `${accountId}:${folder.path}`;

      // To optimize performance, skip the check if the last one occurred recently.
      const now = Date.now();
      // Check the last time this folder was processed
      const lastCheck = lastCheckTimestamps[folderKey] || 0;
      if (now - lastCheck < CHECK_INTERVAL) {
        return;
      }
      // Update the last check timestamp
      lastCheckTimestamps[folderKey] = now;

      // Load the last processed date for this folder from storage
      let result = await messenger.storage.local.get("folderLastProcessed");
      let folderLastProcessed = result.folderLastProcessed || {};
      let lastProcessedDate = folderLastProcessed[folderKey] ? new Date(folderLastProcessed[folderKey]) : null;

      // Prepare the folder object for messages.list
      const folderToQuery = {
        accountId: folder.accountId,
        path: folder.path,
      };

      // Get messages in the folder, handling pagination
      let page = await messenger.messages.list(folderToQuery);

      if (!lastProcessedDate) {
        // First visit: Store the date of the newest email without processing
        let newestMessageDate = null;

        while (true) {
          if (page.messages && page.messages.length > 0) {
            for (let message of page.messages) {
              let messageDate = new Date(message.date);
              if (!newestMessageDate || messageDate > new Date(newestMessageDate)) {
                newestMessageDate = message.date;
              }
            }
          }

          if (page.id) {
            // Get the next page
            page = await messenger.messages.continueList(page.id);
          } else {
            // No more pages
            break;
          }
        }

        if (newestMessageDate) {
          folderLastProcessed[folderKey] = newestMessageDate;
          await messenger.storage.local.set({ folderLastProcessed });
          console.log(`Initialized last processed date for folder ${folderKey} to ${newestMessageDate}.`);
        } else {
          console.log(`Folder ${folderKey} is empty. No date to store.`);
        }
      } else {
        // Process messages newer than the last processed date
        let newMessages = [];
        // Restart pagination
        page = await messenger.messages.list(folderToQuery);

        while (true) {
          if (page.messages && page.messages.length > 0) {
            for (let message of page.messages) {
              let messageDate = new Date(message.date);
              if (messageDate > lastProcessedDate) {
                newMessages.push(message);
              }
            }
          }

          if (page.id) {
            // Get the next page
            page = await messenger.messages.continueList(page.id);
          } else {
            // No more pages
            break;
          }
        }

        console.log(`Found ${newMessages.length} new messages to classify in folder ${folderKey}.`);

        // Classify new messages
        for (let message of newMessages) {
          await classifyNewEmail(message.id);
        }

        if (newMessages.length > 0) {
          // Update the last processed date with the newest message date
          let newestMessageDate = newMessages.reduce((latest, msg) => {
            return new Date(msg.date) > new Date(latest.date) ? msg : latest;
          }).date;

          folderLastProcessed[folderKey] = newestMessageDate;
          await messenger.storage.local.set({ folderLastProcessed });

          console.log(`Updated last processed date for folder ${folderKey} to ${newestMessageDate}.`);
        }
      }
    } catch (error) {
      console.error("Error processing new emails in folder:", error);
    }
  }
}






// learnTagFromMail Funktion
function learnTagFromMail(messageId, tagName, isPositive) {
  console.log(`Training with message ID: ${messageId} and tag: ${tagName}`);

  const tagKey = tagNameToKeyMap[tagName];

  if (!tagKey) {
    console.warn(`No valid tagKey for tag "${tagName}" found.`);
    return;
  }

  messenger.storage.local
    .get(["bayesData", "tagOnTraining"])
    .then((result) => {
      const tagOnTraining = result.tagOnTraining !== undefined ? result.tagOnTraining : true;
      bayesData = result.bayesData || {};

      bayesData[tagName] = bayesData[tagName] || {
        tokenList: {},
        trainingCount: 0,
        totalPositiveTokens: 0,
        totalNegativeTokens: 0,
        uniquePositiveTokens: 0,
        uniqueNegativeTokens: 0,
        totalUniqueTokens: 0,
      };

      getEmailContent(messageId)
        .then((content) => {
          const tokens = tokenize(content);
          const tokenCounts = {};
          tokens.forEach((token) => {
            tokenCounts[token] = (tokenCounts[token] || 0) + 1;
          });

          for (let token in tokenCounts) {
            tokenCounts[token] = Math.min(tokenCounts[token], 3);
          }

          const uniqueTokens = Object.keys(tokenCounts);

          const probabilityData = calculateBayesProbability(tokens, bayesData[tagName]);
          const probabilityBefore = probabilityData.probability;

          const knownTokenData = getKnownTokenPercentage(tokens, bayesData[tagName].tokenList);

          if (knownTokenData.knownPercentage === 100) {
            console.log("Aborting: mail already trained (all tokens known).");
            return;
          }

          if (
            isPositive &&
            probabilityBefore > 0.9999 &&
            knownTokenData.knownPercentage >= 90
          ) {
            console.log("Overfitting stop: Probability already > 99.99% and over 90% tokens known.");
            return;
          } else if (
            !isPositive &&
            probabilityBefore < 0.0001 &&
            knownTokenData.knownPercentage >= 90
          ) {
            console.log("Overfitting stop: Probability already < 0.01% and over 90% tokens known.");
            return;
          }

          bayesData[tagName].trainingCount++;

          uniqueTokens.forEach((token) => {
            const tokenCountInMail = tokenCounts[token];

            if (!bayesData[tagName].tokenList[token]) {
              bayesData[tagName].tokenList[token] = [0, 0, 0, 0, 0, 0, 0];
            }

            if (isPositive) {
              bayesData[tagName].tokenList[token][0] += tokenCountInMail; // positiveCount
              bayesData[tagName].tokenList[token][4] += 1; // positiveTrainCount
            } else {
              bayesData[tagName].tokenList[token][1] += tokenCountInMail; // negativeCount
              bayesData[tagName].tokenList[token][5] += 1; // negativeTrainCount
            }

            bayesData[tagName].tokenList[token][6] = bayesData[tagName].trainingCount;
          });

          uniqueTokens.forEach((token) => {
            if (isPositive) {
              bayesData[tagName].tokenList[token][2] += 1; // positiveMailCount
            } else {
              bayesData[tagName].tokenList[token][3] += 1; // negativeMailCount
            }
          });

          updateTokenCounts(tagName, bayesData);

          if (
            bayesData[tagName].totalUniqueTokens > maxTokenCount ||
            bayesData[tagName].trainingCount % 10 === 0
          ) {
            optimizeTokenData(tagName, maxTokenCount);
          }

          if (tagOnTraining) {
            getMessageTags(messageId)
              .then((currentTags) => {
                let updatedTags;
                if (isPositive) {
                  updatedTags = Array.from(new Set([...currentTags, tagKey]));
                } else {
                  updatedTags = currentTags.filter((key) => key !== tagKey);
                }

                messenger.messages
                  .update(messageId, { tags: updatedTags })
                  .then(() => {
                    console.log(`Tag "${tagName}" ${isPositive ? "added to" : "removed from"} the email.`);
                  })
                  .catch((error) => {
                    console.error(`Error updating tag "${tagName}":`, error);
                  });
              })
              .catch((error) => {
                console.error(`Error retrieving tags for message ${messageId}:`, error);
              });
          }

          messenger.storage.local
            .set({ bayesData })
            .then(() => {
              const probabilityAfter = calculateBayesProbability(tokens, bayesData[tagName]).probability;
              const trainingResult = isPositive ? `als ${tagName}` : `als NICHT ${tagName}`;
              console.log(
                `Mail wurde ${trainingResult} trainiert. (Vorher -> Nachher: ${(probabilityBefore * 100).toFixed(2)}% -> ${(probabilityAfter * 100).toFixed(2)}%)`
              );
            })
            .catch((error) => {
              console.error("Error saving bayesData:", error);
            });
        })
        .catch((error) => {
          console.error("Error retrieving email content:", error);
        });
    })
    .catch((error) => {
      console.error("Error loading bayesData:", error);
    });
}





// classifyEmail Funktion
function classifyEmail(messageId) {
  console.log(`Classifying message with ID: ${messageId}`);
  getEmailContent(messageId)
    .then((content) => {
      const tokens = tokenize(content);
      let tagsToAdd = [];
      let tagsToRemove = [];

      selectedTags.forEach((tagName) => {
        const tagKey = tagNameToKeyMap[tagName];
        if (tagKey && bayesData[tagName]) {
          const probabilityData = calculateBayesProbability(tokens, bayesData[tagName]);
          const probability = probabilityData.probability;
          console.log(`Probability for ${tagName}: ${(probability * 100).toFixed(2)}%`);

          if (probability >= threshold) {
            tagsToAdd.push(tagKey);
          } else {
            if (removeOnClassify) {
              tagsToRemove.push(tagKey);
            }
          }
        }
      });

      getMessageTags(messageId)
        .then((currentTags) => {
          let updatedTags = new Set(currentTags);

          tagsToAdd.forEach((tagKey) => updatedTags.add(tagKey));
          tagsToRemove.forEach((tagKey) => updatedTags.delete(tagKey));

          updatedTags = Array.from(updatedTags);

          if (tagsToAdd.length > 0 || tagsToRemove.length > 0) {
            messenger.messages
              .update(messageId, { tags: updatedTags })
              .then(() => {
                if (tagsToAdd.length > 0) {
                  const addedTagNames = tagsToAdd.map((key) => tagKeyToNameMap[key]);
                  console.log("Tags added:", addedTagNames);
                }
                if (tagsToRemove.length > 0) {
                  const removedTagNames = tagsToRemove.map((key) => tagKeyToNameMap[key]);
                  console.log("Tags removed:", removedTagNames);
                }
              })
              .catch((error) => {
                console.error("Error updating tags:", error);
              });
          } else {
            console.log("No tag changes required.");
          }
        })
        .catch((error) => {
          console.error(`Error retrieving tags for message ${messageId}:`, error);
        });
    })
    .catch((error) => {
      console.error("Error classifying email:", error);
    });
}



function classifyNewEmail(messageId) {
  getEmailContent(messageId)
    .then((content) => {
      const tokens = tokenize(content);
      let tagsToAdd = [];

      selectedTags.forEach((tagName) => {
        const tagKey = tagNameToKeyMap[tagName];
        if (tagKey && bayesData[tagName]) {
          const probabilityData = calculateBayesProbability(tokens, bayesData[tagName]);
          const probability = probabilityData.probability;
          console.log(`Probability for ${tagName}: ${(probability * 100).toFixed(2)}%`);

          if (probability >= threshold) {
            tagsToAdd.push(tagKey);
          }
        }
      });

      if (tagsToAdd.length > 0) {
        getMessageTags(messageId)
          .then((currentTags) => {
            const updatedTags = Array.from(new Set([...currentTags, ...tagsToAdd]));
            messenger.messages
              .update(messageId, { tags: updatedTags })
              .then(() => {
                console.log(
                  "Tags added:",
                  tagsToAdd.map((key) => tagKeyToNameMap[key])
                );
              })
              .catch((error) => {
                console.error("Error adding tags:", error);
              });
          })
          .catch((error) => {
            console.error(`Error retrieving tags for message ${messageId}:`, error);
          });
      } else {
        console.log("No tags added.");
      }
    })
    .catch((error) => {
      console.error("Error classifying new email:", error);
    });
}



function onNewMailReceived(folder, messages) {
  const accountId = folder.accountId;
  if (selectedAccounts.includes(accountId)) {
    console.log(`New Mail Received: ${messages.messages.length} new message(s).`);
    messages.messages.forEach((message) => {
      classifyNewEmail(message.id);
    });
  }
}


/**
 * Displays Bayes information for a specific email message.
 * @param {string} messageId - The ID of the email message.
 */
function showEMailInfo(messageId) {
  console.log(`Displaying Bayes info for message ID: ${messageId}`);

  getEmailContent(messageId)
    .then((content) => {
      const tokens = tokenize(content);

      let probabilities = [];

      selectedTags.forEach((tagName) => {
        const tagKey = tagNameToKeyMap[tagName];
        if (tagKey && bayesData[tagName]) {
          const probabilityData = calculateBayesProbability(
            tokens,
            bayesData[tagName],
            true
          );
          const probability = probabilityData.probability;
          const tokenContributions = probabilityData.tokenContributions;

          // Berechnung des bekannten Token-Prozentsatzes
          let knownUnigramsPercentage = 0;
          let knownBigramsPercentage = 0;
          if (bayesData[tagName].tokenList) {
            // Verwende die neue Funktion calculateKnownTokenTypesPercentage
            const knownTokenData = calculateKnownTokenTypesPercentage(tokens, bayesData[tagName].tokenList);
            knownUnigramsPercentage = knownTokenData.knownUnigramsPercentage;
            knownBigramsPercentage = knownTokenData.knownBigramsPercentage;
          }

          probabilities.push({
            tag: tagName,
            tagKey: tagKey,
            probability: (probability * 100).toFixed(2),
            tokenContributions: tokenContributions,
            knownUnigramsPercentage: knownUnigramsPercentage.toFixed(2),
            knownBigramsPercentage: knownBigramsPercentage.toFixed(2)
          });

          console.log(
            `Probability for ${tagName}: ${(probability * 100).toFixed(2)}%`
          );
          console.log(`Known Unigrams/Bigrams for ${tagName}: ${knownUnigramsPercentage.toFixed(2)}% / ${knownBigramsPercentage.toFixed(2)}%`);

        }
      });

      messenger.storage.local
        .set({ bayesInfoData: probabilities })
        .then(() => {
          console.log("Bayes info data saved.");
          messenger.windows
            .create({
              url: "email_info.html",
              type: "popup",
              width: 600,
              height: 400,
            })
            .catch((error) => {
              console.error("Error opening Bayes info popup:", error);
            });
        })
        .catch((error) => {
          console.error("Error saving Bayes info data:", error);
        });
    })
    .catch((error) => {
      console.error("Error displaying Bayes info:", error);
    });
}


messenger.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "refreshBayesData") {
    messenger.storage.local
      .get("bayesData")
      .then((result) => {
        bayesData = result.bayesData || {};
        console.log("Bayes data successfully reloaded:", bayesData);

        // Aktualisiere die Tags und Mappings
        messenger.messages.listTags().then((tags) => {
          allTags = tags;
          tagKeyToNameMap = {};
          tagNameToKeyMap = {};
          allTags.forEach((tag) => {
            tagKeyToNameMap[tag.key] = tag.tag;
            tagNameToKeyMap[tag.tag] = tag.key;
          });
          createContextMenu();
        });
      })
      .catch((error) => {
        console.error("Error reloading bayesData:", error);
      });
  }

  if (message.action === "updateContextMenu") {
    messenger.storage.local
      .get(["selectedTags", "selectedAccounts"])
      .then((result) => {
        selectedTags = result.selectedTags || [];
        selectedTags = selectedTags.map(
          (tagKey) => tagKeyToNameMap[tagKey] || tagKey
        );
        selectedAccounts = result.selectedAccounts || [];

        // Aktualisiere die Tags und Mappings
        messenger.messages.listTags().then((tags) => {
          allTags = tags;
          tagKeyToNameMap = {};
          tagNameToKeyMap = {};
          allTags.forEach((tag) => {
            tagKeyToNameMap[tag.key] = tag.tag;
            tagNameToKeyMap[tag.tag] = tag.key;
          });
          createContextMenu();
        });
      })
      .catch((error) => {
        console.error("Error updating context menu:", error);
      });
  }

  if (message.action === "updateThreshold") {
    threshold = message.threshold / 100;
    console.log("Threshold updated to:", threshold);
  }

  if (message.action === "updateRemoveOnClassify") {
    removeOnClassify = message.removeOnClassify;
    console.log("RemoveOnClassify updated to:", removeOnClassify);
  }

  if (message.action === "openUrlInSystemBrowser" && message.url) {
    messenger.windows.openDefaultBrowser(message.url);
  }
});
