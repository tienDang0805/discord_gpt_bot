// src/services/pet/PetService.js

const EggService = require('./EggService');
const PetDisplayService = require('./PetDisplayService');
const PetManagementService = require('./PetManagementService');
const { Pet, UserEggCooldown } = require('../../model/petSchema');

const ADMIN_IDS = [process.env.ADMIN_ID,'1376058136879955999','685881075125190726','1376071689124839526'];
const MAX_PETS_PER_USER = 6;
const MAX_EGGS_PER_DAY = 5;

class PetService {
    constructor() {
        this.eggService = new EggService();
        this.displayService = new PetDisplayService();
        this.managementService = new PetManagementService();
    }

    // ==================== EGG METHODS ====================
    async beginHatchingProcess(interaction) {
        return this.eggService.beginHatchingProcess(interaction);
    }

    async hatchEgg(interaction, customId, requestUserId) {
        // Format nhận được có thể là:
        // - Full: "select_egg_0_Normal_448507913879945216"
        // - Short: "0_Normal_448507913879945216" (nếu InteractionHandler đã cắt)
        
        console.log(`[PetService] Raw customId:`, customId);
        
        const parts = customId.split('_');
        console.log(`[PetService] Parsing customId parts:`, parts);
        
        let eggIndex, eggRarity, userId;
        
        // Xử lý cả 2 format
        if (parts[0] === 'select' && parts[1] === 'egg') {
            // Format đầy đủ: select_egg_INDEX_RARITY_USERID
            if (parts.length < 5) {
                console.error(`[PetService] Invalid full customId format:`, customId);
                return interaction.reply({ 
                    content: '❌ Lỗi định dạng button!', 
                    ephemeral: true 
                });
            }
            eggIndex = parseInt(parts[2]);
            eggRarity = parts[3];
            userId = parts[4];
        } else {
            // Format ngắn: INDEX_RARITY_USERID
            if (parts.length < 3) {
                console.error(`[PetService] Invalid short customId format:`, customId);
                return interaction.reply({ 
                    content: '❌ Lỗi định dạng button!', 
                    ephemeral: true 
                });
            }
            eggIndex = parseInt(parts[0]);
            eggRarity = parts[1];
            userId = parts[2];
        }
        
        console.log(`[PetService] Parsed - Index: ${eggIndex}, Rarity: ${eggRarity}, User: ${userId}`);
        
        return this.eggService.hatchEgg(interaction, eggIndex, eggRarity, userId);
    }

    async canOpenEgg(userId) {
        return this.eggService.canOpenEgg(userId);
    }

    async updateEggCooldown(userId) {
        return this.eggService.updateEggCooldown(userId);
    }

    // ==================== DISPLAY METHODS ====================
    /**
     * KHÔNG defer - chỉ return data để handler xử lý
     */
    async showPetList(interaction) {
        return this.displayService.showPetList(interaction);
    }

    /**
     * Button interaction - tự defer bên trong
     */
    async showSinglePetStatus(interaction, petId, requestUserId) {
        console.log("petId",petId)
        console.log("requestUserId",requestUserId)
        return this.displayService.showSinglePetStatus(interaction, petId, requestUserId);
    }

    /**
     * Button interaction - tự defer bên trong
     */
    async showPetListUpdate(interaction) {
        return this.displayService.showPetListUpdate(interaction);
    }

    /**
     * Button interaction - tự defer bên trong
     */
    async backToPetList(interaction, requestUserId) {
        return this.displayService.backToPetList(interaction, requestUserId);
    }

    // ==================== MANAGEMENT METHODS ====================
    /**
     * KHÔNG defer - chỉ return data để handler xử lý
     */
    async showReleasePetMenu(interaction) {
        return this.managementService.showReleasePetMenu(interaction);
    }

    /**
     * Button interaction - tự defer bên trong
     */
    async confirmReleasePet(interaction, petId, requestUserId) {
        return this.managementService.confirmReleasePet(interaction, petId, requestUserId);
    }

    /**
     * Button interaction - tự defer bên trong
     */
    async releasePet(interaction, petId, requestUserId) {
        return this.managementService.releasePet(interaction, petId, requestUserId);
    }

    /**
     * Button interaction - tự defer bên trong
     */
    async cancelRelease(interaction, requestUserId) {
        return this.managementService.cancelRelease(interaction, requestUserId);
    }

    /**
     * Button interaction - tự defer bên trong
     */
    async showReleasePetMenuUpdate(interaction) {
        return this.managementService.showReleasePetMenuUpdate(interaction);
    }

    // ==================== UTILITY METHODS ====================
    getRarityEmoji(rarity) {
        const emojiMap = {
            'Normal': '⚪',
            'Magic': '🔵', 
            'Rare': '🟡',
            'Unique': '🟠',
            'Legend': '🔴'
        };
        return emojiMap[rarity] || '⚪';
    }

    // ==================== CONSTANTS ====================
    static get ADMIN_IDS() { return ADMIN_IDS; }
    static get MAX_PETS_PER_USER() { return MAX_PETS_PER_USER; }
    static get MAX_EGGS_PER_DAY() { return MAX_EGGS_PER_DAY; }
}

module.exports = PetService;