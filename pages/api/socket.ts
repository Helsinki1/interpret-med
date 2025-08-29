import { NextApiRequest } from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import WebSocket from 'ws';

export default function handler(req: NextApiRequest, res: any) {
  if (res.socket.server.io) {
    console.log('Socket.IO already initialized');
    res.end();
    return;
  }

  const httpServer: HTTPServer = res.socket.server;
  const io = new SocketIOServer(httpServer, {
    path: '/api/socketio',
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  res.socket.server.io = io;

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    let deepgramWs: WebSocket | null = null;

    socket.on('start-recording', (params) => {
      const apiKey = process.env.DEEPGRAM_API_KEY;
      if (!apiKey) {
        socket.emit('error', 'Deepgram API key not configured');
        return;
      }

      // Build WebSocket URL with parameters
      const wsParams = new URLSearchParams({
        model: params.model || 'nova-2',
        language: params.language || 'en',
        smart_format: 'true',
        punctuate: 'true',
        interim_results: 'true',
        encoding: params.encoding || 'linear16',
        sample_rate: params.sampleRate || '48000',
        channels: '1',
        endpointing: '45000',
        vad_events: 'true',
        utterance_end_ms: '8000'
      });

      const wsUrl = `wss://api.deepgram.com/v1/listen?${wsParams.toString()}`;
      console.log('Connecting to Deepgram:', wsUrl);

      try {
        deepgramWs = new WebSocket(wsUrl, ['token', apiKey]);

        deepgramWs.on('open', () => {
          console.log('Connected to Deepgram for client:', socket.id);
          socket.emit('connected');
        });

        deepgramWs.on('message', (data) => {
          const message = JSON.parse(data.toString());
          socket.emit('transcript', message);
        });

        deepgramWs.on('error', (error) => {
          console.error('Deepgram WebSocket error:', error);
          socket.emit('error', `Deepgram connection error: ${error.message}`);
        });

        deepgramWs.on('close', (code, reason) => {
          console.log('Deepgram connection closed:', code, reason?.toString());
          socket.emit('disconnected', { code, reason: reason?.toString() });
        });

      } catch (error) {
        console.error('Error creating Deepgram WebSocket:', error);
        socket.emit('error', 'Failed to connect to Deepgram');
      }
    });

    socket.on('audio-data', (audioData) => {
      if (deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
        deepgramWs.send(audioData);
      }
    });

    socket.on('stop-recording', () => {
      if (deepgramWs) {
        if (deepgramWs.readyState === WebSocket.OPEN) {
          deepgramWs.send(JSON.stringify({ type: 'CloseStream' }));
          deepgramWs.close(1000, 'Recording stopped');
        }
        deepgramWs = null;
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      if (deepgramWs) {
        deepgramWs.close();
        deepgramWs = null;
      }
    });
  });

  res.end();
} 