export function detectLikelyLanguage(text: string): 'es' | 'en' | 'other' {
  if (!text || !text.trim()) return 'other';

  // Non-Latin scripts (Cyrillic, Arabic, Japanese, Chinese, Korean, etc.)
  if (/[\u0400-\u04FF\u0600-\u06FF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/.test(text)) {
    return 'other';
  }

  const lower = text.toLowerCase();

  // Strong indicators of other Latin-script languages (Portuguese, French, German, Italian)
  const otherCharMatches = (lower.match(/[çãõêôàèùäöüß]/g) || []).length;
  const otherWordMatches = (
    lower.match(/\b(não|você|vocês|são|uma|mais|também|muito|est|les|des|dans|pour|avec|une|mais|très|der|die|das|und|ist|nicht|ich|che|non|sono|della)\b/g) || []
  ).length;
  if (otherCharMatches >= 2 || otherWordMatches >= 3) {
    return 'other';
  }

  const esAccentMatches = (lower.match(/[áéíóúñ¿¡]/g) || []).length;
  const esWordMatches = (
    lower.match(/\b(el|la|los|las|de|del|en|para|con|por|una|un|que|es|son|como|más|pero|guía|orden|lectura|película|películas|cómic|cómics|serie|series|temporada|episodio|historia|esta|este|sobre|sin|también|muy|todo|todos|reseña|mejor|buena|bueno|excelente|increíble|donde|cuando|porque|hay|fue|ser)\b/g) || []
  ).length;
  const esScore = esWordMatches + esAccentMatches * 1.5;

  const enWordMatches = (
    lower.match(/\b(the|and|for|with|from|this|that|are|was|were|have|has|not|but|you|your|guide|reading|order|movie|movies|comic|comics|series|season|episode|story|about|without|also|very|all|watch|read|great|good|best|review|where|when|because|there|been|into|their|which|would|could)\b/g) || []
  ).length;
  const enScore = enWordMatches;

  if (esScore >= 2 && esScore > enScore * 1.5) return 'es';
  if (enScore >= 2 && enScore > esScore * 1.5) return 'en';
  return 'other';
}

export function shouldShowTranslateButton(text: string | null | undefined, targetLang: string): boolean {
  if (!text || !text.trim()) return false;
  return detectLikelyLanguage(text) !== targetLang;
}
