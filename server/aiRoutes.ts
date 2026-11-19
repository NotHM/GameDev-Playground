import { Router, Request, Response } from 'express';
import { GoogleGenAI, ThinkingLevel, GenerateContentResponse } from '@google/genai';

export const aiRouter = Router();

function getGenAIClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// High-Thinking Strategy & NPC Dialog Endpoint using gemini-4-argon + ThinkingLevel.HIGH
aiRouter.post('/strategy', async (req: Request, res: Response) => {
  const { personaId, gameType, boardOrHandState, question } = req.body || {};

  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
    res.status(503).json({
      error: 'GEMINI_API_KEY is not configured. Using local tactical heuristic engine.',
    });
    return;
  }

  try {
    const ai = getGenAIClient();
    const systemInstruction =
      `You are ${personaId || 'Grandmaster Kaspar'}, an elite tactical advisor inside the AetherDeck GamePlayer ecosystem. ` +
      `Analyze the exact ${gameType || 'game'} state and provide a concise, actionable 3-bullet strategic recommendation ` +
      `covering expected value, positional threats, and the optimal next move. Keep response under 130 words.`;

    const prompt = `Game Mode: ${gameType}\nCurrent State: ${boardOrHandState}\nPlayer Query: ${question || 'What is the optimal play from this state?'}`;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-4-argon',
      contents: prompt,
      config: {
        systemInstruction,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH,
        },
      },
    });

    const replyText = response.text ?? 'Maintain positional discipline and protect your stack.';
    res.json({
      reply: replyText,
      thinkingSummary: 'Deep game-tree evaluation completed with gemini-4-argon (ThinkingLevel.HIGH).',
      modelUsed: 'gemini-4-argon',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      error: message,
    });
  }
});

// Lyria 3 Music Generation Endpoint (lyria-3-clip-preview for 30s clips, lyria-3-pro-preview for full tracks)
aiRouter.post('/music', async (req: Request, res: Response) => {
  const { prompt, durationMode } = req.body || {};
  const selectedModel = durationMode === 'full' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview';
  const musicPrompt =
    typeof prompt === 'string' && prompt.trim()
      ? prompt.trim()
      : 'Generate a 30-second atmospheric synthwave and acoustic lounge casino card table soundtrack.';

  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
    res.status(503).json({
      error: 'A billing-enabled Gemini API key is required for Lyria 3 music generation. Switched to built-in Web Audio synth track.',
    });
    return;
  }

  try {
    const ai = getGenAIClient();
    const response = await ai.models.generateContentStream({
      model: selectedModel,
      contents: musicPrompt,
    });

    const audioChunks: Buffer[] = [];
    let lyrics = '';
    let mimeType = 'audio/mpeg';

    for await (const chunk of response) {
      const parts = chunk.candidates?.[0]?.content?.parts;
      if (!parts) continue;
      for (const part of parts) {
        if (part.inlineData?.data) {
          if (audioChunks.length === 0 && part.inlineData.mimeType) {
            mimeType = part.inlineData.mimeType;
          }
          audioChunks.push(Buffer.from(part.inlineData.data, 'base64'));
        }
        if (part.text) {
          lyrics += part.text;
        }
      }
    }

    if (audioChunks.length === 0) {
      res.status(502).json({
        error: 'No audio stream returned from Lyria model. Using procedural Web Audio synth.',
      });
      return;
    }

    const audioBase64 = Buffer.concat(audioChunks).toString('base64');
    const audioDataUrl = `data:${mimeType};base64,${audioBase64}`;

    res.json({
      audioDataUrl,
      lyrics: lyrics.trim() || 'Instrumental Arcade & Lounge Track',
      model: selectedModel,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      error: message,
    });
  }
});
