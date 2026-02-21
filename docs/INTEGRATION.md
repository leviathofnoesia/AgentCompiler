# Integration Guide

## Base URL
`https://agentcompilerapi.up.railway.app`

## Core Flow
1. Register key: `POST /api/v1/auth/register`
2. Compile docs: `POST /api/v1/compile`
3. Inspect usage: `GET /api/v1/analytics/usage`

## Auth Header
`x-api-key: moltbook_...`

## Error Patterns
- `401`: invalid key
- `402`: payment required (x402 flow)
- `429`: rate limit reached
