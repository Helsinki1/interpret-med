import type { NextApiRequest, NextApiResponse } from 'next';

interface MedicalTermDefinition {
  term: string;
  definition: string;
  example: string;
  category: 'medication' | 'diagnosis' | 'procedure' | 'anatomy' | 'symptom' | 'other';
}

interface ApiResponse {
  definitions: MedicalTermDefinition[];
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ definitions: [], error: 'Method not allowed' });
  }

  const { text, language = 'en' } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ definitions: [], error: 'Text is required' });
  }

  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      console.error('OpenAI API key not found in environment variables');
      return res.status(500).json({ definitions: [], error: 'OpenAI API key not configured' });
    }

    console.log('Processing medical definitions for text:', text.substring(0, 100) + '...');
    console.log('Using language:', language);

    const prompt = `Analyze the following medical conversation text and extract medical terms that would benefit from explanation. Include:

- Medication names (brand names, generic names, topical treatments like "bacitracin", "vaseline")
- Medical diagnoses and conditions  
- Medical procedures and treatments
- Anatomical terms and body parts
- Medical symptoms with specific names
- Medical devices and equipment

EXCLUDE only very basic terms like: "patient", "doctor", "hospital", "medicine", "treatment"

Text: "${text}"
Language: ${language}

Return a JSON array of objects with this exact format:
[
  {
    "term": "exact term from text",
    "definition": "One clear sentence explaining what this is",
    "example": "One sentence showing how it's used in medical context", 
    "category": "medication|diagnosis|procedure|anatomy|symptom|other"
  }
]

Be inclusive of medical terms that patients might not understand. If no medical terms are found, return an empty array.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a medical terminology expert. Extract and define medical terms from conversation transcripts. Be precise and concise.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      return res.status(500).json({ definitions: [], error: 'Failed to get medical definitions' });
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;

    console.log('OpenAI response content:', content);

    if (!content) {
      console.error('No content in OpenAI response:', result);
      return res.status(500).json({ definitions: [], error: 'No response from OpenAI' });
    }

    // Parse the JSON response
    let definitions: MedicalTermDefinition[] = [];
    try {
      // Extract JSON from the response (in case it's wrapped in markdown)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        definitions = JSON.parse(jsonMatch[0]);
      } else {
        definitions = JSON.parse(content);
      }
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError);
      console.error('Raw content:', content);
      return res.status(500).json({ definitions: [], error: 'Failed to parse medical definitions' });
    }

    // Validate the response format
    if (!Array.isArray(definitions)) {
      return res.status(500).json({ definitions: [], error: 'Invalid response format' });
    }

    // Filter and validate each definition
    const validDefinitions = definitions.filter(def => 
      def && 
      typeof def.term === 'string' && 
      typeof def.definition === 'string' && 
      typeof def.example === 'string' &&
      def.term.trim() !== '' &&
      def.definition.trim() !== '' &&
      def.example.trim() !== ''
    );

    return res.status(200).json({ definitions: validDefinitions });

  } catch (error) {
    console.error('Medical definitions API error:', error);
    return res.status(500).json({ 
      definitions: [], 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
} 