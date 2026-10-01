const express = require('express');
const router = express.Router();

// In-memory storage for user equipped effects (sessionId -> effectId)
const activeEffects = new Map();

// Available effects catalog
const REWARD_EFFECTS = [
  { id: 'none', name: 'Default Bubble', description: 'Standard ocean bubble style.' },
  { id: 'neon', name: 'Neon Cyan Glow', description: 'A pulsing cyan electric aura.' },
  { id: 'gold', name: 'Golden Aura', description: 'A warm, radiant gold shimmer.' },
  { id: 'rainbow', name: 'Rainbow Prism', description: 'Shifting chromatic light spectrum.' }
];

router.get('/', (req, res) => {
  const currentEffect = activeEffects.get(req.sessionID) || 'none';
  res.json({ effects: REWARD_EFFECTS, activeEffect: currentEffect });
});

router.post('/equip', (req, res) => {
  const { effectId } = req.body;
  const effect = REWARD_EFFECTS.find(e => e.id === effectId);
  if (!effect) {
    return res.status(400).json({ error: 'Invalid effect' });
  }
  activeEffects.set(req.sessionID, effectId);
  res.json({ success: true, activeEffect: effectId });
});

// Helper function so other files can check a user's equipped effect
function getActiveEffect(sessionId) {
  return activeEffects.get(sessionId) || 'none';
}

module.exports = { router, getActiveEffect };