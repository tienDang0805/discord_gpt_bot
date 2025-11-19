// src/models/userIdentitySchema.js

const mongoose = require('mongoose');

const userIdentitySchema = new mongoose.Schema({
    userId: { 
        type: String, 
        required: true, 
        unique: true, 
        index: true 
    },
    
    // Biệt danh/tên gọi
    nickname: { 
        type: String, 
        default: null,
        maxlength: 50
    },
    
    // Mô tả signature ngắn gọn về bản thân
    signature: { 
        type: String, 
        default: null,
        maxlength: 2000
    },
    
    // Metadata
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    
    updatedAt: { 
        type: Date, 
        default: Date.now 
    }
});

// Middleware tự động cập nhật updatedAt
userIdentitySchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const UserIdentity = mongoose.model('UserIdentity', userIdentitySchema);

module.exports = UserIdentity;