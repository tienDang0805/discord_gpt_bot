// src/models/petSchema.js

const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: 'Mô tả kỹ năng.' },
    cost: { type: Number, default: 0 },
    type: { type: String, enum: ['Physical', 'Magic', 'Support'], default: 'Physical' },
    power: { type: Number, default: 10 }
}, { _id: false });

const traitSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: 'Mô tả nội tại.' },
}, { _id: false });

const petSchema = new mongoose.Schema({
    ownerId: { type: String, required: true, index: true }, // KHÔNG unique để cho phép nhiều pets
    name: { type: String, required: true },
    species: { type: String, required: true },
    description: { type: String, default: '' },
    rarity: { type: String, enum: ['Normal', 'Magic', 'Rare', 'Unique', 'Legend'], required: true },
    element: { type: String, default: 'Normal' },
    level: { type: Number, default: 1 },
    exp: { type: Number, default: 0 },
    expToNextLevel: { type: Number, default: 100 },
    stats: {
        hp: { type: Number, default: 50 }, maxHp: { type: Number, default: 50 },
        mp: { type: Number, default: 20 }, maxMp: { type: Number, default: 20 },
        atk: { type: Number, default: 10 }, def: { type: Number, default: 10 },
        int: { type: Number, default: 10 }, spd: { type: Number, default: 10 },
    },
    skills: [skillSchema],
    traits: [traitSchema],
    status: {
        stamina: { type: Number, default: 100 }, maxStamina: { type: Number, default: 100 },
        hunger: { type: Number, default: 100 },
    },
    evolutionStage: { type: Number, default: 1 },
    imageBasePrompt: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
});

// Schema cho việc theo dõi lần mở trứng cuối cùng
const userEggCooldownSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    lastEggOpenTime: { type: Date, default: Date.now },
});

const Pet = mongoose.model('Pet', petSchema);
const UserEggCooldown = mongoose.model('UserEggCooldown', userEggCooldownSchema);

module.exports = { Pet, UserEggCooldown };