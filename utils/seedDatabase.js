const mongoose = require('mongoose');
const Category = require('../models/Category');
const Word = require('../models/Word');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const seedDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error('Brak MONGO_URI w pliku .env!');
      process.exit(1);
    }

    // Load and parse wordlist.json
    const filePath = path.join(__dirname, 'wordlist.json');
    const data = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(data);

    if (!parsed.wordlist || !parsed.wordlist.categories) {
      console.error('Nieprawidłowy format pliku wordlist.json');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Połączono z bazą danych...');

    await Category.deleteMany({});
    await Word.deleteMany({});

    for (const [categoryName, wordsArray] of Object.entries(parsed.wordlist.categories)) {
      const category = await Category.create({ name: categoryName });
      
      const wordDocs = wordsArray.map(item => ({
        word: item.haslo,
        categoryId: category._id,
        hint: item.hint || 'brak podpowiedzi',
      }));
      
      if (wordDocs.length > 0) {
        await Word.insertMany(wordDocs);
      }
    }

    console.log('Baza danych zasilona pomyślnie nowymi słowami z wordlist.json!');
    process.exit(0);
  } catch (err) {
    console.error('Błąd zasilania bazy:', err);
    process.exit(1);
  }
};

seedDB();
