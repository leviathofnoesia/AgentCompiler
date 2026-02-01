/**
 * LLM Integration
 * Handles API calls to various AI model providers
 */

import { LLMConfig, LLMResponse, LLMError, LLMProvider } from './index.js';
import { getLLMProvider, validateLLMConfig } from './index.js';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { DetectedSkill } from '../scanner/index.js';

export interface LLMClient {
    generateCode(prompt: string, context?: string): Promise<LLMResponse>;
    testConnection(): Promise<boolean>;
}

export class OpenAIClient implements LLMClient {
    private apiKey: string;
    private model: string;

    constructor(apiKey: string, model: string = 'gpt-4o') {
        this.apiKey = apiKey;
        this.model = model;
    }

    async generateCode(prompt: string, context?: string): Promise<LLMResponse> {
        const { default: OpenAI } = await import('openai');
        const openai = new OpenAI({ apiKey: this.apiKey });

        const messages: any[] = [
            { role: 'system', content: context || 'You are an expert developer. Generate only code, no explanations.' },
            { role: 'user', content: prompt },
        ];

        const response = await openai.chat.completions.create({
            model: this.model,
            messages,
            max_tokens: 2000,
            temperature: 0.1,
        });

        return {
            content: response.choices[0]?.message?.content || '',
            usage: {
                promptTokens: response.usage?.prompt_tokens || 0,
                completionTokens: response.usage?.completion_tokens || 0,
                totalTokens: response.usage?.total_tokens || 0,
            },
            model: this.model,
        };
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.generateCode('test');
            return true;
        } catch {
            return false;
        }
    }
}

export class AnthropicClient implements LLMClient {
    private apiKey: string;
    private model: string;

    constructor(apiKey: string, model: string = 'claude-3-5-sonnet-20241022') {
        this.apiKey = apiKey;
        this.model = model;
    }

    async generateCode(prompt: string, context?: string): Promise<LLMResponse> {
        const { default: Anthropic } = await import('@anthropic-ai/sdk');
        const anthropic = new Anthropic({ apiKey: this.apiKey });

        const messages: any[] = [
            { role: 'user', content: context ? `${context}\n\n${prompt}` : prompt },
        ];

        const response = await anthropic.messages.create({
            model: this.model,
            max_tokens: 2000,
            temperature: 0.1,
            messages,
        });

        // Handle content blocks
        let content = '';
        if (Array.isArray(response.content)) {
            const textBlock = response.content.find(b => b.type === 'text');
            if (textBlock && 'text' in textBlock) {
                content = textBlock.text;
            }
        }

        return {
            content,
            usage: {
                promptTokens: response.usage?.input_tokens || 0,
                completionTokens: response.usage?.output_tokens || 0,
                totalTokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
            },
            model: this.model,
        };
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.generateCode('test');
            return true;
        } catch {
            return false;
        }
    }
}

export class GoogleClient implements LLMClient {
    private apiKey: string;
    private model: string;

    constructor(apiKey: string, model: string = 'gemini-1.5-pro') {
        this.apiKey = apiKey;
        this.model = model;
    }

    async generateCode(prompt: string, context?: string): Promise<LLMResponse> {
        const { default: GoogleGenerativeAI } = await import('@google/generative-ai');
        // @ts-ignore
        const genAI = new GoogleGenerativeAI.GoogleGenerativeAI(this.apiKey);
        const model = genAI.getGenerativeModel({ model: this.model });

        const fullPrompt = context ? `${context}\n\n${prompt}` : prompt;
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;

        return {
            content: response.text(),
            usage: {
                promptTokens: response.usageMetadata?.promptTokenCount || 0,
                completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
                totalTokens: response.usageMetadata?.totalTokenCount || 0,
            },
            model: this.model,
        };
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.generateCode('test');
            return true;
        } catch {
            return false;
        }
    }
}

export class MistralClient implements LLMClient {
    private apiKey: string;
    private model: string;

    constructor(apiKey: string, model: string = 'mistral-large-latest') {
        this.apiKey = apiKey;
        this.model = model;
    }

    async generateCode(prompt: string, context?: string): Promise<LLMResponse> {
        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.model,
                messages: [
                    { role: 'system', content: context || 'You are an expert developer. Generate only code, no explanations.' },
                    { role: 'user', content: prompt },
                ],
                max_tokens: 2000,
                temperature: 0.1,
            }),
        });

        const data: any = await response.json();
        
        return {
            content: data.choices?.[0]?.message?.content || '',
            usage: {
                promptTokens: data.usage?.prompt_tokens || 0,
                completionTokens: data.usage?.completion_tokens || 0,
                totalTokens: data.usage?.total_tokens || 0,
            },
            model: this.model,
        };
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.generateCode('test');
            return true;
        } catch {
            return false;
        }
    }
}

export class OllamaClient implements LLMClient {
    private model: string;
    private apiEndpoint: string;

    constructor(model: string = 'llama3.1', apiEndpoint: string = 'http://localhost:11434/api/chat') {
        this.model = model;
        this.apiEndpoint = apiEndpoint;
    }

    async generateCode(prompt: string, context?: string): Promise<LLMResponse> {
        const response = await fetch(this.apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: this.model,
                messages: [
                    { role: 'system', content: context || 'You are an expert developer. Generate only code, no explanations.' },
                    { role: 'user', content: prompt },
                ],
                stream: false,
                options: {
                    temperature: 0.1,
                },
            }),
        });

        const data: any = await response.json();
        return {
            content: data.message?.content || '',
            model: this.model,
        };
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.generateCode('test');
            return true;
        } catch {
            return false;
        }
    }
}

export class GroqClient implements LLMClient {
    private apiKey: string;
    private model: string;

    constructor(apiKey: string, model: string = 'llama-3.1-70b-versatile') {
        this.apiKey = apiKey;
        this.model = model;
    }

    async generateCode(prompt: string, context?: string): Promise<LLMResponse> {
        const { default: Groq } = await import('groq-sdk');
        const groq = new Groq({ apiKey: this.apiKey });

        const messages: any[] = [
            { role: 'system', content: context || 'You are an expert developer. Generate only code, no explanations.' },
            { role: 'user', content: prompt },
        ];

        const response = await groq.chat.completions.create({
            model: this.model,
            messages,
            max_tokens: 2000,
            temperature: 0.1,
        });

        return {
            content: response.choices[0]?.message?.content || '',
            usage: {
                promptTokens: response.usage?.prompt_tokens || 0,
                completionTokens: response.usage?.completion_tokens || 0,
                totalTokens: response.usage?.total_tokens || 0,
            },
            model: this.model,
        };
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.generateCode('test');
            return true;
        } catch {
            return false;
        }
    }
}

export class PerplexityClient implements LLMClient {
    private apiKey: string;
    private model: string;

    constructor(apiKey: string, model: string = 'llama-3.1-sonar-large-128k-chat') {
        this.apiKey = apiKey;
        this.model = model;
    }

    async generateCode(prompt: string, context?: string): Promise<LLMResponse> {
        const response = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.model,
                messages: [
                    { role: 'system', content: context || 'You are an expert developer. Generate only code, no explanations.' },
                    { role: 'user', content: prompt },
                ],
                max_tokens: 2000,
                temperature: 0.1,
            }),
        });

        const data: any = await response.json();
        return {
            content: data.choices[0]?.message?.content || '',
            usage: {
                promptTokens: data.usage?.prompt_tokens || 0,
                completionTokens: data.usage?.completion_tokens || 0,
                totalTokens: data.usage?.total_tokens || 0,
            },
            model: this.model,
        };
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.generateCode('test');
            return true;
        } catch {
            return false;
        }
    }
}

export async function createLLMClient(config: LLMConfig): Promise<LLMClient> {
    await validateLLMConfig(config);

    switch (config.provider) {
        case 'openai':
            return new OpenAIClient(config.apiKey!, config.model);
        case 'anthropic':
            return new AnthropicClient(config.apiKey!, config.model);
        case 'google':
            return new GoogleClient(config.apiKey!, config.model);
        case 'mistral':
            return new MistralClient(config.apiKey!, config.model);
        case 'ollama':
            return new OllamaClient(config.model);
        case 'groq':
            return new GroqClient(config.apiKey!, config.model);
        case 'perplexity':
            return new PerplexityClient(config.apiKey!, config.model);
        default:
            throw new Error(`Unsupported provider: ${config.provider}`);
    }
}

export async function testLLMConnection(config: LLMConfig): Promise<boolean> {
    const client = await createLLMClient(config);
    return client.testConnection();
}