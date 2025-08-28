import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

interface CorrectionRequest {
  text: string;
  conversationContext: string[];
  language?: string;
}

// Map language codes to more descriptive language names for OpenAI
function getLanguageDescription(langCode: string): string {
  const languageMap: { [key: string]: string } = {
    'en': 'English',
    'en-US': 'English',
    'es': 'Spanish',
    'es-ES': 'Spanish', 
    'es-MX': 'Spanish (Mexican)',
    'zh': 'Chinese',
    'zh-CN': 'Chinese (Simplified)',
    'zh-TW': 'Chinese (Traditional)',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'ar': 'Arabic',
    'hi': 'Hindi'
  };
  
  return languageMap[langCode] || langCode || 'English';
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

    const systemPrompt = `You are a medical transcription correction assistant for professional medical interpreters. Your task is to make MINIMAL, CONSERVATIVE corrections to medical terminology while preserving the original meaning, sentence structure, and LANGUAGE.

CRITICAL REQUIREMENTS:
1. PRESERVE THE ORIGINAL LANGUAGE - If the text is in Chinese, respond in Chinese. If Spanish, respond in Spanish. NEVER translate to English.
2. BE CONSERVATIVE - Only make corrections when you are absolutely certain. Prefer leaving text unchanged over making incorrect changes.
3. PRESERVE SENTENCE STRUCTURE - Do NOT restructure sentences or change word order unless absolutely necessary for medical accuracy.
4. PRESERVE NATURAL SPEECH PATTERNS - Keep the speaker's conversational tone, cultural expressions, and natural language flow.
5. MINIMAL MEDICAL CORRECTIONS ONLY:
   - Fix obvious medical terminology errors (e.g., "high per tension" → "hypertension")
   - Correct clear medication name errors (e.g., "met formin" → "metformin")
   - Fix anatomical term pronunciation errors (e.g., "cardio vascular" → "cardiovascular")
   - Correct medical procedure names only when clearly mispronounced
6. ADD BASIC PUNCTUATION - Add periods, commas, and question marks where natural, but don't over-punctuate.
7. MEDICAL INTERPRETER CONTEXT - Recognize that medical interpreters commonly:
   - State their ID numbers at the beginning ("This is interpreter 12345")
   - Ask "What can I do for you?" or "How can I help you?"
   - Use professional but conversational language
   - Switch between languages naturally
8. LEAVE UNCHANGED:
   - Non-medical content
   - Proper names and personal information
   - Natural speech patterns and filler words
   - Cultural expressions and idioms
   - Uncertain pronunciations

EXAMPLES OF APPROPRIATE CORRECTIONS:
- "high per tension" → "hypertension" (clear medical term)
- "met formin" → "metformin" (clear medication name)
- "This is interpreter twelve three four five" → "This is interpreter 12345" (standard format)

EXAMPLES OF WHAT NOT TO CHANGE:
- "The patient, um, has been feeling tired" → KEEP AS IS (natural speech)
- "¿Cómo está usted hoy?" → KEEP AS IS (cultural greeting)
- "He's got some pain in his, you know, chest area" → KEEP AS IS (natural expression)

Return ONLY the corrected text with minimal changes, in the SAME LANGUAGE as the input, without explanations or additional commentary.`;

    const languageDescription = getLanguageDescription(language);
    
    const userPrompt = `${contextText}Current text to correct (language: ${languageDescription}):
"${text}"

CRITICAL: 
- Respond ONLY in ${languageDescription}. Do NOT translate to English or any other language.
- Make MINIMAL corrections - only fix clear medical terminology errors.
- Keep the original sentence structure and natural speech patterns.
- When in doubt, leave the text unchanged.

Corrected text:`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 500,
      temperature: 0.1, // Lower temperature for more conservative corrections
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