import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import styles from '../styles/Home.module.css';

interface TranscriptResult {
  transcript: string;
  is_final: boolean;
  timestamp: number;
  language?: string;
  confidence?: number;
}

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptResult[]>([]);
  const [currentInterim, setCurrentInterim] = useState('');
  const [currentLanguage, setCurrentLanguage] = useState<string>('');
  const [detectedLanguages, setDetectedLanguages] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'es' | 'zh'>('en');
  
  const mediaRecorderRef = useRef<any>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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

  const startRecording = async () => {
    try {
      setError(null);
      
      // Get API credentials from our secure backend
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to get Deepgram credentials');
      }
      
      const { apiKey, websocketUrl } = await response.json();
      
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
      
      // Create WebSocket connection with Nova-2 (confirmed Chinese support)
      const wsParams = new URLSearchParams({
        model: 'nova-2', // Nova-2 confirmed to support Chinese (Nova-3 does NOT)
        language: selectedLanguage, // Use user-selected language for better quality
        smart_format: 'true',
        punctuate: 'true',
        interim_results: 'true',
        encoding: 'linear16',
        sample_rate: audioContext.sampleRate.toString(),
        channels: '1',
        endpointing: '2000', // Wait 2 seconds before finalizing (creates longer segments)
        vad_events: 'true' // Voice activity detection for better language switching
      });
      
      console.log(`Using Nova-2 model with language: ${selectedLanguage}`);
      const wsUrl = `${websocketUrl}?${wsParams.toString()}`;
      console.log('Connecting to WebSocket URL:', wsUrl);
      console.log('Using API key:', apiKey.substring(0, 10) + '...');
      
      // WebSocket with proper Deepgram protocol (confirmed working)
      const ws = new WebSocket(wsUrl, ['token', apiKey]);
      
      ws.onopen = () => {
        console.log('Connected to Deepgram');
        setIsRecording(true);
        
        // Send keepalive messages every 5 seconds to maintain connection
        const keepaliveInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'KeepAlive' }));
            console.log('Sent keepalive');
          } else {
            clearInterval(keepaliveInterval);
          }
        }, 5000);
        
        // Store interval reference for cleanup
        (ws as any).keepaliveInterval = keepaliveInterval;
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('Received from Deepgram:', data); // Debug log
        
        if (data.channel?.alternatives?.[0]) {
          const transcriptText = data.channel.alternatives[0].transcript;
          const isFinal = data.is_final;
          
          // Enhanced language detection - check multiple locations
          const detectedLang = data.channel?.detected_language || 
                              data.metadata?.detected_language || 
                              data.channel?.language ||
                              data.language ||
                              (data.channel?.alternatives?.[0]?.language) ||
                              'multi';
          const confidence = data.channel?.alternatives?.[0]?.confidence || 0;
          
          // Log language info for debugging
          if (transcriptText && detectedLang !== 'multi') {
            console.log(`Text: "${transcriptText}" | Language: ${detectedLang} | Confidence: ${confidence}`);
          }
          
          // Update current language if detected (and not just 'multi')
          if (detectedLang && detectedLang !== 'multi' && detectedLang !== currentLanguage) {
            setCurrentLanguage(detectedLang);
            setDetectedLanguages(prev => new Set(prev).add(detectedLang));
            console.log('Language switched to:', detectedLang);
          }
          
          if (transcriptText) {
            if (isFinal) {
              setTranscript(prev => [...prev, {
                transcript: transcriptText,
                is_final: true,
                timestamp: Date.now(),
                language: detectedLang !== 'multi' ? detectedLang : currentLanguage || 'unknown',
                confidence: confidence
              }]);
              setCurrentInterim('');
            } else {
              setCurrentInterim(transcriptText);
            }
          }
        }
        
        // Handle metadata messages for language detection
        if (data.type === 'Metadata' && data.detected_language) {
          const detectedLang = data.detected_language;
          if (detectedLang !== currentLanguage) {
            setCurrentLanguage(detectedLang);
            setDetectedLanguages(prev => new Set(prev).add(detectedLang));
            console.log('Language detected from metadata:', detectedLang);
          }
        }
        
        // Handle VAD events (voice activity detection)
        if (data.type === 'SpeechStarted') {
          console.log('Speech started - listening for language detection');
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error details:', error);
        console.error('WebSocket readyState:', ws.readyState);
        console.error('WebSocket URL:', wsUrl);
        setError(`Connection error: ${error.type || 'Unknown error'}`);
      };
      
      ws.onclose = (event) => {
        console.log('Disconnected from Deepgram', event);
        
        // Clean up keepalive interval
        if ((ws as any).keepaliveInterval) {
          clearInterval((ws as any).keepaliveInterval);
        }
        
        setIsRecording(false);
        
        // If connection closed unexpectedly (not by user), show error
        if (event.code !== 1000 && event.code !== 1005) {
          setError(`Connection closed unexpectedly: ${event.code} - ${event.reason || 'Unknown reason'}`);
        }
      };
      
      websocketRef.current = ws;
      
      processor.onaudioprocess = (event: any) => {
        if (ws.readyState === WebSocket.OPEN) {
          const inputBuffer = event.inputBuffer;
          const inputData = inputBuffer.getChannelData(0);
          
          // Check if there's actual audio data (not just silence)
          let hasAudio = false;
          const threshold = 0.01; // Silence threshold
          for (let i = 0; i < inputData.length; i++) {
            if (Math.abs(inputData[i]) > threshold) {
              hasAudio = true;
              break;
            }
          }
          
          // Convert float32 to int16 (linear16 format)
          const int16Array = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const sample = Math.max(-1, Math.min(1, inputData[i]));
            int16Array[i] = sample * 0x7FFF;
          }
          
          // Always send audio data (even silence) to keep connection alive
          ws.send(int16Array.buffer);
          
          if (hasAudio) {
            console.log('Sending audio chunk with speech, length:', int16Array.length);
          }
        }
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      // Store references for cleanup
      mediaRecorderRef.current = { audioContext, processor, source };
      
    } catch (err) {
      console.error('Error starting recording:', err);
      setError(err instanceof Error ? err.message : 'Failed to start recording');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      const { audioContext, processor, source } = mediaRecorderRef.current;
      if (processor && source && audioContext) {
        try {
          source.disconnect();
          processor.disconnect();
          audioContext.close();
        } catch (e) {
          console.log('Error cleaning up audio context:', e);
        }
      }
    }
    
    if (websocketRef.current) {
      // Clean up keepalive interval
      if ((websocketRef.current as any).keepaliveInterval) {
        clearInterval((websocketRef.current as any).keepaliveInterval);
      }
      
      if (websocketRef.current.readyState === WebSocket.OPEN) {
        // Send close message before closing
        websocketRef.current.send(JSON.stringify({ type: 'CloseStream' }));
        websocketRef.current.close(1000, 'User stopped recording');
      }
    }
    
    setIsRecording(false);
    setCurrentInterim('');
    setCurrentLanguage('');
  };

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
              </div>
            </div>
            
            {error && (
              <div className={styles.error}>
                Error: {error}
              </div>
            )}
            
            <div className={styles.transcriptContainer}>
              {transcript.map((result, index) => (
                <div key={index} className={styles.transcriptLine}>
                  <div className={styles.transcriptHeader}>
                    <span className={styles.timestamp}>
                      {new Date(result.timestamp).toLocaleTimeString()}
                    </span>
                    {result.language && (
                      <span className={styles.languageTag}>
                        {getLanguageDisplay(result.language).flag} {getLanguageDisplay(result.language).name}
                        {result.confidence && (
                          <span className={styles.confidence}>
                            {Math.round(result.confidence * 100)}%
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  <span className={styles.transcriptText}>
                    {result.transcript}
                  </span>
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
                  Click "Start Recording" to begin transcription
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Language Detection & Analysis */}
          <div className={styles.rightPanel}>
            <div className={styles.panelHeader}>
              <h2>Language Detection</h2>
            </div>
            <div className={styles.panelContent}>
              {detectedLanguages.size > 0 ? (
                <div className={styles.languageAnalysis}>
                  <h3>Detected Languages</h3>
                  <div className={styles.languageList}>
                    {Array.from(detectedLanguages).map((lang) => (
                      <div key={lang} className={styles.languageItem}>
                        <span className={styles.languageFlag}>
                          {getLanguageDisplay(lang).flag}
                        </span>
                        <span className={styles.languageName}>
                          {getLanguageDisplay(lang).name}
                        </span>
                        {currentLanguage === lang && (
                          <span className={styles.currentLanguage}>Current</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className={styles.languageStats}>
                    <p><strong>Total Languages:</strong> {detectedLanguages.size}</p>
                    <p><strong>Current:</strong> {currentLanguage ? getLanguageDisplay(currentLanguage).name : 'None'}</p>
                  </div>
                </div>
              ) : (
                <div className={styles.placeholder}>
                  <p>🌐 Start recording to detect languages automatically</p>
                  <p>Supports: English, Chinese, Spanish, French, German, and many more!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 