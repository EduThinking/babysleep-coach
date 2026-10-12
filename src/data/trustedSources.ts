/**
 * Public-health and pediatric organizations the AI coach may cite for non-sleep
 * parenting questions. Only sentences backed by one of these domains are shown.
 * Keep this list short and authoritative; review it together with the guides.
 */
export interface TrustedSite {
  domain: string;
  name: string;
}

export const TRUSTED_SITES: TrustedSite[] = [
  { domain: "health.kdca.go.kr", name: "질병관리청 국가건강정보포털" },
  { domain: "nip.kdca.go.kr", name: "질병관리청 예방접종도우미" },
  { domain: "kdca.go.kr", name: "질병관리청" },
  { domain: "mohw.go.kr", name: "보건복지부" },
  { domain: "mfds.go.kr", name: "식품의약품안전처" },
  { domain: "childcare.go.kr", name: "임신육아종합포털 아이사랑" },
  { domain: "pediatrics.or.kr", name: "대한소아청소년과학회" },
  { domain: "healthychildren.org", name: "미국소아과학회 HealthyChildren.org" },
  { domain: "aap.org", name: "미국소아과학회(AAP)" },
  { domain: "who.int", name: "세계보건기구(WHO)" },
  { domain: "cdc.gov", name: "미국 질병통제예방센터(CDC)" },
  { domain: "nhs.uk", name: "영국 국민보건서비스(NHS)" },
];

/** Most specific match wins (health.kdca.go.kr before kdca.go.kr). */
export function matchTrustedSite(host: string | null | undefined): TrustedSite | null {
  if (!host) return null;
  const h = host.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  let best: TrustedSite | null = null;
  for (const s of TRUSTED_SITES) {
    if (h === s.domain || h.endsWith("." + s.domain)) {
      if (!best || s.domain.length > best.domain.length) best = s;
    }
  }
  return best;
}
