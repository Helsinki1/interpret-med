import { NextApiRequest, NextApiResponse } from 'next';
import WebSocket from 'ws';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Deepgram API key not configured' });
  }

  return new Promise((resolve) => {
    const wsUrl = 'wss://api.deepgram.com/v1/listen?model=nova-2&language=en&smart_format=true&punctuate=true&interim_results=true';
    
    console.log('Testing Deepgram WebSocket connection from server...');
    console.log('URL:', wsUrl);
    
    const ws = new WebSocket(wsUrl, ['token', apiKey]);
    
    const timeout = setTimeout(() => {
      ws.close();
      res.status(408).json({ 
        success: false, 
        error: 'Connection timeout',
        url: wsUrl
      });
      resolve(null);
    }, 10000);

    ws.on('open', () => {
      console.log('✅ Server-side WebSocket connected to Deepgram!');
      clearTimeout(timeout);
      ws.close();
      res.status(200).json({ 
        success: true, 
        message: 'Successfully connected to Deepgram from server',
        url: wsUrl
      });
      resolve(null);
    });

    ws.on('error', (error) => {
      console.error('❌ Server-side WebSocket error:', error);
      clearTimeout(timeout);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        url: wsUrl
      });
      resolve(null);
    });

    ws.on('close', (code, reason) => {
      console.log('Server-side WebSocket closed:', code, reason?.toString());
    });
  });
} 