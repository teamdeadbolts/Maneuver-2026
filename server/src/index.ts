import express from 'express';
import cors from 'cors';
import pg from 'pg'
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client.js';
import type { DBStats, QueryFilters, ScoutingEntryBase } from '@/shared/types/scouting-entry.js';
import type { PitScoutingEntryBase, PitScoutingStats } from '@/shared/core/types/pit-scouting.js';

(BigInt as any).prototype.toJSON = function() {
  return this.toString();
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@localhost:5432/${process.env.DB_NAME}?schema=public`;
console.log('Connecting to database with connection string:', connectionString);
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

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

app.post('/api/matches/query', async (req, res) => {
  try {
    const filters = req.body as QueryFilters; // Expecting QueryFilters shape
    const whereClause: any = {};

    if (filters.teamNumbers) {
      whereClause.teamNumber = { in: filters.teamNumbers };
    }
    if (filters.matchNumbers) {
      whereClause.matchNumber = { in: filters.matchNumbers };
    }
    if (filters.eventKeys) {
      whereClause.eventKey = { in: filters.eventKeys };
    }
    if (filters.alliances) {
      whereClause.allianceColor = { in: filters.alliances };
    }
    if (filters.scoutNames) {
      whereClause.scoutName = { in: filters.scoutNames };
    }
    if (filters.dateRange) {
      whereClause.timestamp = {
        gte: BigInt(filters.dateRange.start),
        lte: BigInt(filters.dateRange.end),
      };
    }

    const matches = await prisma.matchScouting.findMany({ where: whereClause });
    res.json(matches);
  } catch (error) {
    console.error('Error querying matches:', error);
    res.status(500).json({ error: 'Failed to query matches' });
  }
});

app.post('/api/matches', async (req, res) => {
  try {
    const entry = req.body as ScoutingEntryBase;
    const result = await updateOrCreateMatchScoutingEntry(entry);
    res.json(result);
  } catch (error) {
    console.error('Error saving match scouting entry:', error);
    res.status(500).json({ error: 'Failed to save match scouting entry' });
  }
});

app.post('/api/matches/bulk', async (req, res) => {
  try {
    const entries = req.body as ScoutingEntryBase[];
    const upsertPromises = entries.map(entry => updateOrCreateMatchScoutingEntry(entry));
    const results = await Promise.all(upsertPromises);
    res.json(results);
  } catch (error) {
    console.error('Error saving bulk match scouting entries:', error);
    res.status(500).json({ error: 'Failed to save bulk match scouting entries' });
  }
});

app.delete('/api/matches/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await prisma.matchScouting.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting match scouting entry:', error);
    res.status(500).json({ error: 'Failed to delete match scouting entry' });
  }
});

app.delete('/api/matches/events/:eventKey', async (req, res) => {
  try {
    const eventKey = req.params.eventKey;
    await prisma.matchScouting.deleteMany({ where: { eventKey } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing match scouting data:', error);
    res.status(500).json({ error: 'Failed to clear match scouting data' });
  }
});

app.delete('/api/matches/all', async (req, res) => {
  try {
    await prisma.matchScouting.deleteMany({});
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing all match scouting data:', error);
    res.status(500).json({ error: 'Failed to clear all match scouting data' });
  }
});

// Pit scouting routes
app.post('/api/pit', async (req, res) => {
  try {    
    const entry = req.body as PitScoutingEntryBase;
    const result = await updateOrCreatePitScoutingEntry(entry);
    res.json(result);
  } catch (error) {
    console.error('Error saving pit scouting entry:', error);
    res.status(500).json({ error: 'Failed to save pit scouting entry' });
  }
});

app.post('/api/pit/bulk', async (req, res) => {
  try {
    const entries = req.body as PitScoutingEntryBase[];
    const upsertPromises = entries.map(entry => updateOrCreatePitScoutingEntry(entry));
    const results = await Promise.all(upsertPromises);
    res.json(results);
  } catch (error) {
    console.error('Error saving bulk pit scouting entries:', error);
    res.status(500).json({ error: 'Failed to save bulk pit scouting entries' });
  }
});

app.get('/api/pit/query', async (req, res) => {
  try {
    const entries = (await prisma.pitScouting.findMany()).map(entry => ({
      ...entry,
      timestamp: Number(entry.timestamp),
    })) as PitScoutingEntryBase[];
    res.json(entries);
  } catch (error) {
    console.error('Error fetching pit scouting entries:', error);
    res.status(500).json({ error: 'Failed to fetch pit scouting entries' });
  }
});

app.post('/api/pit/query', async (req, res) => {
  try {
    const { teamNumber, eventKey } = req.body as { teamNumber?: number; eventKey?: string };
    const whereClause: any = {};
    if (teamNumber) whereClause.teamNumber = teamNumber;
    if (eventKey) whereClause.eventKey = eventKey;

    const entries = (await prisma.pitScouting.findMany({ where: whereClause })).map(entry => ({
      ...entry,
      timestamp: Number(entry.timestamp),
    })) as PitScoutingEntryBase[];
    res.json(entries);
  } catch (error) {
    console.error('Error querying pit scouting entries:', error);
    res.status(500).json({ error: 'Failed to query pit scouting entries' });
  }
});


app.get('/api/pit/event/:eventKey', async (req, res) => {
  try {
    const eventKey = req.params.eventKey;
    const entries = (await prisma.pitScouting.findMany({ where: { eventKey } })).map(entry => ({
      ...entry,
      timestamp: Number(entry.timestamp),
    })) as PitScoutingEntryBase[];
    res.json(entries);
  } catch (error) {
    console.error('Error fetching pit scouting entries for event:', error);
    res.status(500).json({ error: 'Failed to fetch pit scouting entries for event' });
  }
});

app.delete('/api/pit/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await prisma.pitScouting.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting pit scouting entry:', error);
    res.status(500).json({ error: 'Failed to delete pit scouting entry' });
  }
});

app.delete('/api/pit/all', async (req, res) => {
  try {
    await prisma.pitScouting.deleteMany({});
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing all pit scouting data:', error);
    res.status(500).json({ error: 'Failed to clear all pit scouting data' });
  }
});

app.delete('/api/pit/events/:eventKey', async (req, res) => {
  try {
    const eventKey = req.params.eventKey;
    await prisma.pitScouting.deleteMany({ where: { eventKey } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing pit scouting data for event:', error);
    res.status(500).json({ error: 'Failed to clear pit scouting data for event' });
  }
});

app.get('/api/pit/stats', async (req, res) => {
  try {
    const totalEntries = await prisma.pitScouting.count();
    const teams = await prisma.pitScouting.findMany({
      distinct: ['teamNumber'],
      select: { teamNumber: true },
    });
    const events = await prisma.pitScouting.findMany({
      distinct: ['eventKey'],
      select: { eventKey: true },
    });
    const scouts = await prisma.pitScouting.findMany({
      distinct: ['scoutName'],
      select: { scoutName: true },
    });

    const stats: PitScoutingStats = {
      totalEntries,
      teams: teams.map(t => t.teamNumber),
      events: events.map(e => e.eventKey),
      scouts: scouts.map(s => s.scoutName),
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching pit scouting stats:', error);
    res.status(500).json({ error: 'Failed to fetch pit scouting stats' });
  }
});


// Misc
app.get('/api/stats', async (req, res) => {
  try {
    const totalEntries = await prisma.matchScouting.count();
    const teams = await prisma.matchScouting.findMany({
      distinct: ['teamNumber'],
      select: { teamNumber: true },
    });
    const matches = await prisma.matchScouting.findMany({
      distinct: ['matchKey'],
      select: { matchKey: true },
    });
    const scouts = await prisma.matchScouting.findMany({
      distinct: ['scoutName'],
      select: { scoutName: true },
    });
    const events = await prisma.matchScouting.findMany({
      distinct: ['eventKey'],
      select: { eventKey: true },
    });
    const oldestEntry = await prisma.matchScouting.findFirst({
      orderBy: { timestamp: 'asc' },
      select: { timestamp: true },
    });
    const newestEntry = await prisma.matchScouting.findFirst({
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true },
    });

    const stats: DBStats = {
      totalEntries,
      teams: teams.map(t => t.teamNumber.toString()),
      matches: matches.map(m => m.matchKey),
      scouts: scouts.map(s => s.scoutName),
      events: events.map(e => e.eventKey),
      oldestEntry: Number(oldestEntry?.timestamp || 0),
      newestEntry: Number(newestEntry?.timestamp || 0),
    };

    res.json({ stats });
  } catch (error) {
    console.error('Error fetching match scouting stats:', error);
    res.status(500).json({ error: 'Failed to fetch match scouting stats' });
  }
});

app.post('/api/matches/import', async (req, res) => {
  try {
    const entries = req.body.entries as ScoutingEntryBase[];
    const mode = req.body.mode as 'append' | 'overwrite';

    if (mode === 'overwrite') {
      // If overwrite, we clear all existing data before importing
      await prisma.matchScouting.deleteMany({});
    }

    const upsertPromises = entries.map(entry => updateOrCreateMatchScoutingEntry(entry));
    const results = await Promise.all(upsertPromises);
    res.json({ success: true, importedCount: results.length });
  } catch (error) {
    console.error('Error importing match scouting entries:', error);
    res.status(500).json({ error: 'Failed to import match scouting entries' });
  }
});

const tbaAllowed = [
  /^\/events\/\d+(?:\/simple)?$/,
  /^\/event\/[a-z0-9]+\/matches(?:\/simple)?$/i,
  /^\/event\/[a-z0-9]+\/teams\/keys$/i,
  /^\/match\/[a-z0-9_]+$/i,
];

const nexusAllowed = [
  /^\/events$/,
  /^\/event\/[a-z0-9]+$/i,
  /^\/event\/[a-z0-9]+\/pits$/i,
  /^\/event\/[a-z0-9]+\/map$/i,
];

function isAllowedEndpoint(provider: string, endpoint: string): boolean {
  const rules = provider === 'tba' ? tbaAllowed : nexusAllowed;
  return rules.some(rule => rule.test(endpoint));
}

// Provider proxy
app.get('/api/provider_proxy', async (req, res) => {
  try {
    const provider = req.query.provider as string;
    const endpoint = req.query.endpoint as string;

    if (provider !== 'tba' && provider !== 'nexus') {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    if (!endpoint.startsWith('/') || !isAllowedEndpoint(provider, endpoint)) {
      return res.status(400).json({ error: 'Endpoint not allowed' });
    }

    const overrideKey = req.headers['x-client-api-key'] as string | undefined;
    const apiKey = overrideKey || (provider === 'tba' ? process.env.TBA_API_KEY : process.env.NEXUS_API_KEY);

    const fetchOptions: RequestInit = {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(provider === 'tba' ? { 'X-TBA-Auth-Key': apiKey || '' } : { 'Nexus-API-Key': apiKey || '' }),
      },
    };

    const targetUrl =
      provider === 'tba'
        ? `https://www.thebluealliance.com/api/v3${endpoint}`
        : `https://frc.nexus/api/v1${endpoint}`;

    const response = await fetch(targetUrl, fetchOptions);
    const text = await response.text();

    if (!response.ok) {
      const message =
        typeof text === 'object' && text !== null && 'error' in text && typeof (text as any).error === 'string'
          ? (text as any).error
          : `Provider request failed with status ${response.status}`;
      return res.status(500).json({ error: message });
    }

    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }

    res.json(payload);
  } catch (error) {
    console.error('Error in provider proxy:', error);
    res.status(500).json({ error: 'Failed to proxy provider request' });
  }
});

// Utils

const updateOrCreateMatchScoutingEntry = async (entry: ScoutingEntryBase) => {
  const timestamp = BigInt(Math.round(entry.timestamp));

  return await prisma.matchScouting.upsert({
    where: { id: entry.id },
    update: {
      teamNumber: entry.teamNumber,
      matchNumber: entry.matchNumber,
      matchKey: entry.matchKey,
      allianceColor: entry.allianceColor,
      scoutName: entry.scoutName,
      eventKey: entry.eventKey,
      gameData: entry.gameData as any,
      timestamp: timestamp,
      isCorrected: entry.isCorrected,
    },
    create: {
      id: entry.id,
      teamNumber: entry.teamNumber,
      matchNumber: entry.matchNumber,
      matchKey: entry.matchKey,
      allianceColor: entry.allianceColor,
      scoutName: entry.scoutName,
      eventKey: entry.eventKey,
      gameData: entry.gameData as any,
      timestamp: timestamp,
      isCorrected: entry.isCorrected,
    }
  });
};

const updateOrCreatePitScoutingEntry = async (entry: PitScoutingEntryBase) => {
  const timestamp = BigInt(Math.round(entry.timestamp));
  return await prisma.pitScouting.upsert({
    where: { id: entry.id },
    update: {
      teamNumber: entry.teamNumber,
      eventKey: entry.eventKey,
      scoutName: entry.scoutName,
      timestamp: timestamp,
      robotPhoto: entry.robotPhoto,
      weight: entry.weight,
      drivetrain: entry.drivetrain,
      programmingLanguage: entry.programmingLanguage,
      notes: entry.notes,
      gameData: entry.gameData as any,
    },
    create: {
      id: entry.id,
      teamNumber: entry.teamNumber,
      eventKey: entry.eventKey,
      scoutName: entry.scoutName,
      timestamp: timestamp,
      robotPhoto: entry.robotPhoto,
      weight: entry.weight,
      drivetrain: entry.drivetrain,
      programmingLanguage: entry.programmingLanguage,
      notes: entry.notes,
      gameData: entry.gameData as any,
    }
  });
};

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));