// MongoDB initialization script
// This script will run when the MongoDB container starts for the first time

db = db.getSiblingDB('polimusic_db');

// Create collections
db.createCollection('songs');

// Insert initial songs data (matching the SQL data provided)
db.songs.insertMany([
    {
        name: 'Adventure',
        path: '../songFiles/bensound-adventure.mp3',
        plays: 0,
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        name: 'Dreams',
        path: '../songFiles/bensound-dreams.mp3',
        plays: 1,
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        name: 'Energy',
        path: '../songFiles/bensound-energy.mp3',
        plays: 2,
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        name: 'Scifi',
        path: '../songFiles/bensound-scifi.mp3',
        plays: 3,
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        name: 'Tomorrow',
        path: '../songFiles/bensound-tomorrow.mp3',
        plays: 4,
        createdAt: new Date(),
        updatedAt: new Date()
    }
]);

print('✅ Database initialized with sample songs data');