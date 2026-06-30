'use client'

/**
 * Entities Panel — the four-company group structure.
 *
 * Surfaces EPL / Urban Ready / Staylio / NourNest as first-class objects:
 * identity, role, rules & boundaries (prohibited activities, who-signs-with,
 * dependency rules) and the inter-company R2R supply-chain map.
 *
 * v1 data is the canonical structure (memory: reference_four_company_structure_v1).
 * SINGLE SOURCE OF TRUTH = the Entity Registry sheet
 * (1UnU4TdSKqgmR0NbXyscrBHSj_6yqKZQum7Qyn4i1vhE). TODO: replace the static
 * STRUCTURE below with a live feed via an Atlas export to /atlas-data
 * (same pattern as mc_agents_manifest.json), so this never drifts from the sheet.
 * Finance (per-entity Xero P&L) + cash (Cleo) layers wire in later — see
 * MC tasks AGENT-023 / AGENT-024 and EA-081.
 */

import { useState } from 'react'

interface Entity {
  key: string
  name: string
  legal: string
  coNumber: string
  director: string
  accountant: string
  vat: string
  layer: string
  accent: string
  role: string
  does: string[]
  mustNot: string[]
  signsWith: string
  dependency: string
}

// Canonical 4-active-company structure (30 Jun 2026). GMKK + Personal excluded.
const STRUCTURE: Entity[] = [
  {
    key: 'epl',
    name: 'EPL',
    legal: 'London Elite Rental Management Ltd',
    coNumber: '15197659',
    director: 'Gerda Micke (100%)',
    accountant: 'Tax Express (Donara)',
    vat: 'VAT-exempt (residential rent)',
    layer: 'Leaseholder',
    accent: '#3b82f6',
    role: 'Signs headleases with landlords, pays rent, long-term corporate licensing. Principal vs landlords only.',
    does: ['Headleases with landlords', 'Pays landlord rent', 'Long-term B2B licensing'],
    mustNot: ['No short lets', 'No OTA presence', 'No furnishing / cleaning', 'No guest pricing or comms'],
    signsWith: 'Landlords, Urban Ready',
    dependency: 'Must hold multiple landlord contracts; recharges landlord rent onward to Urban Ready.',
  },
  {
    key: 'ur',
    name: 'Urban Ready',
    legal: 'Urban Residential Services Ltd',
    coNumber: '16964587',
    director: 'Lukasz Kukulski (100%)',
    accountant: 'XPlus London (Abdul)',
    vat: 'VAT-exempt (services only)',
    layer: 'Wholesaler / readiness',
    accent: '#f59e0b',
    role: 'Sources units, furnishes / fits out, manages utilities, cleaning & operational readiness. Fixed-price B2B supply.',
    does: ['Furnishes & fits out units', 'Utilities, council tax, cleaning', 'Operational readiness'],
    mustNot: ['No guest contact', 'No OTA listings', 'No headleases', 'Never principal to guests'],
    signsWith: 'EPL, Staylio, property suppliers',
    dependency: 'Must supply multiple operators; needs ≥2 external B2B clients.',
  },
  {
    key: 'staylio',
    name: 'Staylio',
    legal: 'Staylio Limited',
    coNumber: '17012831',
    director: 'Kris Kamasinski (→100%)',
    accountant: 'DNS Tax (Owais)',
    vat: 'VAT-registered · TOMS margin',
    layer: 'OTA operator',
    accent: '#10b981',
    role: 'Lists on Airbnb / Booking, sets nightly pricing, merchant of record, guest support. Principal vs the guest. The only brand guests see.',
    does: ['OTA listings & channel mgmt', 'Nightly pricing', 'Guest support · merchant of record'],
    mustNot: ['No landlord contracts', 'No direct cleaning contracts', 'Cannot alter property', 'No itemised extras'],
    signsWith: 'Guests, OTAs, direct bookers',
    dependency: 'Must source from multiple suppliers; needs ≥2 independent supply sources. Pays supply cost upstream.',
  },
  {
    key: 'nournest',
    name: 'NourNest',
    legal: 'NourNest Ltd',
    coNumber: '16629708',
    director: 'Gerda Micke (100%)',
    accountant: 'Tax Express',
    vat: 'Standard VAT (0% if <£90k)',
    layer: 'Management & concierge',
    accent: '#a855f7',
    role: 'Signs management agreements with 3rd-party owners, operates their flats on OTAs / direct, optional concierge. Ring-fenced from the R2R chain.',
    does: ['Manages 3rd-party owners’ flats', 'OTA + direct operations', 'Optional concierge'],
    mustNot: ['No leaseholding for R2R', 'No part in EPL/UR/Staylio chain', 'Separate bank & brand from Staylio'],
    signsWith: 'Property owners, guests, concierge providers',
    dependency: 'Separate portfolio, independent of R2R; needs ≥2 unrelated landlords.',
  },
]

function Chip({ label, tone }: { label: string; tone: 'bad' | 'ok' | 'muted' }) {
  const cls =
    tone === 'bad'
      ? 'bg-red-500/10 text-red-600 border-red-500/20'
      : tone === 'ok'
      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
      : 'bg-muted text-muted-foreground border-border'
  return <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>
}

function FlowMap() {
  const step = (label: string, sub: string, color: string) => (
    <div className="flex flex-col items-center text-center min-w-[92px]">
      <div className="px-3 py-2 rounded-lg border border-border bg-card text-xs font-semibold" style={{ color }}>{label}</div>
      <div className="text-[10px] text-muted-foreground mt-1 leading-tight">{sub}</div>
    </div>
  )
  const arrow = <div className="text-muted-foreground text-lg px-1 self-start mt-2">→</div>
  return (
    <div className="rounded-lg border border-border bg-card p-4 mb-5">
      <div className="text-xs font-semibold text-muted-foreground mb-3">RENT-TO-RENT SUPPLY CHAIN</div>
      <div className="flex flex-wrap items-center gap-1">
        {step('Landlord', 'owns flat', '#64748b')}
        {arrow}
        {step('EPL', 'headlease · rent', '#3b82f6')}
        {arrow}
        {step('Urban Ready', 'furnish · B2B supply', '#f59e0b')}
        {arrow}
        {step('Staylio', 'OTA · merchant', '#10b981')}
        {arrow}
        {step('Guest', 'books stay', '#64748b')}
      </div>
      <div className="mt-4 pt-3 border-t border-border flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="px-2 py-1 rounded-lg border border-purple-500/30 text-purple-600 font-semibold">NourNest</span>
        <span>— ring-fenced management arm. Manages independent 3rd-party owners’ flats. <strong>Must not</strong> touch the chain above.</span>
      </div>
    </div>
  )
}

export function EntitiesPanel() {
  const [open, setOpen] = useState<string | null>('epl')
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Entities</h1>
        <p className="text-sm text-muted-foreground">The four-company group structure — roles, rules &amp; boundaries. Identity from the Entity Registry; finance (Xero) &amp; cash (Cleo) layers wiring next.</p>
      </div>

      <FlowMap />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {STRUCTURE.map((e) => {
          const isOpen = open === e.key
          return (
            <div key={e.key} className="rounded-lg border border-border bg-card overflow-hidden">
              <button
                onClick={() => setOpen(isOpen ? null : e.key)}
                className="w-full text-left p-4 flex items-start justify-between gap-3 hover:bg-muted/40 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: e.accent }} />
                    <span className="font-semibold text-base">{e.name}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">{e.layer}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{e.legal} · Co. {e.coNumber}</div>
                </div>
                <span className="text-muted-foreground text-sm mt-1">{isOpen ? '−' : '+'}</span>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 space-y-3">
                  <p className="text-sm">{e.role}</p>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div><span className="text-muted-foreground">Director:</span> {e.director}</div>
                    <div><span className="text-muted-foreground">Accountant:</span> {e.accountant}</div>
                    <div className="col-span-2"><span className="text-muted-foreground">VAT:</span> {e.vat}</div>
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold text-muted-foreground mb-1">DOES</div>
                    <div className="flex flex-wrap gap-1.5">{e.does.map((d) => <Chip key={d} label={d} tone="ok" />)}</div>
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold text-muted-foreground mb-1">MUST NOT</div>
                    <div className="flex flex-wrap gap-1.5">{e.mustNot.map((d) => <Chip key={d} label={d} tone="bad" />)}</div>
                  </div>

                  <div className="grid grid-cols-1 gap-1 text-xs pt-1 border-t border-border">
                    <div><span className="text-muted-foreground">Signs with:</span> {e.signsWith}</div>
                    <div><span className="text-muted-foreground">Dependency rule:</span> {e.dependency}</div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <span className="text-[11px] px-2 py-1 rounded border border-border text-muted-foreground bg-muted/50">P&amp;L (Xero) — wiring</span>
                    <span className="text-[11px] px-2 py-1 rounded border border-border text-muted-foreground bg-muted/50">Cash (Cleo) — wiring</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-[11px] text-muted-foreground mt-5">
        Inter-company commercial terms (recharge / supply pricing) are set by Gerda — this view renders the structure, it does not set terms.
        Source of truth: Entity Registry sheet. Static snapshot v1; live registry sync to follow.
      </p>
    </div>
  )
}
