const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const filePath = path.join(__dirname, 'wordlist.json');
const data = fs.readFileSync(filePath, 'utf-8');
const parsed = JSON.parse(data);

let sql = '';

let categoryId = 1;
for (const [categoryName, wordsArray] of Object.entries(parsed.wordlist.categories)) {
  sql += `INSERT INTO categories (id, name) VALUES ('${categoryId}', '${categoryName}');\n`;
  
  for (const item of wordsArray) {
    const word = item.haslo.replace(/'/g, "''");
    const hint = (item.hint || 'brak podpowiedzi').replace(/'/g, "''");
    const wordId = crypto.randomUUID();
    sql += `INSERT INTO words (id, word, categoryId, hint) VALUES ('${wordId}', '${word}', '${categoryId}', '${hint}');\n`;
  }
  categoryId++;
}

fs.writeFileSync(path.join(__dirname, '../seed.sql'), sql);
console.log('Zapisano pomyślnie do pliku seed.sql!');
