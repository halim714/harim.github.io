import nlp from 'compromise';

// Function to analyze text and suggest a title
export function suggestTitle(text) {
  if (!text || text.trim().length < 10) {
    return null; // Not enough content for a suggestion
  }
  const doc = nlp(text);
  let potentialTitle = doc.sentences().first().text();
  if (!potentialTitle) {
    potentialTitle = doc.nouns().first().text();
  }
  if (potentialTitle) {
    potentialTitle = potentialTitle.replace(/^[\W\s]+|[\W\s]+$/g, '');
    potentialTitle = potentialTitle.charAt(0).toUpperCase() + potentialTitle.slice(1);
    if (potentialTitle.length > 80) {
      potentialTitle = potentialTitle.substring(0, 80) + '...';
    }
    return potentialTitle;
  }
  return null;
}

// Function to extract keywords/tags from text
export function suggestTags(text, maxTags = 5) {
  if (!text || text.trim().length < 20) {
    return [];
  }
  const doc = nlp(text);
  const nouns = doc.nouns().out('array');
  const properNouns = doc.match('#ProperNoun').out('array');
  const termFrequency = {};
  [...nouns, ...properNouns].forEach(term => {
    const lowerTerm = term.toLowerCase();
    if (lowerTerm.length > 2 && lowerTerm.length < 20) { // Basic filtering
      termFrequency[lowerTerm] = (termFrequency[lowerTerm] || 0) + 1;
    }
  });
  const sortedTags = Object.entries(termFrequency)
    .sort(([, a], [, b]) => b - a)
    .map(([term]) => term);
  return sortedTags.slice(0, maxTags);
}

// Function to suggest related documents based on keyword overlap
export function suggestRelatedDocuments(currentText, allNotesIndex = [], maxSuggestions = 3) {
  if (!currentText || currentText.trim().length < 50 || !allNotesIndex || allNotesIndex.length === 0) {
    return [];
  }

  const currentDoc = nlp(currentText);
  // Extract keywords (nouns, proper nouns) from the current text
  const currentKeywords = new Set(
    [...currentDoc.nouns().out('array'), ...currentDoc.match('#ProperNoun').out('array')]
    .map(term => term.toLowerCase())
    .filter(term => term.length > 2 && term.length < 20)
  );

  if (currentKeywords.size === 0) {
    return [];
  }

  const suggestions = allNotesIndex
    .map(note => {
      // Assume note index has { title: string, slug: string, tags: string[], content_snippet: string }
      // Calculate overlap score (simple keyword matching for now)
      let score = 0;
      const noteKeywords = new Set();
      // Add keywords from title
      nlp(note.title).nouns().out('array').forEach(t => noteKeywords.add(t.toLowerCase()));
      // Add keywords from tags
      note.tags.forEach(t => noteKeywords.add(t.toLowerCase()));
      // Add keywords from snippet (optional, can be heavy)
      // nlp(note.content_snippet).nouns().out('array').forEach(t => noteKeywords.add(t.toLowerCase()));

      currentKeywords.forEach(keyword => {
        if (noteKeywords.has(keyword)) {
          score++;
        }
      });
      
      // Avoid suggesting the note itself if it's being edited (need a way to identify current note)
      // if (note.slug === currentNoteSlug) return null; 

      return { ...note, score };
    })
    .filter(note => note && note.score > 0) // Filter out nulls and notes with no overlap
    .sort((a, b) => b.score - a.score); // Sort by score descending

  return suggestions.slice(0, maxSuggestions);
}

