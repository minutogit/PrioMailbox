let selectedTags = [];
let bayesData = {};
let allTags = [];
let selectedAccounts = [];
let threshold = 0.99; // Standardwert 0.99 (99%)
let removeOnClassify = true; // Standardwert true
const maxTokenCount = 10000; // Maximale Anzahl der Tokens in der Datenbank.
let tagKeyToNameMap = {}; // Mapping von Tag-Key zu Tag-Name
let tagNameToKeyMap = {}; // Mapping von Tag-Name zu Tag-Key

// translate-Funktion zur Nutzung von i18n
function trans(messageName, placeholders = []) {
  const message = messenger.i18n.getMessage(messageName, placeholders);

  if (!message) {
    console.warn(`No translation found for key "${messageName}"`);
    return messageName; // Fallback auf den Schlüssel, wenn keine Übersetzung gefunden wurde
  }

  return message;
}


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
      // Hauptmenüeintrag für PrioMailbox
      messenger.menus.create({
        id: "priomailbox",
        title: "PrioMailbox",
        contexts: ["message_list"],
      });

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
      createContextMenu();
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
  if (info.selectedMessages && info.selectedMessages.messages.length > 0) {
    const messageId = info.selectedMessages.messages[0].id;
    selectMessage(messageId)
      .then(() => {
        handleMenuClick(info, messageId);
      })
      .catch((error) => {
        console.error("Error selecting message:", error);
      });
  } else {
    console.error("No message selected.");
  }
});

function handleMenuClick(info, messageId) {
  // Lade die neuesten bayesData bei jedem Klick
  messenger.storage.local
    .get("bayesData")
    .then((result) => {
      bayesData = result.bayesData || {}; // Stelle sicher, dass die neuesten Daten geladen sind

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
    })
    .catch((error) => {
      console.error("Error loading bayesData:", error);
    });
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
  return messenger.messages.get(messageId).then((message) => message.tags || []);
}

function learnTagFromMail(messageId, tagName, isPositive) {
  console.log(
    `Training with message ID: ${messageId} and tag: ${tagName}`
  );

  const tagKey = tagNameToKeyMap[tagName];

  if (!tagKey) {
    console.warn(`No valid tagKey for tag "${tagName}" found.`);
    return;
  }

  messenger.storage.local
    .get(["bayesData", "tagOnTraining"])
    .then((result) => {
      const tagOnTraining =
        result.tagOnTraining !== undefined ? result.tagOnTraining : true;
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

          const probabilityData = calculateBayesProbability(
            tokens,
            bayesData[tagName]
          );
          const probabilityBefore = probabilityData.probability;

          const knownTokenData = getKnownTokenPercentage(
            tokens,
            bayesData[tagName].tokenList
          );

          if (knownTokenData.knownPercentage === 100) {
            console.log("Aborting: mail already trained (all tokens known).");
            return;
          }

          if (
            isPositive &&
            probabilityBefore > 0.9999 &&
            knownTokenData.knownPercentage >= 90
          ) {
            console.log(
              "Overfitting stop: Probability already > 99.99% and over 90% tokens known."
            );
            return;
          } else if (
            !isPositive &&
            probabilityBefore < 0.0001 &&
            knownTokenData.knownPercentage >= 90
          ) {
            console.log(
              "Overfitting stop: Probability already < 0.01% and over 90% tokens known."
            );
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

            bayesData[tagName].tokenList[token][6] =
              bayesData[tagName].trainingCount;
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
                if (isPositive) {
                  const updatedTags = Array.from(
                    new Set([...currentTags, tagKey])
                  );
                  messenger.messages
                    .update(messageId, {
                      tags: updatedTags,
                    })
                    .then(() => {
                      console.log(`Tag "${tagName}" added to the email.`);
                    })
                    .catch((error) => {
                      console.error(`Error adding tag "${tagName}":`, error);
                    });
                } else {
                  const updatedTags = currentTags.filter(
                    (key) => key !== tagKey
                  );
                  messenger.messages
                    .update(messageId, {
                      tags: updatedTags,
                    })
                    .then(() => {
                      console.log(`Tag "${tagName}" removed from the email.`);
                    })
                    .catch((error) => {
                      console.error(
                        `Error removing tag "${tagName}":`,
                        error
                      );
                    });
                }
              })
              .catch((error) => {
                console.error(
                  `Error retrieving tags for message ${messageId}:`,
                  error
                );
              });
          }

          messenger.storage.local
            .set({ bayesData })
            .then(() => {
              const probabilityAfter = calculateBayesProbability(
                tokens,
                bayesData[tagName]
              ).probability;
              const trainingResult = isPositive
                ? `as ${tagName}`
                : `as NOT ${tagName}`;
              console.log(
                `Mail trained ${trainingResult}. (Before -> After Training: ${(
                  probabilityBefore * 100
                ).toFixed(2)}% -> ${(
                  probabilityAfter * 100
                ).toFixed(2)}%)`
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
          const probabilityData = calculateBayesProbability(
            tokens,
            bayesData[tagName]
          );
          const probability = probabilityData.probability;
          console.log(
            `Probability for ${tagName}: ${(probability * 100).toFixed(2)}%`
          );

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
                  const addedTagNames = tagsToAdd.map(
                    (key) => tagKeyToNameMap[key]
                  );
                  console.log("Tags added:", addedTagNames);
                }
                if (tagsToRemove.length > 0) {
                  const removedTagNames = tagsToRemove.map(
                    (key) => tagKeyToNameMap[key]
                  );
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
          console.error(
            `Error retrieving tags for message ${messageId}:`,
            error
          );
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
          const probabilityData = calculateBayesProbability(
            tokens,
            bayesData[tagName]
          );
          const probability = probabilityData.probability;
          console.log(
            `Probability for ${tagName}: ${(probability * 100).toFixed(2)}%`
          );

          if (probability >= threshold) {
            tagsToAdd.push(tagKey);
          }
        }
      });

      if (tagsToAdd.length > 0) {
        getMessageTags(messageId)
          .then((currentTags) => {
            const updatedTags = Array.from(
              new Set([...currentTags, ...tagsToAdd])
            );
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
            console.error(
              `Error retrieving tags for message ${messageId}:`,
              error
            );
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
    messages.messages.forEach((message) => {
      classifyNewEmail(message.id);
    });
  }
}

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
          let knownPercentage = 0;
          if (bayesData[tagName].tokenList) {
            const knownTokenData = getKnownTokenPercentage(tokens, bayesData[tagName].tokenList);
            knownPercentage = knownTokenData.knownPercentage;
          }

          probabilities.push({
            tag: tagName,
            tagKey: tagKey,
            probability: (probability * 100).toFixed(2),
            tokenContributions: tokenContributions,
            knownTokenPercentage: knownPercentage.toFixed(2) 
          });

          console.log(
            `Probability for ${tagName}: ${(probability * 100).toFixed(2)}%`
          );
          console.log(
            `Known Token Percentage for ${tagName}: ${knownPercentage.toFixed(2)}%`
          );
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

        createContextMenu();
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
        createContextMenu();
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
});
