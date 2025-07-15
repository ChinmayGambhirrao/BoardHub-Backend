const mongoose = require("mongoose");

const CardTemplateSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: "" },
  column: { type: String, required: true },
});

const TemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String, default: "" },
    columns: [{ type: String, required: true }],
    cards: [CardTemplateSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Template", TemplateSchema);
