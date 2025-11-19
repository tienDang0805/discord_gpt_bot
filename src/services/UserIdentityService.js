// src/services/UserIdentityService.js

const UserIdentity = require('../model/userIdentitySchema');
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

class UserIdentityService {
    constructor() {
        // In-memory cache
        this.identityCache = new Map();
        
        // Cache TTL (Time To Live) - 5 phút
        this.CACHE_TTL = 5 * 60 * 1000;
        
        // Cleanup expired cache mỗi 10 phút
        this.startCacheCleanup();
    }

    /**
     * Cleanup expired cache entries
     */
    startCacheCleanup() {
        setInterval(() => {
            const now = Date.now();
            let cleaned = 0;
            
            for (const [userId, data] of this.identityCache.entries()) {
                if (now - data.timestamp > this.CACHE_TTL) {
                    this.identityCache.delete(userId);
                    cleaned++;
                }
            }
            
            if (cleaned > 0) {
                console.log(`[UserIdentity Cache] Cleaned ${cleaned} expired entries`);
            }
        }, 10 * 60 * 1000); // Chạy mỗi 10 phút
    }

    /**
     * Lấy identity từ cache hoặc DB
     */
    async getOrCreateIdentity(userId) {
        try {
            // 1. Check cache trước
            const cached = this.identityCache.get(userId);
            if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL)) {
                console.log(`[UserIdentity] Cache HIT for ${userId}`);
                return cached.data;
            }

            // 2. Cache miss → Query DB
            console.log(`[UserIdentity] Cache MISS for ${userId}, querying DB...`);
            const identity = await UserIdentity.findOneAndUpdate(
                { userId },
                { 
                    $setOnInsert: { 
                        userId,
                        nickname: null,
                        signature: null,
                        createdAt: Date.now()
                    }
                },
                { 
                    upsert: true,
                    new: true,
                    runValidators: true
                }
            );
            
            // 3. Lưu vào cache
            this.identityCache.set(userId, {
                data: identity,
                timestamp: Date.now()
            });
            
            return identity;
        } catch (error) {
            console.error('[UserIdentity] Error in getOrCreateIdentity:', error);
            throw error;
        }
    }

    /**
     * Cập nhật identity VÀ invalidate cache
     */
    async updateIdentity(userId, updates) {
        try {
            const identity = await UserIdentity.findOneAndUpdate(
                { userId },
                { 
                    ...updates,
                    updatedAt: Date.now() 
                },
                { 
                    new: true, 
                    upsert: true,
                    runValidators: true 
                }
            );
            
            // QUAN TRỌNG: Xóa cache sau khi update
            this.identityCache.delete(userId);
            console.log(`[UserIdentity] Cache invalidated for ${userId}`);
            
            return identity;
        } catch (error) {
            console.error('[UserIdentity] Error in updateIdentity:', error);
            throw error;
        }
    }

    /**
     * Xóa identity VÀ invalidate cache
     */
    async deleteIdentity(userId) {
        try {
            await UserIdentity.findOneAndDelete({ userId });
            
            // Xóa cache
            this.identityCache.delete(userId);
            console.log(`[UserIdentity] Cache invalidated for ${userId}`);
            
            return { success: true };
        } catch (error) {
            console.error('[UserIdentity] Error in deleteIdentity:', error);
            throw error;
        }
    }

    /**
     * Hiển thị menu identity
     */
    async showIdentityMenu(interaction) {
        try {
            const userId = interaction.user.id;
            const identity = await this.getOrCreateIdentity(userId);

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('🎭 Danh Tính Của Bạn')
                .setDescription(`Chào <@${userId}>! AI sẽ nhớ bạn theo thông tin này.`)
                .addFields(
                    { 
                        name: '🏷️ Biệt danh', 
                        value: identity.nickname || '*Chưa đặt*', 
                        inline: true 
                    },
                    { 
                        name: '✍️ Signature', 
                        value: identity.signature || '*Chưa đặt*', 
                        inline: false 
                    }
                )
                .setFooter({ text: `Cập nhật: ${identity.updatedAt.toLocaleString('vi-VN')}` })
                .setTimestamp();

            const editButton = new ButtonBuilder()
                .setCustomId('edit_identity')
                .setLabel('✏️ Chỉnh sửa')
                .setStyle(ButtonStyle.Primary);

            const resetButton = new ButtonBuilder()
                .setCustomId('reset_identity')
                .setLabel('🔄 Xóa')
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder().addComponents(editButton, resetButton);

            return {
                embeds: [embed],
                components: [row],
                ephemeral: true
            };
        } catch (error) {
            console.error('[UserIdentity] Error in showIdentityMenu:', error);
            throw error;
        }
    }

    /**
     * Xử lý reset
     */
    async handleReset(interaction) {
        try {
            await interaction.deferUpdate();
            
            const userId = interaction.user.id;
            await this.deleteIdentity(userId);

            const embed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('🔄 Đã xóa danh tính!')
                .setDescription('Thông tin của bạn đã được xóa.')
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed],
                components: []
            });

            setTimeout(async () => {
                const menuData = await this.showIdentityMenu(interaction);
                await interaction.editReply(menuData);
            }, 2000);

        } catch (error) {
            console.error('[UserIdentity] Error in handleReset:', error);
            throw error;
        }
    }

    /**
     * Xem identity của người khác
     */
    async viewOtherUserIdentity(interaction, targetUserId) {
        try {
            const identity = await this.getOrCreateIdentity(targetUserId);

            if (!identity.nickname && !identity.signature) {
                return {
                    content: '❌ Người này chưa thiết lập danh tính.',
                    ephemeral: true
                };
            }

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`🎭 Danh Tính của <@${targetUserId}>`)
                .addFields(
                    { 
                        name: '🏷️ Biệt danh', 
                        value: identity.nickname || '*Không có*', 
                        inline: true 
                    },
                    { 
                        name: '✍️ Signature', 
                        value: identity.signature || '*Không có*', 
                        inline: false 
                    }
                )
                .setTimestamp();

            return {
                embeds: [embed],
                ephemeral: true
            };
        } catch (error) {
            console.error('[UserIdentity] Error in viewOtherUserIdentity:', error);
            throw error;
        }
    }

    /**
     * Lấy info cho AI prompt (với cache)
     */
    async getIdentityForPrompt(userId) {
        try {
            // Dùng getOrCreateIdentity → tự động check cache
            const identity = await this.getOrCreateIdentity(userId);

            return {
                nickname: identity.nickname,
                signature: identity.signature
            };
        } catch (error) {
            console.error('[UserIdentity] Error in getIdentityForPrompt:', error);
            return {
                nickname: null,
                signature: null
            };
        }
    }

    /**
     * Clear toàn bộ cache (dùng cho debug)
     */
    clearCache() {
        const size = this.identityCache.size;
        this.identityCache.clear();
        console.log(`[UserIdentity] Cleared ${size} cache entries`);
        return { cleared: size };
    }

    /**
     * Lấy thống kê cache
     */
    getCacheStats() {
        return {
            size: this.identityCache.size,
            entries: Array.from(this.identityCache.keys())
        };
    }
}

module.exports = new UserIdentityService();