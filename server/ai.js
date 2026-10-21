// Optional AI. Set ANTHROPIC_API_KEY (Claude) or GEMINI_API_KEY (Google) to turn it on.
// Without a key the app still works: scoring comes from the built-in engine, and
// products are found by barcode, name search or a photo of the ingredient list.
const brain = require('../public/shared/brain.js');

const provider = () => process.env.ANTHROPIC_API_KEY ? 'claude' : process.env.GEMINI_API_KEY ? 'gemini' : null;
const settings = () => provider() && { provider: provider(), key: provider() === 'claude' ? process.env.ANTHROPIC_API_KEY : process.env.GEMINI_API_KEY, model: process.env.AI_MODEL };
const askJSON = (prompt, image) => brain.askJSON(settings(), prompt, image);

module.exports = { provider, askJSON, analyzePrompt: brain.analyzePrompt };
