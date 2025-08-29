import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import styles from '../styles/Home.module.css';
import { io, Socket } from 'socket.io-client';

interface TranscriptResult {
  id?: string;
  transcript: string;
  is_final: boolean;
  timestamp: number;
  language?: string;
  confidence?: number;
  originalTranscript?: string; // Store original before correction
  isCorrected?: boolean; // Flag to indicate if medical correction was applied
}

interface MedicalTermDefinition {
  term: string;
  definition: string;
  example: string;
  category: 'medication' | 'diagnosis' | 'procedure' | 'anatomy' | 'symptom' | 'other';
}

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptResult[]>([]);
  const [currentInterim, setCurrentInterim] = useState('');
  const [currentLanguage, setCurrentLanguage] = useState<string>('');
  const [detectedLanguages, setDetectedLanguages] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'es' | 'zh'>('en');
  const [lastSpeechTime, setLastSpeechTime] = useState<number>(0);
  const [medicalTerms, setMedicalTerms] = useState<MedicalTermDefinition[]>([]);
  const [isProcessingTerms, setIsProcessingTerms] = useState(false);
  const [editingTranscriptId, setEditingTranscriptId] = useState<string | null>(null);
  const [editedTranscriptText, setEditedTranscriptText] = useState('');
  
  const mediaRecorderRef = useRef<any>(null);
  const socketRef = useRef<Socket | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const termsListRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'inherit';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [editingTranscriptId]); // Run when editing starts

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedTranscriptText(e.target.value);
    e.target.style.height = 'inherit';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  // Delete individual transcript card
  const deleteTranscript = (id: string) => {
    setTranscript(prev => prev.filter(t => t.id !== id));
  };

  const mergeTranscriptUp = (id: string) => {
    setTranscript(prev => {
      const index = prev.findIndex(t => t.id === id);
      if (index <= 0) {
        return prev;
      }

      const current = prev[index];
      const previous = prev[index - 1];

      const mergedTranscript = {
        ...previous,
        transcript: `${previous.transcript} ${current.transcript}`,
        originalTranscript: `${previous.originalTranscript || previous.transcript} ${current.originalTranscript || current.transcript}`,
        timestamp: current.timestamp, // Use the timestamp of the later message
      };

      const finalTranscript = [
        ...prev.slice(0, index - 1),
        mergedTranscript,
        ...prev.slice(index + 1),
      ];

      return finalTranscript;
    });
  };

  const startEditing = (id: string, text: string) => {
    setEditingTranscriptId(id);
    setEditedTranscriptText(text);
  };

  const saveEdit = (id: string) => {
    setTranscript(prev =>
      prev.map(t =>
        t.id === id ? { ...t, transcript: editedTranscriptText } : t
      )
    );
    setEditingTranscriptId(null);
    setEditedTranscriptText('');
  };

  // Clear all transcripts
  const clearAllTranscripts = () => {
    setTranscript([]);
  };

  // Delete individual medical term
  const deleteMedicalTerm = (termToDelete: string) => {
    setMedicalTerms(prev => prev.filter(term => term.term !== termToDelete));
  };

  // Language display helper
  const getLanguageDisplay = (langCode: string) => {
    const languages: { [key: string]: { name: string; flag: string } } = {
      'en': { name: 'English', flag: '🇺🇸' },
      'en-US': { name: 'English (US)', flag: '🇺🇸' },
      'en-GB': { name: 'English (UK)', flag: '🇬🇧' },
      'zh': { name: 'Chinese', flag: '🇨🇳' },
      'zh-CN': { name: 'Chinese (Simplified)', flag: '🇨🇳' },
      'zh-TW': { name: 'Chinese (Traditional)', flag: '🇹🇼' },
      'zh-Hans': { name: 'Chinese (Simplified)', flag: '🇨🇳' },
      'zh-Hant': { name: 'Chinese (Traditional)', flag: '🇹🇼' },
      'cmn': { name: 'Mandarin Chinese', flag: '🇨🇳' },
      'es': { name: 'Spanish', flag: '🇪🇸' },
      'es-US': { name: 'Spanish (US)', flag: '🇺🇸' },
      'es-ES': { name: 'Spanish (Spain)', flag: '🇪🇸' },
      'fr': { name: 'French', flag: '🇫🇷' },
      'de': { name: 'German', flag: '🇩🇪' },
      'it': { name: 'Italian', flag: '🇮🇹' },
      'pt': { name: 'Portuguese', flag: '🇵🇹' },
      'ru': { name: 'Russian', flag: '🇷🇺' },
      'ja': { name: 'Japanese', flag: '🇯🇵' },
      'ko': { name: 'Korean', flag: '🇰🇷' },
      'ar': { name: 'Arabic', flag: '🇸🇦' },
      'hi': { name: 'Hindi', flag: '🇮🇳' }
    };
    
    return languages[langCode] || { name: langCode, flag: '🌐' };
  };

  // Extract medical terms for definitions
  const extractMedicalTerms = async (text: string, language: string) => {
    if (!text.trim()) return;

    // Common layman terms to exclude from definitions (reduced list)
    const excludeTerms = new Set([
      'medication', 'medicine', 'drug', 'pill', 'tablet',
      'patient', 'doctor', 'physician', 'nurse',
      'hospital', 'clinic', 'treatment', 'therapy',
      'health', 'medical', 'healthcare', 'prescription',
      'appointment', 'visit', 'checkup', 'test'
    ]);

    try {
      setIsProcessingTerms(true);
      
      const response = await fetch('/api/medical-definitions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          language: language
        }),
      });

      if (!response.ok) {
        console.error('Medical term extraction failed:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error details:', errorText);
        
        // Fallback: try to extract some basic terms locally
        const words = text.toLowerCase().split(/\s+/);
        const medicalKeywords = ['bacitracin', 'vaseline', 'hypertension', 'diabetes', 'insulin', 'metformin', 'lisinopril', 'atorvastatin'];
        const foundTerms = words.filter(word => medicalKeywords.includes(word));
        
        if (foundTerms.length > 0) {
          const fallbackTerms: MedicalTermDefinition[] = foundTerms.map(term => ({
            term: term,
            definition: `${term} - API unavailable, please check server logs`,
            example: `Used in medical context: "${term}"`,
            category: 'other' as const
          }));
          
          setMedicalTerms(prev => {
            const existingTerms = new Set(prev.map(t => t.term.toLowerCase()));
            const newTerms = fallbackTerms.filter(t => !existingTerms.has(t.term.toLowerCase()));
            return [...prev, ...newTerms];
          });
        }
        return;
      }

      const result = await response.json();
      console.log('Medical definitions API response:', result);
      
      if (result.definitions && result.definitions.length > 0) {
        setMedicalTerms(prev => {
          // Merge new terms with existing ones, avoiding duplicates and common terms
          const existingTerms = new Set(prev.map(term => term.term.toLowerCase()));
          const newTerms = result.definitions.filter((def: MedicalTermDefinition) => 
            !existingTerms.has(def.term.toLowerCase()) &&
            !excludeTerms.has(def.term.toLowerCase()) &&
            def.term.length > 3 // Exclude very short terms
          );
          
          console.log('Adding new medical terms:', newTerms);
          return [...prev, ...newTerms];
        });
      } else {
        console.log('No medical definitions found in response');
      }
      
    } catch (error) {
      console.error('Medical term extraction error:', error);
    } finally {
      setIsProcessingTerms(false);
    }
  };

  // Medical terminology correction function
  const correctMedicalTerminology = async (text: string, detectedLanguage?: string): Promise<string> => {
    if (!text.trim()) {
      return text;
    }

    try {
      
      // Get conversation context from recent transcripts
      const conversationContext = transcript
        .slice(-5) // Last 5 transcripts for context
        .map(t => t.isCorrected ? t.transcript : t.originalTranscript || t.transcript);

      // Always use the user-selected language for correction to maintain consistency
      const languageToUse = selectedLanguage;

      const response = await fetch('/api/medical-correction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          conversationContext: conversationContext,
          language: languageToUse
        }),
      });

      if (!response.ok) {
        console.warn('Medical correction failed, using original text');
        return text;
      }

      const result = await response.json();
      return result.correctedText || text;
      
    } catch (error) {
      console.error('Medical correction error:', error);
      return text; // Fallback to original text
    } finally {
      // Medical correction is now automatic and inherent
    }
  };

  const startRecording = async () => {
    try {
      setError(null);
      
      // Initialize Socket.IO connection
      const socket = io();
      socketRef.current = socket;

      socket.on('connect', async () => {
        console.log('Connected to server with socket ID:', socket.id);
        
        // Get user media
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          } 
        });
        
        // Use Web Audio API to process audio in the format Deepgram expects
        const audioContext = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        
        console.log('AudioContext sample rate:', audioContext.sampleRate);

        // Start the recording process on the server
        socket.emit('start-recording', {
            model: 'nova-2',
            language: selectedLanguage,
            encoding: 'linear16',
            sampleRate: audioContext.sampleRate
        });
        
        processor.onaudioprocess = (event: any) => {
            const inputBuffer = event.inputBuffer;
            const inputData = inputBuffer.getChannelData(0);
            
            const int16Array = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
                const sample = Math.max(-1, Math.min(1, inputData[i]));
                int16Array[i] = sample * 0x7FFF;
            }
            
            if (socket.connected) {
                socket.emit('audio-data', int16Array.buffer);
            }
        };
        
        source.connect(processor);
        processor.connect(audioContext.destination);
        
        // Store references for cleanup
        mediaRecorderRef.current = { audioContext, processor, source, stream };
      });
      
      socket.on('connected', () => {
        console.log('Connected to Deepgram via server');
        setIsRecording(true);
      });
      
      socket.on('transcript', (data) => {
        console.log('Received from Deepgram:', data); // Debug log
        
        if (data.channel?.alternatives?.[0]) {
          const transcriptText = data.channel.alternatives[0].transcript;
          const isFinal = data.is_final;
          
          const detectedLang = data.channel?.detected_language || 
                              data.metadata?.detected_language || 
                              data.channel?.language ||
                              data.language ||
                              (data.channel?.alternatives?.[0]?.language) ||
                              'multi';
          const confidence = data.channel?.alternatives?.[0]?.confidence || 0;
          
          if (transcriptText && detectedLang !== 'multi') {
            console.log(`Text: "${transcriptText}" | Language: ${detectedLang} | Confidence: ${confidence}`);
          }
          
          if (detectedLang && detectedLang !== 'multi' && detectedLang !== currentLanguage) {
            setCurrentLanguage(detectedLang);
            setDetectedLanguages(prev => new Set(prev).add(detectedLang));
            console.log('Language switched to:', detectedLang);
          }
          
          if (transcriptText) {
            if (isFinal) {
              const processTranscript = async () => {
                let originalText = transcriptText.trim();
                if (originalText.startsWith('"') && originalText.endsWith('"')) {
                  originalText = originalText.slice(1, -1);
                }

                const finalLanguage = detectedLang !== 'multi' ? detectedLang : currentLanguage || 'unknown';
                let correctedText = await correctMedicalTerminology(originalText, finalLanguage);
                if (correctedText.startsWith('"') && correctedText.endsWith('"')) {
                  correctedText = correctedText.slice(1, -1);
                }
                const currentTime = Date.now();
                
                console.log('Extracting medical terms from:', correctedText);
                extractMedicalTerms(correctedText, finalLanguage);
                
                setTranscript(prev => {
                  const shouldAppend = prev.length > 0 && 
                    (currentTime - prev[prev.length - 1].timestamp) < 12000 &&
                    prev[prev.length - 1].language === finalLanguage &&
                    prev[prev.length - 1].is_final &&
                    (prev[prev.length - 1].transcript.split(' ').length < 25);
                  
                  if (shouldAppend) {
                    const updated = [...prev];
                    const lastIndex = updated.length - 1;
                    const lastTranscript = updated[lastIndex];
                    
                    const combinedOriginal = `${lastTranscript.originalTranscript || lastTranscript.transcript} ${originalText}`;
                    
                    updated[lastIndex] = {
                      ...lastTranscript,
                      transcript: `${lastTranscript.transcript} ${correctedText}`,
                      originalTranscript: combinedOriginal,
                      isCorrected: (lastTranscript.isCorrected || correctedText !== originalText),
                      timestamp: currentTime,
                      confidence: Math.max(lastTranscript.confidence || 0, confidence),
                      id: lastTranscript.id
                    };
                    
                    return updated;
                  } else {
                    return [...prev, {
                      id: `transcript-${currentTime}-${Math.random().toString(36).substr(2, 9)}`,
                      transcript: correctedText,
                      originalTranscript: originalText,
                      isCorrected: correctedText !== originalText,
                      is_final: true,
                      timestamp: currentTime,
                      language: finalLanguage,
                      confidence: confidence
                    }];
                  }
                });
                
                setLastSpeechTime(currentTime);
              };
              
              processTranscript();
              setCurrentInterim('');
            } else {
              let interimText = transcriptText.trim();
              if (interimText.startsWith('"') && interimText.endsWith('"')) {
                interimText = interimText.slice(1, -1);
              }
              setCurrentInterim(interimText);
              setLastSpeechTime(Date.now());
            }
          }
        }
        
        if (data.type === 'Metadata' && data.detected_language) {
          const detectedLang = data.detected_language;
          if (detectedLang !== currentLanguage) {
            setCurrentLanguage(detectedLang);
            setDetectedLanguages(prev => new Set(prev).add(detectedLang));
            console.log('Language detected from metadata:', detectedLang);
          }
        }
        
        if (data.type === 'SpeechStarted') {
          console.log('Speech started - listening for language detection');
          setLastSpeechTime(Date.now());
        }
        
        if (data.type === 'SpeechEnded') {
          console.log('Speech ended - potential end of utterance');
        }
      });
      
      socket.on('error', (errorMessage) => {
        console.error('Socket error:', errorMessage);
        setError(`Connection error: ${errorMessage}`);
      });
      
      socket.on('disconnected', (data) => {
        console.log('Disconnected from Deepgram', data);
        setIsRecording(false);
        if (data.code !== 1000) {
            setError(`Connection closed unexpectedly: ${data.code} - ${data.reason || 'Unknown reason'}`);
        }
      });

    } catch (err) {
      console.error('Error starting recording:', err);
      setError(err instanceof Error ? err.message : 'Failed to start recording');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      const { audioContext, processor, source, stream } = mediaRecorderRef.current;
      if (processor && source && audioContext) {
        try {
          source.disconnect();
          processor.disconnect();
          audioContext.close();
        } catch (e) {
          console.log('Error cleaning up audio context:', e);
        }
      }
      if (stream) {
        stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
    }
    
    if (socketRef.current) {
        socketRef.current.emit('stop-recording');
        socketRef.current.disconnect();
        socketRef.current = null;
    }
    
    setIsRecording(false);
    setCurrentInterim('');
    setCurrentLanguage('');
    setLastSpeechTime(0);
  };

  // Auto-scroll transcript container when new transcripts are added
  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [transcript]);

  // Auto-scroll terms list when new medical terms are added
  useEffect(() => {
    if (termsListRef.current) {
      termsListRef.current.scrollTop = termsListRef.current.scrollHeight;
    }
  }, [medicalTerms]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  return (
    <div className={styles.container}>
      <Head>
        <title>Interpret Med - Real-time Transcription</title>
        <meta name="description" content="Real-time medical transcription powered by Deepgram" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Navigation Bar */}
      <nav className={styles.navbar}>
        <div className={styles.navLeft}>
          <h1 className={styles.logo}>interpret-med</h1>
        </div>
        <div className={styles.navRight}>
          <button className={styles.navButton}>Settings</button>
          <button className={styles.navButton}>Source Code</button>
          <button className={styles.navButton}>Login</button>
        </div>
      </nav>

      {/* Main Content */}
      <main className={styles.main}>
        <div className={styles.contentPanel}>
          {/* Left Panel - Transcription */}
          <div className={styles.leftPanel}>
            {/* Language Selector */}
            <div className={styles.languageSelector}>
              <div className={styles.languageSelectorLabel}>Language:</div>
              <div className={styles.languageSlider}>
                <div 
                  className={`${styles.languageOption} ${selectedLanguage === 'en' ? styles.active : ''} ${isRecording ? styles.disabled : ''}`}
                  onClick={() => !isRecording && setSelectedLanguage('en')}
                >
                  🇺🇸 EN
                </div>
                <div 
                  className={`${styles.languageOption} ${selectedLanguage === 'es' ? styles.active : ''} ${isRecording ? styles.disabled : ''}`}
                  onClick={() => !isRecording && setSelectedLanguage('es')}
                >
                  🇪🇸 ES
                </div>
                <div 
                  className={`${styles.languageOption} ${selectedLanguage === 'zh' ? styles.active : ''} ${isRecording ? styles.disabled : ''}`}
                  onClick={() => !isRecording && setSelectedLanguage('zh')}
                >
                  🇨🇳 ZH
                </div>
                <div 
                  className={styles.languageSliderIndicator}
                  style={{
                    transform: `translateX(${
                      selectedLanguage === 'en' ? '0%' : 
                      selectedLanguage === 'es' ? '100%' : '200%'
                    })`
                  }}
                />
              </div>
            </div>

            
            <div className={styles.panelHeader}>
              <h2>Live Transcription</h2>
              <div className={styles.controls}>
                {!isRecording ? (
                  <button 
                    onClick={startRecording}
                    className={styles.startButton}
                    disabled={isRecording}
                  >
                    Start Recording
                  </button>
                ) : (
                  <button 
                    onClick={stopRecording}
                    className={styles.stopButton}
                  >
                    Stop Recording
                  </button>
                )}
                {isRecording && <div className={styles.recordingIndicator}>● Recording</div>}
                {currentLanguage && (
                  <div className={styles.languageIndicator}>
                    {getLanguageDisplay(currentLanguage).flag} {getLanguageDisplay(currentLanguage).name}
                  </div>
                )}
                {transcript.length > 0 && (
                  <button 
                    onClick={clearAllTranscripts}
                    className={styles.clearButton}
                    title="Clear all transcripts"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>
            
            {error && (
              <div className={styles.error}>
                Error: {error}
              </div>
            )}
            
            <div className={styles.transcriptContainer} ref={transcriptContainerRef}>
              {transcript.map((result, index) => (
                <div key={result.id || index} className={styles.transcriptLine}>
                  <div className={styles.transcriptHeader}>
                    <span className={styles.timestamp}>
                      {new Date(result.timestamp).toLocaleTimeString()}
                    </span>
                    <div className={styles.headerRight}>
                      {result.isCorrected && (
                        <span className={styles.correctedIndicator} title={`Original: ${result.originalTranscript}`}>
                          ✅ Corrected
                        </span>
                      )}
                      {result.language && (
                        <span className={styles.languageTag}>
                          {getLanguageDisplay(result.language).flag} {getLanguageDisplay(result.language).name}
                        </span>
                      )}
                      <button 
                        onClick={() => mergeTranscriptUp(result.id || `${index}`)}
                        className={styles.mergeButton}
                        disabled={index === 0}
                        title="Merge with previous transcript"
                      >
                        Merge Up
                      </button>
                      <button 
                        onClick={() => startEditing(result.id || `${index}`, result.transcript)}
                        className={styles.editButton}
                        title="Edit this transcript"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => deleteTranscript(result.id || `${index}`)}
                        className={styles.deleteButton}
                        title="Delete this transcript"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  {editingTranscriptId === result.id ? (
                    <div>
                      <textarea
                        ref={textareaRef}
                        className={styles.editTextarea}
                        value={editedTranscriptText}
                        onChange={handleTextareaChange}
                      />
                      <button onClick={() => saveEdit(result.id!)} className={styles.saveButton}>Save</button>
                    </div>
                  ) : (
                    <span className={styles.transcriptText}>
                      {result.transcript}
                    </span>
                  )}
                </div>
              ))}
              
              {currentInterim && (
                <div className={styles.interimResult}>
                  <span className={styles.timestamp}>
                    {new Date().toLocaleTimeString()}
                  </span>
                  <span className={styles.interimText}>
                    {currentInterim}
                  </span>
                </div>
              )}
              
              {transcript.length === 0 && !currentInterim && !isRecording && (
                <div className={styles.placeholder}>
                  Click &quot;Start Recording&quot; to begin transcription
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Analysis */}
          <div className={styles.rightPanel}>
            <div className={styles.panelHeader}>
              <h2>Terminology Breakdown</h2>
            </div>
            <div className={styles.panelContent}>
              {medicalTerms.length > 0 ? (
                <div className={styles.medicalTermsAnalysis}>
                  {isProcessingTerms && (
                    <div className={styles.processingIndicator}>
                      🔍 Analyzing medical terms...
                    </div>
                  )}
                  <div className={styles.termsList} ref={termsListRef}>
                    {medicalTerms.map((term, index) => (
                      <div key={index} className={styles.termItem}>
                        <div className={styles.termHeader}>
                          <span className={styles.termName}>{term.term}</span>
                          <div className={styles.termHeaderRight}>
                            <span className={styles.termCategory}>
                              {term.category === 'medication' && '💊'}
                              {term.category === 'diagnosis' && '🩺'}
                              {term.category === 'procedure' && '🏥'}
                              {term.category === 'anatomy' && '🫀'}
                              {term.category === 'symptom' && '🤒'}
                              {term.category === 'other' && '📋'}
                              {term.category}
                            </span>
                            <button 
                              onClick={() => deleteMedicalTerm(term.term)}
                              className={styles.deleteButton}
                              title="Delete this term"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                        <div className={styles.termDefinition}>
                          <strong>Definition:</strong> {term.definition}
                        </div>
                        <div className={styles.termExample}>
                          <strong>Example:</strong> {term.example}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className={styles.termsStats}>
                    <p><strong>Terms Found:</strong> {medicalTerms.length}</p>
                    <button 
                      className={styles.clearTermsButton}
                      onClick={() => {
                        setMedicalTerms([]);
                        console.log('Medical terms cleared by user');
                      }}
                    >
                      Clear All
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.placeholder}>
                  <p>🩺 Medical terms will appear here as they&apos;re detected</p>
                  <p>Includes medications, diagnoses, procedures, and anatomical terms</p>
                  {isProcessingTerms && (
                    <p className={styles.processingText}>🔍 Analyzing transcript...</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 