/** The six-member review board of ArchCoach v1. */

export const ROLE_KEYS = [
  "chief_architect",
  "tech_architect",
  "database",
  "sre",
  "security",
  "interviewer",
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

export interface ReviewRole {
  key: RoleKey;
  name: string;
  /** short label shown on the reviewer card */
  title: string;
  /** prompt template path under /prompts */
  promptName: string;
}

export const REVIEW_ROLES: readonly ReviewRole[] = [
  {
    key: "chief_architect",
    name: "首席架构师",
    title: "整体架构合理性",
    promptName: "roles/chief-architect",
  },
  {
    key: "tech_architect",
    name: "技术架构师",
    title: "模块划分与技术选型",
    promptName: "roles/tech-architect",
  },
  { key: "database", name: "数据库专家", title: "数据模型与一致性", promptName: "roles/database" },
  { key: "sre", name: "SRE", title: "高可用与容灾", promptName: "roles/sre" },
  { key: "security", name: "安全专家", title: "认证授权与数据安全", promptName: "roles/security" },
  { key: "interviewer", name: "面试官", title: "表达与取舍陈述", promptName: "roles/interviewer" },
];

export function getRole(key: string): ReviewRole {
  const role = REVIEW_ROLES.find((r) => r.key === key);
  if (!role) throw new Error(`Unknown review role: ${key}`);
  return role;
}
