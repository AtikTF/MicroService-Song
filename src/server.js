const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB connection with proper error handling
const connectDB = async () => {
    try {
        // Try multiple environment variable names
        const mongoURI = process.env.MONGODB_URI || 
                         process.env.DATABASE_URL || 
                         process.env.MONGO_URL ||
                         process.env.MONGODB_CONNECTION_STRING;
        
        if (!mongoURI) {
            console.error('❌ MongoDB URI is not defined in environment variables');
            console.error('Available environment variables:', Object.keys(process.env).filter(key => 
                key.toLowerCase().includes('mongo') || 
                key.toLowerCase().includes('database') ||
                key.toLowerCase().includes('db')
            ));
            throw new Error('MongoDB URI is not defined. Please set MONGODB_URI environment variable.');
        }

        console.log('🔄 Attempting to connect to MongoDB...');
        console.log('📍 Using URI:', mongoURI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')); // Hide credentials in logs
        
        const conn = await mongoose.connect(mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000, // 10 seconds
            socketTimeoutMS: 45000, // 45 seconds
            maxPoolSize: 10,
            retryWrites: true,
            w: 'majority'
        });

        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        
        // Handle connection events
        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.log('⚠️ MongoDB disconnected');
        });

        mongoose.connection.on('reconnected', () => {
            console.log('✅ MongoDB reconnected');
        });

    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        
        // Only retry if it's a network error, not a configuration error
        if (error.message.includes('not defined')) {
            console.error('⚠️ Configuration error - stopping retry attempts');
            return;
        }
        
        console.log('🔄 Retrying connection in 5 seconds...');
        setTimeout(connectDB, 5000);
    }
};

// Song Schema
const songSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    path: {
        type: String,
        required: true
    },
    plays: {
        type: Number,
        default: 0,
        min: 0
    }
}, {
    timestamps: true,
    collection: 'songs'
});

// Add indexes for better performance
songSchema.index({ name: 1 });
songSchema.index({ plays: -1 });

const Song = mongoose.model('Song', songSchema);

// Health check endpoint
app.get('/health', (req, res) => {
    const healthCheck = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        environment: process.env.NODE_ENV || 'development',
        mongoUri: process.env.MONGODB_URI ? 'configured' : 'missing'
    };
    
    const status = mongoose.connection.readyState === 1 ? 200 : 503;
    res.status(status).json(healthCheck);
});

// API Routes

// Get all songs
app.get('/api/songs', async (req, res) => {
    try {
        const songs = await Song.find().sort({ createdAt: -1 });
        res.json({
            success: true,
            count: songs.length,
            data: songs
        });
    } catch (error) {
        console.error('Error fetching songs:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching songs',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// Get song by ID
app.get('/api/songs/:id', async (req, res) => {
    try {
        const song = await Song.findById(req.params.id);
        
        if (!song) {
            return res.status(404).json({
                success: false,
                message: 'Song not found'
            });
        }

        res.json({
            success: true,
            data: song
        });
    } catch (error) {
        console.error('Error fetching song:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching song',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// Create new song
app.post('/api/songs', async (req, res) => {
    try {
        const { name, path } = req.body;

        if (!name || !path) {
            return res.status(400).json({
                success: false,
                message: 'Name and path are required'
            });
        }

        const song = new Song({
            name: name.trim(),
            path: path.trim()
        });

        const savedSong = await song.save();
        
        res.status(201).json({
            success: true,
            message: 'Song created successfully',
            data: savedSong
        });
    } catch (error) {
        console.error('Error creating song:', error);
        
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Song with this name already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error creating song',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// Update song
app.put('/api/songs/:id', async (req, res) => {
    try {
        const { name, path, plays } = req.body;
        
        const updateData = {};
        if (name !== undefined) updateData.name = name.trim();
        if (path !== undefined) updateData.path = path.trim();
        if (plays !== undefined) updateData.plays = Math.max(0, parseInt(plays) || 0);

        const song = await Song.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!song) {
            return res.status(404).json({
                success: false,
                message: 'Song not found'
            });
        }

        res.json({
            success: true,
            message: 'Song updated successfully',
            data: song
        });
    } catch (error) {
        console.error('Error updating song:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating song',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// Increment play count
app.patch('/api/songs/:id/play', async (req, res) => {
    try {
        const song = await Song.findByIdAndUpdate(
            req.params.id,
            { $inc: { plays: 1 } },
            { new: true }
        );

        if (!song) {
            return res.status(404).json({
                success: false,
                message: 'Song not found'
            });
        }

        res.json({
            success: true,
            message: 'Play count updated',
            data: song
        });
    } catch (error) {
        console.error('Error updating play count:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating play count',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// Delete song
app.delete('/api/songs/:id', async (req, res) => {
    try {
        const song = await Song.findByIdAndDelete(req.params.id);

        if (!song) {
            return res.status(404).json({
                success: false,
                message: 'Song not found'
            });
        }

        res.json({
            success: true,
            message: 'Song deleted successfully',
            data: song
        });
    } catch (error) {
        console.error('Error deleting song:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting song',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// Get songs with most plays
app.get('/api/songs/stats/popular', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const songs = await Song.find()
            .sort({ plays: -1 })
            .limit(limit);

        res.json({
            success: true,
            count: songs.length,
            data: songs
        });
    } catch (error) {
        console.error('Error fetching popular songs:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching popular songs',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    await mongoose.connection.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...');
    await mongoose.connection.close();
    process.exit(0);
});

// Start server
const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
        // Connect to database first
        await connectDB();
        
        // Start the server
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🔗 Health check: http://localhost:${PORT}/health`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();