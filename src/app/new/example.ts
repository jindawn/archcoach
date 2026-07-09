/** 「载入示例」按钮的内置样例：让用户 10 秒内体验完整评审流程 */
export const EXAMPLE_SUBMISSION = {
  title: "电商双十一秒杀系统",
  businessContext:
    "电商平台双十一大促秒杀活动。参与秒杀的商品约 200 个 SKU，活动分多个场次，单场持续 2 小时。" +
    "预计开抢瞬间峰值 QPS 5 万，要求绝对不能超卖，可以少卖。用户在开抢前会大量刷新活动页。" +
    "团队 5 名后端工程师，有 Redis 和 Kafka 的运维经验，预算内可使用云厂商托管中间件。",
  solutionMd: `## 整体思路

流量漏斗：静态化拦截大部分读流量 → 网关限流 → Redis 原子扣减 → 异步落库。

## 分层设计

1. **前端与 CDN**：活动页全静态化并提前预热到 CDN，开抢按钮由 JS 按服务器时间点亮，减少无效请求。
2. **网关层**：令牌桶限流，超出容量的请求直接返回排队页，不进入后端。
3. **库存扣减**：库存活动开始前预热到 Redis，使用 lua 脚本原子扣减，扣减成功才允许下单。
4. **订单落库**：扣减成功后发送消息到 Kafka，订单服务异步消费，写入 MySQL 生成订单。
5. **超时回补**：用户下单后 10 分钟未支付，取消订单并回补 Redis 库存。

## 技术栈

Go + Redis + Kafka + MySQL，部署在云上，服务多实例无状态。`,
  techStack: "Go + Redis + Kafka + MySQL",
  constraints: {
    qps: "50000",
    dataVolume: "200 SKU / 单场 2 小时",
    sla: "99.95%",
    teamSize: "5",
    budget: "可使用云托管中间件",
  },
  diagramSource: `flowchart LR
  user["用户"] --> cdn["CDN 静态页"]
  user --> gw["网关（令牌桶限流）"]
  gw --> seckill["秒杀服务"]
  seckill -->|"lua 原子扣减"| redis[("Redis 库存")]
  seckill -->|"扣减成功"| mq["Kafka"]
  mq --> order["订单服务"]
  order --> db[("MySQL")]`,
};
