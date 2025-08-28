import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Deepgram API key not configured' });
  }

  // For now, we'll return the API key directly for client-side use
  // In a production environment, you would want to implement proper token generation
  res.status(200).json({ 
    apiKey: apiKey,
    websocketUrl: 'wss://api.deepgram.com/v1/listen'
  });
} 