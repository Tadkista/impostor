const mongoose = require('mongoose');

const wordSchema = new mongoose.Schema({
  word:       { type: String, required: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  hint:       { type: String, default: 'powiązany obiekt lub pojęcie' },
  imageUrl:   { type: String, default: null },
});

module.exports = mongoose.model('Word', wordSchema);
