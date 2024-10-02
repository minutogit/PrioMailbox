// bayes.js

/**
 * Berechnet die Bayes-Wahrscheinlichkeit für einen Satz von Tokens und ein bestimmtes Tag.
 *
 * @param {Array<string>} tokens - Die Tokens des zu klassifizierenden Textes.
 * @param {Object} data - Die Bayes-Datenstruktur für das spezifische Tag.
 * @param {boolean} [returnTokenContributions=false] - Gibt an, ob die Beiträge der einzelnen Tokens zurückgegeben werden sollen.
 * @param {number} [topN=100] - Die Anzahl der Top-Tokens, die berücksichtigt werden sollen.
 * @returns {Object} Die berechnete Wahrscheinlichkeit und optional die Token-Beiträge.
 */
function calculateBayesProbability(tokens, data, returnTokenContributions = false, topN = 100) {
  
  // Einstellungen:
  const smoothingFactor = 0.0001; // Laplace-Glättung: Vermeidet Null-Wahrscheinlichkeiten und mögliche NaN-Fehler.
  const discriminationStrength = 1; // Kontrolliert die Diskriminationskraft: Höhere Werte verstärken den Unterschied zwischen den Klassen.
  const enableLinearNormalization = true; // Wenn true, werden Wahrscheinlichkeiten basierend auf der Anzahl der Mails, in denen der Token vorkam, skaliert.

  // Überprüfen, ob Trainingsdaten vorhanden sind
  if (!data || !data.tokenList) {
    console.log("No data available. Returning default probability of 50%.");
    return { probability: 0.5, tokenContributions: [] }; // Standardwert, wenn keine Daten vorhanden sind
  }

  // Verwende die bereits in bayesData berechneten Zähler
  const totalPositiveTokens = data.totalPositiveTokens || 0;
  const totalNegativeTokens = data.totalNegativeTokens || 0;
  const totalUniqueTokens = data.totalUniqueTokens || 0;
  const totalUniquePositiveTokens = data.uniquePositiveTokens || 0;
  const totalUniqueNegativeTokens = data.uniqueNegativeTokens || 0;

  // Logarithmische Wahrscheinlichkeiten für positive und negative Klassen initialisieren
  let logProbPositive = Math.log(0.5);
  let logProbNegative = Math.log(0.5);

  // Token-Beiträge initialisieren, wenn erforderlich
  let tokenContributions = [];

  const tokenSet = new Set(tokens); // Set für schnelle Überprüfung, ob ein Token im Eingabedokument vorhanden ist
  const vocabulary = new Set(Object.keys(data.tokenList)); // Verwende tokenList für das Vokabular

  console.log("Vocabulary size:", totalUniqueTokens, " - Total Pos/Neg Tokens:", totalUniquePositiveTokens, "/", totalUniqueNegativeTokens);

  // Durch das gesamte Vokabular iterieren
  vocabulary.forEach((token) => {
    const tokenData = data.tokenList[token] || [0, 0, 0, 0, 0, 0, 0]; // Standardwerte für das Token, falls es nicht existiert
    const positiveCount = tokenData[0]; // positiveCount (Index 0)
    const negativeCount = tokenData[1]; // negativeCount (Index 1)
    const positiveMailCount = tokenData[2]; // positiveMailCount (Index 2)
    const negativeMailCount = tokenData[3]; // negativeMailCount (Index 3)
    const positiveTrainCount = tokenData[4] || 1; // positiveTrainCount (Index 4)
    const negativeTrainCount = tokenData[5] || 1; // negativeTrainCount (Index 5)

    // Token-Zählungen unter Hinzufügung des Glättungsfaktors
    const tokenPositiveCount = positiveCount + smoothingFactor;
    const tokenNegativeCount = negativeCount + smoothingFactor;

    // Berechnung der normalisierten Wahrscheinlichkeiten basierend auf der Option zur linearen Normierung
    const normalizedPositiveProb = enableLinearNormalization ? 
      (tokenPositiveCount / (totalPositiveTokens + totalUniqueTokens)) * (positiveMailCount / positiveTrainCount) :
      tokenPositiveCount / (totalPositiveTokens + totalUniqueTokens);

    const normalizedNegativeProb = enableLinearNormalization ? 
      (tokenNegativeCount / (totalNegativeTokens + totalUniqueTokens)) * (negativeMailCount / negativeTrainCount) :
      tokenNegativeCount / (totalNegativeTokens + totalUniqueTokens);

    // Diskriminationskraft basierend auf der Differenz der Mail-Häufigkeiten
    const discriminationFactor = discriminationStrength * Math.abs(
      (positiveMailCount / positiveTrainCount) - (negativeMailCount / negativeTrainCount)
    );

    // Diskriminationskraft auf die Wahrscheinlichkeiten anwenden
    const weightedPositiveProb = normalizedPositiveProb * (1 + discriminationFactor);
    const weightedNegativeProb = normalizedNegativeProb * (1 + discriminationFactor);

    // Sicherstellen, dass Wahrscheinlichkeiten nicht zu klein werden
    const safePositiveProb = Math.max(weightedPositiveProb, smoothingFactor);
    const safeNegativeProb = Math.max(weightedNegativeProb, smoothingFactor);

    // Prüfen, ob der Token im Eingabedokument vorhanden ist
    const isPresent = tokenSet.has(token);

    if (isPresent) {
      logProbPositive += Math.log(safePositiveProb);
      logProbNegative += Math.log(safeNegativeProb);

      // Berechne die Odds und die per-Token-Wahrscheinlichkeit
      const tokenOdds = safePositiveProb / safeNegativeProb;
      const tokenProbability = tokenOdds / (1 + tokenOdds);

      // Token-Beiträge hinzufügen, falls erforderlich
      if (returnTokenContributions) {
        const contributionValue = Math.log(safePositiveProb) - Math.log(safeNegativeProb);
        tokenContributions.push({
          token: token,
          contribution: contributionValue,
          tokenProbability: tokenProbability, // Neue Eigenschaft hinzugefügt
          tokenPositiveCount: tokenPositiveCount - smoothingFactor,
          tokenNegativeCount: tokenNegativeCount - smoothingFactor,
          tokenPositiveProb: safePositiveProb,
          tokenNegativeProb: safeNegativeProb,
          isPresent: true
        });
      }
    } else {
      logProbPositive += Math.log(1 - safePositiveProb);
      logProbNegative += Math.log(1 - safeNegativeProb);

      // Berechne die Odds und die per-Token-Wahrscheinlichkeit
      const tokenOdds = (1 - safePositiveProb) / (1 - safeNegativeProb);
      const tokenProbability = tokenOdds / (1 + tokenOdds);

      // Token-Beiträge für nicht vorhandene Tokens
      if (returnTokenContributions) {
        const contributionValue = Math.log(1 - safePositiveProb) - Math.log(1 - safeNegativeProb);
        tokenContributions.push({
          token: token,
          contribution: contributionValue,
          tokenProbability: tokenProbability, // Neue Eigenschaft hinzugefügt
          tokenPositiveCount: tokenPositiveCount - smoothingFactor,
          tokenNegativeCount: tokenNegativeCount - smoothingFactor,
          tokenPositiveProb: safePositiveProb,
          tokenNegativeProb: safeNegativeProb,
          isPresent: false
        });
      }
    }
  });

  // Normalisierung der Wahrscheinlichkeiten durch Log-Summe-Exponentielle
  const maxLogProb = Math.max(logProbPositive, logProbNegative);
  const logSumExp = maxLogProb + Math.log(
    Math.exp(logProbPositive - maxLogProb) + Math.exp(logProbNegative - maxLogProb)
  );

  const probability = Math.exp(logProbPositive - logSumExp); // Normalisierte positive Wahrscheinlichkeit

  console.log("Calculated probability:", probability);

  // Rückgabe der Token-Beiträge, falls aktiviert
  if (returnTokenContributions) {
    const uniqueTokens = [];
    const seenTokens = new Set();

    tokenContributions.forEach((contribution) => {
      if (!seenTokens.has(contribution.token)) {
        seenTokens.add(contribution.token);
        uniqueTokens.push(contribution);
      }
    });

    return { probability, tokenContributions: uniqueTokens };
  } else {
    return { probability };
  }
}
