const fs = require('fs');
const path = require('path');

let wordsCache = [];

const loadWords = () => {
  try {
    const filePath = path.join(__dirname, 'wordlist.json');
    const data = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(data);
    
    wordsCache = [];
    if (parsed.wordlist && parsed.wordlist.categories) {
      for (const [category, words] of Object.entries(parsed.wordlist.categories)) {
        for (const item of words) {
          if (item.haslo && item.hint) {
            wordsCache.push({
              word: item.haslo,
              hint: item.hint,
              category
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('Failed to load wordlist.json:', err);
    wordsCache = [];
  }
};

loadWords();

const usedWordsPerRoom = {};

const getRandomWord = (roomCode) => {
  if (!wordsCache || wordsCache.length === 0) {
    loadWords();
    if (wordsCache.length === 0) return { word: 'Błąd', hint: 'Brak słów w bazie', category: 'Ogólne' };
  }

  if (!usedWordsPerRoom[roomCode]) {
    usedWordsPerRoom[roomCode] = new Set();
  }

  const availableWords = wordsCache.filter(w => !usedWordsPerRoom[roomCode].has(w.word));

  // If all words used, reset history
  if (availableWords.length === 0) {
    usedWordsPerRoom[roomCode].clear();
    const picked = wordsCache[Math.floor(Math.random() * wordsCache.length)];
    usedWordsPerRoom[roomCode].add(picked.word);
    return picked;
  }

  const picked = availableWords[Math.floor(Math.random() * availableWords.length)];
  usedWordsPerRoom[roomCode].add(picked.word);
  
  return picked;
};

const cleanupRoomWords = (roomCode) => {
  delete usedWordsPerRoom[roomCode];
};

module.exports = { getRandomWord, cleanupRoomWords };
