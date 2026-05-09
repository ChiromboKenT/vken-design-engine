import { createHmac, timingSafeEqual } from 'node:crypto';

export interface SignableKbRule {
  id: string;
  finding_type?: string;
  findingType?: string;
  rule_text?: string;
  ruleText?: string;
  created_at?: number;
  createdAt?: number;
}

export function kbSigningKey(): string {
  return process.env.VKEN_KB_SIGNING_KEY || 'vken-dev-signing-key';
}

export function canonicalRule(rule: SignableKbRule): string {
  return [
    rule.id,
    rule.finding_type ?? rule.findingType ?? '',
    rule.rule_text ?? rule.ruleText ?? '',
    String(rule.created_at ?? rule.createdAt ?? 0),
  ].join('|');
}

export function signKbRule(rule: SignableKbRule, key = kbSigningKey()): string {
  return createHmac('sha256', key).update(canonicalRule(rule)).digest('hex');
}

export function verifyKbRule(rule: SignableKbRule & { signature?: string }, key = kbSigningKey()): boolean {
  if (!rule.signature) return false;
  const expected = Buffer.from(signKbRule(rule, key), 'hex');
  const actual = Buffer.from(rule.signature, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
