import {
  SALES_FUNNEL_STAGE_CODES,
  defaultProbabilityForStage,
  getStageLabel,
  normalizeLeadStage,
  normalizeOpportunityStage,
  type SalesFunnelStage,
} from '../config/sales-funnel-stages.js';
import { Leads, Opportunities, Quotations } from '../models/db.js';
import type { Lead, Opportunity } from '../types/index.js';

async function findAll<T>(collection: any, query: Record<string, unknown> = {}): Promise<T[]> {
  const result = await collection.find(query);
  if (Array.isArray(result)) return result as T[];
  return await result.toArray();
}

function resolveStageValueSync(
  leadId: string,
  stage: SalesFunnelStage,
  opportunities: Opportunity[],
  quotes: any[]
) {
  const opp = opportunities.find(item => item.leadId === leadId);
  const leadQuotes = quotes
    .filter(quote => quote.leadId === leadId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (stage === 'Quotation') {
    const latestQuote = leadQuotes[0];
    if (latestQuote?.totalAmount != null) return Number(latestQuote.totalAmount) || 0;
  }

  if (stage === 'Won') {
    if (normalizeOpportunityStage(opp?.stage) === 'Won' && opp?.value != null) return Number(opp.value) || 0;
    const approvedQuote = leadQuotes.find(quote => quote.status === 'Approved');
    if (approvedQuote?.totalAmount != null) return Number(approvedQuote.totalAmount) || 0;
  }

  if (opp?.value != null) return Number(opp.value) || 0;
  if (leadQuotes[0]?.totalAmount != null) return Number(leadQuotes[0].totalAmount) || 0;
  return 0;
}

export async function resolveStageValue(
  leadId: string,
  stage: SalesFunnelStage,
  opportunities: Opportunity[],
  quotes: any[]
) {
  return resolveStageValueSync(leadId, stage, opportunities, quotes);
}

export async function ensureOpportunityForLead(lead: Lead, userId: string): Promise<Opportunity | null> {
  const oppsColl = Opportunities();
  const existing = await oppsColl.findOne({ leadId: lead._id } as any);
  if (existing) return existing as Opportunity;

  const stage = normalizeLeadStage(lead.stage);
  const now = new Date();
  const created: Opportunity = {
    _id: `o_${lead._id}_${Date.now()}`,
    leadId: lead._id,
    title: `ดีล ${lead.schoolName}`,
    stage,
    value: 0,
    closeDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    assignedTo: lead.assignedTo || userId,
    probability: defaultProbabilityForStage(stage),
    quoteIds: [],
    stageHistory: [{
      toStage: stage,
      changedBy: userId,
      reason: 'Auto-created from lead stage',
      changedAt: now,
    }],
    createdAt: now,
    updatedAt: now,
  };

  await (oppsColl as any).insertOne(created);
  return created;
}

export async function syncLeadStageToOpportunity(
  lead: Lead,
  previousStage: SalesFunnelStage | string | undefined,
  userId: string,
  reason?: string
) {
  const nextStage = normalizeLeadStage(lead.stage);
  const prevStage = normalizeLeadStage(previousStage);
  if (nextStage === prevStage) return null;

  const opp = await ensureOpportunityForLead(lead, userId);
  if (!opp) return null;

  const now = new Date();
  const updatedOpp: Opportunity = {
    ...opp,
    stage: nextStage,
    assignedTo: lead.assignedTo || opp.assignedTo || userId,
    probability: defaultProbabilityForStage(nextStage),
    lostReason: nextStage === 'Lost' ? reason || opp.lostReason : undefined,
    stageHistory: [
      ...(opp.stageHistory || []),
      {
        fromStage: normalizeOpportunityStage(opp.stage),
        toStage: nextStage,
        changedBy: userId,
        reason: reason || 'Synced from lead stage',
        changedAt: now,
      },
    ],
    updatedAt: now,
  };

  await (Opportunities() as any).updateOne({ _id: opp._id }, { $set: updatedOpp });
  return updatedOpp;
}

export async function syncOpportunityStageToLead(
  opportunity: Opportunity,
  _userId: string,
  _reason?: string
) {
  const leadsColl = Leads();
  const lead = await leadsColl.findOne({ _id: opportunity.leadId } as any);
  if (!lead) return null;

  const nextStage = normalizeOpportunityStage(opportunity.stage);
  const prevStage = normalizeLeadStage(lead.stage);
  if (nextStage === prevStage) return lead as Lead;

  const updatedLead: Lead = {
    ...(lead as Lead),
    stage: nextStage,
    updatedAt: new Date(),
  };

  await (leadsColl as any).updateOne({ _id: lead._id }, { $set: updatedLead });
  return updatedLead;
}

export function buildSalesFunnelReport(
  leads: Lead[],
  opportunities: Opportunity[],
  quotes: any[]
) {
  const stageRows = SALES_FUNNEL_STAGE_CODES.map(code => {
    const stageLeads = leads.filter(lead => normalizeLeadStage(lead.stage) === code);
    const value = stageLeads.reduce(
      (sum, lead) => sum + resolveStageValueSync(lead._id, code, opportunities, quotes),
      0
    );
    return {
      code,
      label: getStageLabel(code, false),
      labelTh: getStageLabel(code, true),
      count: stageLeads.length,
      value,
      conversionToNextPercent: 0,
    };
  });

  for (let index = 0; index < stageRows.length - 1; index += 1) {
    const current = stageRows[index];
    const next = stageRows[index + 1];
    if (next.code === 'Lost') {
      current.conversionToNextPercent = 0;
      continue;
    }
    current.conversionToNextPercent = current.count > 0
      ? Math.round((next.count / current.count) * 1000) / 10
      : 0;
  }

  const pipelineValue = stageRows
    .filter(row => !['Won', 'Lost'].includes(row.code))
    .reduce((sum, row) => sum + row.value, 0);
  const wonValue = stageRows.find(row => row.code === 'Won')?.value || 0;

  return {
    stages: stageRows,
    totals: {
      leads: leads.length,
      pipelineValue,
      wonValue,
    },
  };
}

export function buildActivityBreakdown(tasks: any[], quotes: any[], opportunities: Opportunity[]) {
  const taskTypeMap: Record<string, keyof typeof taskCounts> = {
    Call: 'Call',
    Meeting: 'Meeting',
    Presentation: 'Presentation',
    Demo: 'DemoWorkshop',
    DemoWorkshop: 'DemoWorkshop',
  };

  const taskCounts = {
    Call: 0,
    Meeting: 0,
    Presentation: 0,
    DemoWorkshop: 0,
  };

  for (const task of tasks) {
    const bucket = taskTypeMap[task.type];
    if (bucket) taskCounts[bucket] += 1;
  }

  const approvedQuotes = quotes.filter(quote => quote.status === 'Approved');
  const wonOpps = opportunities.filter(opp => normalizeOpportunityStage(opp.stage) === 'Won');

  return {
    tasks: taskCounts,
    quotation: {
      count: quotes.length,
      approvedCount: approvedQuotes.length,
      approvedValue: approvedQuotes.reduce((sum, quote) => sum + Number(quote.totalAmount || 0), 0),
    },
    won: {
      count: wonOpps.length,
      value: wonOpps.reduce((sum, opp) => sum + Number(opp.value || 0), 0),
    },
  };
}

export async function preloadFunnelData() {
  const [opportunities, quotes] = await Promise.all([
    findAll<Opportunity>(Opportunities()),
    findAll<any>(Quotations()),
  ]);
  return { opportunities, quotes };
}
