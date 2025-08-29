import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

interface CorrectionRequest {
  text: string;
  conversationContext: string[];
  language?: string;
}

// Comprehensive medical terminology reference for accurate corrections
const MEDICAL_TERMINOLOGY_REFERENCE = `
COMMON MEDICAL TERMS (English/Chinese):

Hair Loss: Androgenetic Alopecia (AGA)/雄性秃, Minoxidil/米诺地尔, Rogaine/落健

Acne: Facial cleanser/洗面奶, Accutane/异维A酸, Benzoyl peroxide/过氧化苯甲酰, Adapalene/阿达帕林, Epiduo Forte/（阿达帕林和过氧化苯甲酰）凝胶

Anemia: Ferrous Sulfate/硫酸亚铁, iron dextran/右旋糖酐铁

Anxiety: alprazolam (Xanax)/阿普唑仑（赞安诺）, Aripiprazole/阿立哌唑, Amitriptyline/阿米替林, Buspirone (BuSpar)/丁螺环酮, clonazepam (Klonopin)/氯硝西泮, diazepam (Valium)/地西泮(烦宁), Duloxetine/度洛西丁, Fluoxetine (Prozac)/氟西丁, lorazepam (Ativan)/劳拉西泮（阿提凡）, Lexapro (Escitalopram)/艾司西酞普兰, Mirtazepine (Remeron)/米氮平, Propranolol/普萘洛尔, Quetiapine (Seroquel)/喹硫平（思乐康）, Sertraline/舍曲林, Citalopram (Celexa)/西酞普兰, Wellbutrin/安非他酮

Allergies: Flonase/辅舒良, Fluticasone/氟替卡松, Nasonex (Mometasone)/内舒拿（莫米松）, Benadryl/苯海拉明, Cetirizine (Zyrtec)/西替利嗪, Chlorpheniramine/氯苯那敏, Clobetasol/氯倍米松, Desloratadine (Clarinex)/地氯雷他定, EpiPen/肾上腺素自动注射笔, Fexofenadine (Allegra)/非索菲那定, Hydrocortisone/氢化可的松, Prednisone/泼尼松, Montelukast (Singulair)/孟鲁斯特, Loratadine (Claritin)/氯雷他定（开瑞坦）

Acid Reflux: Carafate (sucralfate)/硫糖铝, Famotidine (Pepcid)/法莫替丁, Lansoprazole (Prevacid)/兰索拉唑, Omeprazole (Prilosec)/奥美拉唑, Pantoprazole (Protonix)/泮托拉唑, Zantac (Ranitidine)/雷尼替丁

Antibiotics: amoxicillin/阿莫西林, azithromycin/阿奇霉素, Bactrim/复方新诺明, Bacitracin/杆菌肽软膏, Cephalexin (Keflex)/头孢氨苄, clindamycin/克林霉素, doxycycline/多西环素, erythromycin/红霉素, Levofloxacin/左氧氟沙星, Metronidazole (Flagyl)/甲硝唑, Penicillin/青霉素, Vancomycin/万古霉素

Blood Pressure: Atenolol/阿替洛尔, Amlodipine/氨氯地平, Benicar (Olmesartan)/奥美沙坦, Captopril/卡托普利, Carvedilol (Coreg)/卡维地洛, lisinopril/赖诺普利, losartan (Cozaar)/氯沙坦, Metoprolol/美托洛尔, Nifedipine/硝苯地平

Diabetes: Metformin/二甲双胍, Ozempic (Semaglutide)/索马鲁肽, Insulin/胰岛素, Lantus/长效胰岛素, Humalog/短效胰岛素, Dexcom G6/德康G6动态血糖仪, Omnipod/无线胰岛素泵

Blood Thinners: Apixaban (Eliquis)/阿哌沙班片, Warfarin (Coumadin)/华法林, Plavix/波立维, Rivaroxaban (Xarelto)/利瓦沙班

Cancer: Adriamycin/阿霉素, Cisplatin/顺铂, Carboplatin/卡铂, Keytruda/可瑞达, Tamoxifen/泰莫西芬, Herceptin (Trastuzumab)/赫塞丁

Anti-Nausea: Aloxi (Palonosetron)/帕洛诺司琼, Compazine (Prochlorperazine)/康帕嗪(丙氯拉嗪), Zofran/昂丹司琼, Reglan (Metoclopramide)/胃复安, Unisom (doxylamine)/多西拉敏

Cholesterol: Atorvastatin (Lipitor)/阿托伐他汀（立普妥）, Lovastatin (Altoprev)/洛伐他汀, Rosuvastatin (Crestor)/瑞舒伐他汀（可定）, Simvastatin (Zocor)/辛伐他汀, Fenofibrate/非诺贝特, Zetia/依折麦布

Cold/Flu: Tamiflu (Oseltamivir)/克流感（奥司他韦）

Constipation: Benefiber/无糖膳食纤维粉, Colace (Docusate)/多酷酯, Miralax/聚乙二醇, Metamucil/美达施膳食纤维粉, Magnesium citrate/柠檬酸镁

Cough: Benzonatate/苯佐那酯, Robitussin/惠菲宁, Mucinex/美清痰

Diarrhea: Loperamide (Imodium)/洛哌丁胺（易蒙停）, Lomotil/止泻宁, Diosmectite (Smecta)/蒙脱石散（思密达）

Eyes: Atropine drops/阿托品, Botox injection/肉毒杆菌素, GenTeal Tears/润滑眼药水, RESTASIS (cyclosporine)/环孢素滴眼液

Fungal: Ketoconazole/酮康唑, Fluconazole/氟康唑, Terbinafine (Lamisil)/盐酸特比萘酚

Heart: Adenosine/腺苷, Aminophylline/氨茶碱, Flecainide/氟卡尼, MULTAQ (Dronedarone)/决奈达隆

Pain: Advil/安舒疼, Aleve (naproxen)/萘普生钠片, Celebrex (celecoxib)/西乐葆（塞莱希布）, Codeine/可待因, Fentanyl/芬太尼, Dilaudid (Hydromorphone)/二氢吗啡酮, Hydrocodone (Vicodin)/氢可酮, Motrin (ibuprofen)/美林（布洛芬）, Morphine/吗啡, Percocet (Oxycodone)/氨酚羟考酮, Lyrica (Pregabalin)/利痛抑（普瑞巴林）, Tramadol/曲马多, Tylenol/泰诺

Migraines: Sumatriptan (Imitrex)/舒马曲坦, Excedrin/伊克赛锭, Rizatriptan (Maxalt)/利扎曲坦, Frovatriptan (Frova)/弗罗曲坦

Muscle Relaxants: Cyclobenzaprine/环苯扎林, Methocarbamol (Robaxin)/美索巴莫片

Osteoporosis: Denosumab (Prolia)/保骼丽, Alendronate (Fosamax)/阿仑膦酸钠（福善美）, Reclast (Zoledronic acid)/唑来膦酸

Parkinson: Ropinirole (Requip)/力必平

Seizure: Carbamazepine (Tegretol)/卡马西平, Keppra (Levetiracetam)/左乙拉西坦, Gabapentin/加巴喷丁, Lamotrigine (Lamictal)/拉莫三嗪, Phenytoin (Dilantin)/苯妥英钠, Topiramate (Topamax)/托吡酯, Valproic acid (Depakote)/丙戊酸

Supplements: Coenzyme Q10/辅酶Q10, Lutein/叶黄素, turmeric/姜黄素, Calcium carbonate/碳酸钙

Sleep: Ambien (Zolpidem)/唑吡坦, melatonin/褪黑激素, Trazodone/曲唑酮, Temazepam (Restoril)/替马西泮

Thyroid: Levothyroxine (Synthroid)/左甲状腺素（优甲乐）, Methimazole/甲硫咪唑, propylthiouracil (PTU)/丙硫氧嘧啶

Transplant: Cyclosporine/环孢素, Tacrolimus/他克莫司

TB: Rifampin/利福平, Isoniazid/异烟肼

Vaccines: Pfizer/辉瑞, Moderna/莫德纳, BCG/卡介苗, HB/乙肝疫苗, Tdap/百白破, MMR/麻腮风, Pentacel/五联疫苗

Water Pills: Lasix (furosemide)/呋塞米, Bumex (Bumetanide)/布美他尼, Demadex (Torsemide)/托拉塞米

Yeast Infection: Fluconazole (Diflucan)/氟康唑, Monistat (miconazole)/硝酸咪康唑

Medical Categories: Analgesics/镇痛药, Antineoplastic/抗肿瘤药物, PPIs/质子泵抑制剂, NSAIDs/非激素类抗炎药, Bisphosphonates/双膦酸盐, Psychotropic agents/精神药物
`;

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

MEDICAL TERMINOLOGY REFERENCE:
${MEDICAL_TERMINOLOGY_REFERENCE}

CRITICAL REQUIREMENTS:
1. PRESERVE THE ORIGINAL LANGUAGE - If the text is in Chinese, respond in Chinese. If Spanish, respond in Spanish. NEVER translate to English.
2. BE CONSERVATIVE - Only make corrections when you are absolutely certain. Prefer leaving text unchanged over making incorrect changes.
3. PRESERVE SENTENCE STRUCTURE - Do NOT restructure sentences or change word order unless absolutely necessary for medical accuracy.
4. PRESERVE NATURAL SPEECH PATTERNS - Keep the speaker's conversational tone, cultural expressions, and natural language flow.
5. USE THE TERMINOLOGY REFERENCE - When you hear mispronounced versions of the medical terms listed above, correct them to the proper spelling/format. For example:
   - "me nox i dil" → "Minoxidil" 
   - "米诺地尔" when mispronounced → "米诺地尔"
   - "met for min" → "metformin"
   - "lie sin oh pril" → "lisinopril"
   - "阿莫西林" when unclear → "阿莫西林"
6. MINIMAL MEDICAL CORRECTIONS ONLY:
   - Fix obvious medical terminology errors using the reference list
   - Correct clear medication name errors using proper spellings from reference
   - Fix anatomical term pronunciation errors
   - Correct medical procedure names only when clearly mispronounced
7. ADD BASIC PUNCTUATION - Add periods, commas, question marks, and exclamation points where natural, but do not add quotation marks.
8. MEDICAL INTERPRETER CONTEXT - Recognize that medical interpreters commonly:
   - State their ID numbers at the beginning ("This is interpreter 12345")
   - Ask "What can I do for you?" or "How can I help you?"
   - Use professional but conversational language
   - Switch between languages naturally
9. LEAVE UNCHANGED:
   - Non-medical content
   - Proper names and personal information
   - Natural speech patterns and filler words
   - Cultural expressions and idioms
   - Uncertain pronunciations

EXAMPLES OF APPROPRIATE CORRECTIONS:
- "high per tension" → "hypertension" (clear medical term)
- "me nox i dil" → "Minoxidil" (using reference list)
- "阿莫西 林" → "阿莫西林" (using Chinese reference)
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