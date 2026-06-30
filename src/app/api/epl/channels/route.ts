/**
 * GET  /api/epl/channels  — mirrored agent Slack channels (recent messages) for
 *                           the Channels page.
 * POST /api/epl/channels  — store the latest mirror (x-api-key auth).
 *
 * MC's Slack bot is write-only, so instead of MC pulling from Slack, a scheduled
 * reader (channels-mirror task) reads each agent's channel and POSTs the recent
 * messages here. Stored at <dataDir>/agent_channels.json. Honest empty state
 * until first post. Same decoupled pattern as /api/epl/sofia-brief.
 */

import { NextRequest, NextResponse } from 'next/server'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { config } from '@/lib/config'

const STORE = path.join(config.dataDir, 'agent_channels.json')

interface ChannelMsg { ts: string; author: string; text: string }
interface ChannelMirror {
  key: string
  agent: string
  channelName: string
  channelId?: string
  messages: ChannelMsg[]
  updatedAt: string
}
interface Stored { updatedAt: string; channels: ChannelMirror[] }

export async function GET() {
  if (!existsSync(STORE)) {
    return NextResponse.json({ source: 'empty', updatedAt: null, channels: [], note: 'No channels mirrored yet.' })
  }
  try {
    const data = JSON.parse(readFileSync(STORE, 'utf8')) as Stored
    return NextResponse.json({ source: 'stored', ...data })
  } catch (e) {
    return NextResponse.json({ source: 'error', channels: [], error: e instanceof Error ? e.message : 'unknown' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const configured = (process.env.API_KEY || '').trim()
  const provided = (req.headers.get('x-api-key') || '').trim()
  if (!configured || provided !== configured) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  let body: { channels?: ChannelMirror[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 })
  }
  if (!Array.isArray(body.channels)) {
    return NextResponse.json({ error: 'channels (array) is required' }, { status: 400 })
  }
  const stored: Stored = { updatedAt: new Date().toISOString(), channels: body.channels }
  try {
    writeFileSync(STORE, JSON.stringify(stored, null, 2), 'utf8')
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'write failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, channels: stored.channels.length })
}
