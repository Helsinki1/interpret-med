import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

interface CorrectionRequest {
  text: string;
  conversationContext: string[];
  language?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  try {
    const { text, conversationContext, language = 'en' }: CorrectionRequest = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    // Build context from previous conversation
    const contextText = conversationContext && conversationContext.length > 0 
      ? `Previous conversation context:\n${conversationContext.slice(-5).join('\n')}\n\n`
      : '';

    const systemPrompt = `You are a medical transcription correction assistant. Your task is to correct medical terminology, drug names, anatomical terms, and medical procedures in transcribed text while preserving the original meaning and context.

Key guidelines:
1. Correct obvious medical terminology errors (e.g., "high per tension" → "hypertension")
2. Fix medication names (e.g., "met formin" → "metformin")  
3. Correct anatomical terms (e.g., "cardio vascular" → "cardiovascular")
4. Fix medical procedure names and abbreviations
5. Preserve the speaker's natural language and conversational tone
6. Do not add information that wasn't in the original text
7. Keep non-medical content unchanged
8. If uncertain about a correction, leave the original text

Return ONLY the corrected text without explanations or additional commentary.`;

    const userPrompt = `${contextText}Current text to correct:
"${text}"

Corrected text:`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 500,
      temperature: 0.1, // Low temperature for consistent corrections
      top_p: 0.9,
    });

    const correctedText = completion.choices[0]?.message?.content?.trim() || text;

    res.status(200).json({
      originalText: text,
      correctedText: correctedText,
      language: language
    });

  } catch (error) {
    console.error('OpenAI API error:', error);
    res.status(500).json({ 
      error: 'Failed to process medical correction',
      originalText: req.body.text // Return original text as fallback
    });
  }
} 