// utils.js

/**
 * Aktualisiert die Token-Zählungen für ein bestimmtes Tag.
 * - Berechnet die Gesamtanzahl der einzigartigen Tokens.
 * - Berechnet die Gesamtzahl der positiven und negativen Tokens.
 * - Berechnet die Anzahl der einzigartigen positiven und negativen Tokens.
 *
 * @param {string} tagName - Der Name des Tags, dessen Tokens aktualisiert werden sollen.
 * @param {Object} bayesData - Die Bayes-Datenstruktur.
 */
function updateTokenCounts(tagName, bayesData) {
  const tokenList = bayesData[tagName].tokenList;

  // Berechnung der Gesamtanzahl der unterschiedlichen Tokens (einzigartig)
  const totalUniqueTokens = Object.keys(tokenList).length;

  // Berechnung der Gesamtzahl der Tokens in den positiven und negativen Trainingsdaten (Summe)
  const totalPositiveTokens = Object.values(tokenList).reduce((sum, counts) => sum + counts[0], 0); // Summe der positiveCounts (Index 0)
  const totalNegativeTokens = Object.values(tokenList).reduce((sum, counts) => sum + counts[1], 0); // Summe der negativeCounts (Index 1)

  // Berechnung der Anzahl der positiven Tokens (Tokens mit positiveCount > 0)
  const totalUniquePositiveTokens = Object.values(tokenList).filter(counts => counts[0] > 0).length;

  // Berechnung der Anzahl der negativen Tokens (Tokens mit negativeCount > 0)
  const totalUniqueNegativeTokens = Object.values(tokenList).filter(counts => counts[1] > 0).length;

  // Update der berechneten Werte in der Datenbank
  bayesData[tagName].totalPositiveTokens = totalPositiveTokens;
  bayesData[tagName].totalNegativeTokens = totalNegativeTokens;
  bayesData[tagName].uniquePositiveTokens = totalUniquePositiveTokens;
  bayesData[tagName].uniqueNegativeTokens = totalUniqueNegativeTokens;
  bayesData[tagName].totalUniqueTokens = totalUniqueTokens;
}

/**
 * Gibt den prozentualen Anteil der bekannten Tokens einer Mail im Vergleich zur tokenList zurück,
 * wobei Duplikate in den Tokens entfernt werden.
 * @param {Array} tokens - Liste der Tokens in der Mail.
 * @param {Object} tokenList - Die bestehende Token-Datenbank für ein bestimmtes Tag (Schlagwort).
 * @returns {Object} - Ein Objekt mit dem Prozentanteil der bekannten Tokens.
 */
function getKnownTokenPercentage(tokens, tokenList) {
  // Duplikate in den Tokens entfernen
  const uniqueTokens = [...new Set(tokens)];

  let knownTokens = 0;
  let unknownTokens = 0;

  uniqueTokens.forEach(token => {
    if (tokenList[token]) {
      knownTokens++;
    } else {
      unknownTokens++;
    }
  });

  const totalTokens = uniqueTokens.length;
  const knownPercentage = totalTokens > 0 ? (knownTokens / totalTokens) * 100 : 0;

  console.log(`Known tokens: ${knownPercentage.toFixed(2)}%  Known: ${knownTokens}, Unknown: ${unknownTokens}`);

  return { knownPercentage };
}


/**
 * Calculates the percentage of known unigrams and bigrams in an email compared to the tokenList,
 * with duplicates removed from the tokens.
 * A token is considered a unigram if it does not contain an underscore "_",
 * and a bigram if it contains an underscore "_".
 *
 * @param {Array} tokens - List of tokens in the email.
 * @param {Object} tokenList - The existing token database for a specific tag (keyword).
 * @returns {Object} - An object with the percentage of known unigrams and bigrams.
 */
function calculateKnownTokenTypesPercentage(tokens, tokenList) {
  // Remove duplicates from the tokens
  const uniqueTokens = new Set(tokens);

  // Initialize counters
  let knownUnigrams = 0;
  let totalUnigrams = 0;
  let knownBigrams = 0;
  let totalBigrams = 0;

  // Iterate through each unique token once
  uniqueTokens.forEach(token => {
      if (token.includes('_')) {
          // It's a bigram
          totalBigrams++;
          if (tokenList[token]) {
              knownBigrams++;
          }
      } else {
          // It's a unigram
          totalUnigrams++;
          if (tokenList[token]) {
              knownUnigrams++;
          }
      }
  });

  // Calculate percentages
  const knownUnigramsPercentage = totalUnigrams > 0 ? (knownUnigrams / totalUnigrams) * 100 : 0;
  const knownBigramsPercentage = totalBigrams > 0 ? (knownBigrams / totalBigrams) * 100 : 0;

  // Log the results for debugging
  console.log(`Known unigrams: ${knownUnigramsPercentage.toFixed(2)}% (Known: ${knownUnigrams}, Total: ${totalUnigrams})`);
  console.log(`Known bigrams: ${knownBigramsPercentage.toFixed(2)}% (Known: ${knownBigrams}, Total: ${totalBigrams})`);

  // Return the percentages
  return { 
      knownUnigramsPercentage,
      knownBigramsPercentage
  };
}