import express from 'express';
import cors from 'cors';
import pg from 'pg'
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@localhost:5432/${process.env.DB_NAME}?schema=public`;
console.log('Connecting to database with connection string:', connectionString);
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const app = express();

app.use(cors());
app.use(express.json());

// Just log every request for debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - Body:`, req.body);
  next();
});

// Define API routes
/** ====== MATCH SCOUTING ===== */
app.get('/api/matches/query', async (req, res) => {
  try {
    const matches = await prisma.matchScouting.findMany();
    res.json(matches);
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

app.post('/api/matches', async (req, res) => {
  try {
    const entry = req.body;
    const createdEntry = await prisma.matchScouting.create({ data: entry });
    res.status(201).json(createdEntry);
  } catch (error) {
    console.error('Error saving match scouting entry:', error);
    res.status(500).json({ error: 'Failed to save match scouting entry' });
  }
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));