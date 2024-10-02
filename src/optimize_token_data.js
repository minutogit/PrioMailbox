/**
 * Optimiert die Tokens für einen bestimmten Tag (Schlagwort).
 * - Entfernt seltene Tokens, die nur einmal aufgetreten sind und seit 
 *   mehr als einer bestimmten Anzahl an Trainingszyklen (RareTokenSumInactivityThreshold) nicht mehr vorkamen.
 * - Entfernt Token die nur einmal in einer Mail aufgetreten sind und seit 
 *   mehr als einer bestimmten Anzahl an Trainingszyklen (RareTokenMailInactivityThreshold) nicht mehr vorkamen.
 * - Überprüft, ob die Tokenanzahl das Maximum überschreitet, und löst gegebenenfalls eine Schrumpfung aus.
 * - Wenn nicht geschrumpft wurde, werden Tokenzähler von Token halbiert die sehr Häufig vorkommen halbiert um den Einfluss dieser Token zu reduzieren.
 *
 * @param {string} tagName - Der Name des zu optimierenden Tags.
 * @param {number} maxTokenCount - Maximale Anzahl an Tokens.
 */
function optimizeTokenData(tagName, maxTokenCount) {
  console.log(`Checking for optimization of token data for tag: ${tagName}`);
  // wenn Token das letzte mal vor über inactiveTokenThreshold Trainings aufgetaucht sind und insgesamt der Token über alle Mails nur einmal aufgetaucht ist, wird dieser Token gelöscht
  const RareTokenSumInactivityThreshold = 30;   
  const RareTokenMailInactivityThreshold = 60; // (Schwellwert für Token die nur ein einziges Mal in einer Mail aufgetaucht sind)
  
  // Schwellwert für die Häufigkeit eines Token ab dem die Zähler halbiert werden, damit der Einfluss des Token auf die Wahrscheinlichkeit nicht zu stark wird
  const frequentTokenSumThreshold = 50;  // Schwellwert für die Häufigkeit eines Token ab dem die Zähler halbiert werden, damit der Einfluss des Token auf die Wahscheinlichkeit nicht zu stark wird

  const data = bayesData[tagName];
  if (!data) {
    console.warn(`No Bayes data found for tag "${tagName}". Optimization skipped.`);
    return;
  }

  let removedTokens = 0;
  const trainingCycles = data.trainingCount || 0;

  console.log(`Starting optimization for "${tagName}" with ${data.totalUniqueTokens} tokens.`);

  // Iteriere über alle Tokens in tokenList
  for (let token in data.tokenList) {
    const tokenData = data.tokenList[token];
    const totalOccurrences = tokenData[0] + tokenData[1]; // Häufigkeit des tokens in allen Trainierten Mails
    const totalMailOccurrences = tokenData[2] + tokenData[3]; // Anzahl in wie vielen trainierten Mails der Token mindestens einmal vorgekommen ist

    const trainingsSinceLastOccurrence = trainingCycles - tokenData[6]; // vor wie vielen Trainings tauchte der Token auf

    // Entferne seltene Tokens, die nur einmal in allen Mails aufgetaucht sind und lange nicht trainiert wurden
    if (totalOccurrences <= 1 && (trainingsSinceLastOccurrence > RareTokenSumInactivityThreshold)) {
      delete data.tokenList[token];
      removedTokens++;
    }

    // Entferne seltene Tokens, die nur in einer e-Mail aufgetaucht sind (egal wie häufig in dieser Mail) und lange nicht trainiert wurden
    else if (totalMailOccurrences <= 1 && (trainingsSinceLastOccurrence > RareTokenMailInactivityThreshold)) {
      delete data.tokenList[token];
      removedTokens++;
    }
  }

  console.log(`${removedTokens} rare tokens were removed for "${tagName}".`);

  if (removedTokens > 0) {
    updateTokenCounts(tagName, bayesData);
  }

  // Zusätzliche Optimierung: Begrenze die Anzahl der Tokens auf `maxTokenCount`
  console.log(`Token count for "${tagName}": ${data.totalUniqueTokens}`);
  if (data.totalUniqueTokens > maxTokenCount) {
    console.log(`Token count exceeds ${maxTokenCount}. Shrinking token database will start.`);
    shrinkTokenData(tagName);
    updateTokenCounts(tagName, bayesData); // Aktualisiere die Zähler nach dem Schrumpfen
  }
  else {
    // Iteriere über alle Tokens und halbiere die Zählung von häufigen Token damit der Einfluss nicht zu groß auf die Berechnung wird
    for (let token in data.tokenList) {
      const tokenData = data.tokenList[token];
      const totalOccurrences = tokenData[0] + tokenData[1]; // positiveCount + negativeCount

      // Reduziere die Zählung von häufigen Tokens, wenn sie den Schwellenwert überschreiten
      // alle Zähler müssen reduziert werden, da sonst die Verhältnisse nicht stimmen
      if (totalOccurrences > frequentTokenSumThreshold) {
        tokenData[0] = Math.ceil(tokenData[0] / 2); // positiveCount halbieren
        tokenData[1] = Math.ceil(tokenData[1] / 2); // negativeCount halbieren
        tokenData[2] = Math.ceil(tokenData[2] / 2); // positiveMailCount halbieren
        tokenData[3] = Math.ceil(tokenData[3] / 2); // negativeMailCount halbieren
        tokenData[4] = Math.ceil(tokenData[4] / 2); // positiveTrainCount halbieren
        tokenData[5] = Math.ceil(tokenData[5] / 2); // negativeTrainCount halbieren
      }
    }
  }
}


/**
 * Schrumpft die Token-Datenbank für einen bestimmten Tag.
 * - Halbiert die Zählungen aller relevanten Zähler (positiveCount, negativeCount, positiveMailCount, negativeMailCount, etc.).
 * - Entfernt Tokens, deren Zählung nach der Halbierung auf 1 oder weniger fällt.
 *
 * @param {string} tagName - Der Name des Tags, dessen Tokens geschrumpft werden.
 */
function shrinkTokenData(tagName) {
  const data = bayesData[tagName];
  if (!data) {
    console.warn(`No Bayes data found for tag "${tagName}". Shrinking skipped.`);
    return;
  }

  let removedTokens = 0;

  // Iteriere über alle Tokens und halbiere deren Zählungen
  for (let token in data.tokenList) {
    const tokenData = data.tokenList[token];
    
    // Zähler aufrunden nach der Halbierung
    tokenData[0] = Math.ceil(tokenData[0] / 2); // positiveCount aufrunden
    tokenData[1] = Math.ceil(tokenData[1] / 2); // negativeCount aufrunden
    tokenData[2] = Math.ceil(tokenData[2] / 2); // positiveMailCount aufrunden
    tokenData[3] = Math.ceil(tokenData[3] / 2); // negativeMailCount aufrunden
    tokenData[4] = Math.ceil(tokenData[4] / 2); // positiveTrainCount aufrunden
    tokenData[5] = Math.ceil(tokenData[5] / 2); // negativeTrainCount aufrunden

    // Entferne Tokens, deren Zählung nach der Halbierung auf 1 oder weniger fällt
    if (tokenData[0] + tokenData[1] <= 1) {
      delete data.tokenList[token];
      removedTokens++;
    }
  }

  if (removedTokens > 0) {
    updateTokenCounts(tagName, bayesData);
  }

  console.log(`${removedTokens} tokens were removed after shrinking for "${tagName}".`);
}
