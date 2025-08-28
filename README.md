# Interpret Med - Real-time Transcription

A Next.js application that provides real-time speech transcription using Deepgram's API. Perfect for medical professionals who need accurate, real-time transcription of conversations and consultations.

## Features

- Real-time speech transcription using Deepgram
- **Medical terminology correction using GPT-3.5-turbo**
- Support for multiple languages
- **Enhanced text card separation (8-second intervals for more text per card)**
- Clean, medical-focused UI
- Secure API key handling (server-side only)
- Responsive design
- Real-time interim results
- Conversation context awareness for better corrections

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure API Keys:**
   - **Deepgram API** (required for transcription):
     - Sign up for a Deepgram account at [https://deepgram.com](https://deepgram.com)
     - Get your API key from the Deepgram dashboard
   - **OpenAI API** (required for medical correction):
     - Sign up for an OpenAI account at [https://platform.openai.com](https://platform.openai.com)
     - Get your API key from [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - Create a `.env.local` file in the root directory:
     ```
     DEEPGRAM_API_KEY=your_deepgram_api_key_here
     OPENAI_API_KEY=your_openai_api_key_here
     ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

1. **Enable Medical Correction**: Toggle the "Medical Terminology Correction" checkbox to enable GPT-powered medical term correction
2. Click "Start Recording" to begin transcription
3. Allow microphone access when prompted
4. Speak clearly - transcription will appear in real-time
5. Final transcripts appear in green, interim results in yellow
6. **Medical corrections** are automatically applied to final transcripts when enabled (marked with ✅ Corrected)
7. Hover over the "Corrected" indicator to see the original text
8. Click "Stop Recording" to end the session

### Medical Correction Features
- **Language Consistency**: Always uses the user-selected language for corrections, ensuring consistency throughout the session
- **Conservative Corrections**: Makes minimal, targeted corrections only to clear medical terminology errors
- **Natural Speech Preservation**: Maintains original sentence structure, conversational tone, and cultural expressions
- **Medical Interpreter Context**: Recognizes professional medical interpreter language patterns (ID numbers, greetings, etc.)
- Corrects obvious medical terminology (e.g., "high per tension" → "hypertension")
- Fixes clear medication names (e.g., "met formin" → "metformin")
- Corrects anatomical terms only when clearly mispronounced
- Uses conversation context for better accuracy
- Preserves filler words, natural pauses, and cultural expressions

## Security

- API keys are stored server-side only in environment variables
- Client-side code never has direct access to your Deepgram API key
- All API communication goes through secure server-side endpoints

## Browser Requirements

- Modern browser with WebRTC support
- Microphone access permissions
- Secure context (HTTPS in production)

## File Structure

```
interpret-med/
├── pages/
│   ├── index.tsx         # Main transcription page
│   ├── _app.tsx         # Next.js app component
│   └── api/             # Server-side API routes
│       └── transcribe.ts # Deepgram API proxy
├── styles/
│   ├── globals.css      # Global styles
│   └── Home.module.css  # Page-specific styles
├── .env.local           # Environment variables (create this)
├── package.json
└── README.md
```

## Deployment

When deploying to production:

1. Set the `DEEPGRAM_API_KEY` environment variable in your deployment platform
2. Ensure HTTPS is enabled (required for microphone access)
3. Build the application: `npm run build`
4. Start the production server: `npm start`

## Troubleshooting

- **No microphone access:** Ensure you're running on HTTPS in production or localhost in development
- **Connection errors:** Verify your Deepgram API key is correct and has sufficient credits
- **No transcription:** Check browser console for errors and ensure microphone permissions are granted 