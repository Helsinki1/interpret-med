import { NextApiRequest, NextApiResponse } from 'next';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import WebSocket from 'ws';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Deepgram API key not configured' });
  }

  try {
    // Create Deepgram client
    const deepgram = createClient(apiKey);

    // Get WebSocket connection for live transcription
    const connection = deepgram.listen.live({
      model: 'nova-2',
      language: 'en-US',
      smart_format: true,
      punctuate: true,
      interim_results: true,
    });

    // Return the WebSocket URL for the client to connect to
    res.status(200).json({ 
      message: 'Deepgram connection ready',
      // In a real implementation, you'd return a WebSocket URL or handle the connection differently
      // For this demo, we'll handle the connection through Socket.IO or similar
    });

  } catch (error) {
    console.error('Deepgram API error:', error);
    res.status(500).json({ error: 'Failed to initialize Deepgram connection' });
  }
} 