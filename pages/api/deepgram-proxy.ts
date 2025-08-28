import { NextApiRequest, NextApiResponse } from 'next';
import WebSocket from 'ws';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Deepgram API key not configured' });
  }

  // Set up Server-Sent Events for real-time communication
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Create WebSocket connection to Deepgram
  const wsUrl = 'wss://api.deepgram.com/v1/listen?model=nova-2&language=en&smart_format=true&punctuate=true&interim_results=true';
  
  try {
    const ws = new WebSocket(wsUrl, ['token', apiKey]);

    ws.on('open', () => {
      console.log('Connected to Deepgram via server');
      res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
    });

    ws.on('message', (data) => {
      const message = data.toString();
      res.write(`data: ${message}\n\n`);
    });

    ws.on('error', (error) => {
      console.error('Deepgram WebSocket error:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    });

    ws.on('close', () => {
      console.log('Deepgram connection closed');
      res.write(`data: ${JSON.stringify({ type: 'closed' })}\n\n`);
      res.end();
    });

    // Handle client disconnect
    req.on('close', () => {
      ws.close();
    });

  } catch (error) {
    console.error('Error creating WebSocket:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: 'Failed to connect to Deepgram' })}\n\n`);
    res.end();
  }
} 