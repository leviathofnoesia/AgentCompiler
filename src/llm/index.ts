/**
 * LLM Provider Interface
 * Supports multiple AI model providers with unified API
 */

import { DetectedSkill } from '../scanner/index.js';

export interface LLMProvider {
    name: string;
    displayName: string;
    models: string[];
    apiKeyEnv: string;
    apiEndpoint?: string;
    requiresApiKey: boolean;
}

export interface LLMConfig {
    provider: string;
    model: string;
    apiKey?: string;
    temperature?: number;
    maxTokens?: number;
}

export interface LLMResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    model?: string;
}

export interface LLMError {
    code: string;
    message: string;
    details?: any;
}

export const PROVIDERS: Record<string, LLMProvider> = {
    openai: {
        name: 'openai',
        displayName: 'OpenAI',
        models: ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
        apiKeyEnv: 'OPENAI_API_KEY',
        requiresApiKey: true,
    },
    anthropic: {
        name: 'anthropic',
        displayName: 'Anthropic',
        models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
        apiKeyEnv: 'ANTHROPIC_API_KEY',
        requiresApiKey: true,
    },
    google: {
        name: 'google',
        displayName: 'Google',
        models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'],
        apiKeyEnv: 'GOOGLE_API_KEY',
        apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
        requiresApiKey: true,
    },
    mistral: {
        name: 'mistral',
        displayName: 'Mistral',
        models: ['mistral-large-latest', 'mistral-small-latest', 'mistral-medium-latest'],
        apiKeyEnv: 'MISTRAL_API_KEY',
        requiresApiKey: true,
    },
    ollama: {
        name: 'ollama',
        displayName: 'Ollama',
        models: ['llama3.1', 'mistral', 'codellama', 'gemma2', 'mixtral'],
        apiKeyEnv: '',
        apiEndpoint: 'http://localhost:11434/api/chat',
        requiresApiKey: false,
    },
    groq: {
        name: 'groq',
        displayName: 'Groq',
        models: ['llama-3.1-70b-versatile', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
        apiKeyEnv: 'GROQ_API_KEY',
        requiresApiKey: true,
    },
    perplexity: {
        name: 'perplexity',
        displayName: 'Perplexity',
        models: ['llama-3.1-sonar-large-128k-chat', 'sonar-small-chat'],
        apiKeyEnv: 'PERPLEXITY_API_KEY',
        requiresApiKey: true,
    },
};

export async function getLLMProvider(providerName: string): Promise<LLMProvider> {
    const provider = PROVIDERS[providerName];
    if (!provider) {
        throw new Error(`Unsupported provider: ${providerName}`);
    }
    return provider;
}

export async function listAvailableProviders(): Promise<LLMProvider[]> {
    return Object.values(PROVIDERS);
}

export async function validateLLMConfig(config: LLMConfig): Promise<void> {
    const provider = await getLLMProvider(config.provider);
    
    if (provider.requiresApiKey && !config.apiKey) {
        const apiKey = process.env[provider.apiKeyEnv];
        if (!apiKey) {
            throw new Error(`API key required for ${provider.displayName}. Set ${provider.apiKeyEnv} environment variable.`);
        }
    }

    if (!provider.models.includes(config.model)) {
        throw new Error(`Model ${config.model} not available for ${provider.displayName}`);
    }
}

export function getDefaultModel(provider: string): string {
    const providerData = PROVIDERS[provider];
    return providerData?.models[0] || 'gpt-4o';
}