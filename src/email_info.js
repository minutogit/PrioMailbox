function trans(messageName, placeholders = {}) {
  const message = messenger.i18n.getMessage(messageName, Object.values(placeholders));

  if (!message) {
    console.warn(`No translation found for key "${messageName}".`);
    return messageName; // Fallback auf den Schlüssel, wenn keine Übersetzung gefunden wurde
  }

  return message;
}

document.addEventListener("DOMContentLoaded", () => {
  // Informationen sofort anzeigen
  displayEmailInfo();
});


function displayEmailInfo() {
  const tableBody = document.getElementById("probabilities-table");

  let tagKeyToNameMap = {};
  let tagNameToKeyMap = {};
  // Set translated texts using the trans function
  document.getElementById('email-info-title').textContent = trans("emailinfo_title");
  document.getElementById('emailinfo_label_tag').textContent = trans("emailinfo_label_tag");
  document.getElementById('emailinfo_label_probability').textContent = trans("emailinfo_label_probability");
  document.getElementById('emailinfo_label_known_tokens').textContent = trans("emailinfo_label_known_tokens");

  // Donation Link
  const donationLink = document.getElementById("donation-link");
  donationLink.textContent = trans("settings_donation_title");
  donationLink.addEventListener("click", (event) => {
    event.preventDefault();
    const donationUrl = "https://priomailbox.sebastiangalek.de/donate/donation.html"; 
    messenger.runtime.sendMessage({
        action: "openUrlInSystemBrowser",
        url: donationUrl
    });
  });

  Promise.all([
    messenger.storage.local.get(["bayesInfoData", "bayesData"]),
    messenger.messages.listTags()
  ]).then(([result, tags]) => {
    const probabilities = result.bayesInfoData || [];
    const bayesData = result.bayesData || {};

    // Create mappings from Tag-Key to Tag-Name and vice versa
    tags.forEach((tag) => {
      tagKeyToNameMap[tag.key] = tag.tag;
      tagNameToKeyMap[tag.tag] = tag.key;
    });

    probabilities.forEach((item) => {
      const row = document.createElement("tr");

      // Tag Cell
      const tagCell = document.createElement("td");
      tagCell.textContent = item.tag;
      row.appendChild(tagCell);

      // Probability Cell
      const probCell = document.createElement("td");
      if (!bayesData[item.tag]) {
        probCell.textContent = "50%";
      } else if (!bayesData[item.tag].trainingCount) {
        probCell.textContent = "50%";
      } else {
        probCell.textContent = item.probability + "%";
      }
      row.appendChild(probCell);

      // Known Tokens Percentage Cell (Unigrams / Bigrams)
      const knownTokensCell = document.createElement("td");
      if (item.knownUnigramsPercentage !== undefined && item.knownBigramsPercentage !== undefined) {
        knownTokensCell.textContent = `${item.knownUnigramsPercentage}% / ${item.knownBigramsPercentage}%`;
      } else {
        knownTokensCell.textContent = "0.00% / 0.00%"; // Fallback if percentages are not defined
      }
      row.appendChild(knownTokensCell);

      tableBody.appendChild(row);
    });

    // Remove bayesInfoData after display
    messenger.storage.local.remove(["bayesInfoData"]);

    // Adjust window size after loading content
    adjustWindowSize();
  }).catch((error) => {
    console.error("Error loading Bayes info data:", error);
  });
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