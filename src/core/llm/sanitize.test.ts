import { describe, expect, test } from "vitest";
import { sanitizeText } from "./sanitize";

describe("sanitizeText", () => {
  test("leaves clean architecture text untouched", () => {
    const input = "订单服务通过 Kafka 异步通知库存服务，QPS 峰值 5000。";
    const result = sanitizeText(input);
    expect(result.text).toBe(input);
    expect(result.hits).toEqual([]);
  });

  test("masks api keys", () => {
    const result = sanitizeText("we call openai with sk-abc123def456ghi789jkl in prod");
    expect(result.text).not.toContain("sk-abc123def456ghi789jkl");
    expect(result.text).toContain("[REDACTED:api_key]");
    expect(result.hits).toContain("api_key");
  });

  test("masks private key blocks", () => {
    const pem = "-----BEGIN RSA PRIVATE KEY-----\nMIIEow\n-----END RSA PRIVATE KEY-----";
    const result = sanitizeText(`config:\n${pem}\nend`);
    expect(result.text).not.toContain("MIIEow");
    expect(result.hits).toContain("private_key");
  });

  test("masks internal ips but keeps public ips", () => {
    const result = sanitizeText("db at 10.2.3.4, cdn at 8.8.8.8, lan 192.168.1.10");
    expect(result.text).not.toContain("10.2.3.4");
    expect(result.text).not.toContain("192.168.1.10");
    expect(result.text).toContain("8.8.8.8");
    expect(result.hits).toEqual(["internal_ip"]);
  });

  test("masks secret assignments while keeping the key name", () => {
    const result = sanitizeText("password = SuperSecret123!");
    expect(result.text).toContain("password");
    expect(result.text).not.toContain("SuperSecret123!");
    expect(result.hits).toContain("secret_assignment");
  });

  test("masks emails and cn mobile numbers", () => {
    const result = sanitizeText("联系 ops@example.com 或 13812345678");
    expect(result.text).not.toContain("ops@example.com");
    expect(result.text).not.toContain("13812345678");
    expect(result.hits).toEqual(expect.arrayContaining(["email", "cn_mobile"]));
  });
});
