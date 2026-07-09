---
id: transfer-bad
kind: bad
expectBlocking: true
title: 钱包转账服务（缺陷方案）
techStack: Node.js + MongoDB
constraints:
  qps: 500
  sla: "99.99%"
  teamSize: 3
businessContext: 互联网钱包产品的用户间转账功能，涉及真实资金，日均 20 万笔，单笔上限 5 万元。
---
## 方案

1. 转账接口收到请求后：先扣减转出方余额（`db.users.update({_id: from}, {$inc: {balance: -amount}})`），再增加转入方余额。两次更新之间如果服务重启，由用户发现余额不对后联系客服人工修正。
2. 余额直接存储在用户文档的 balance 字段上，不记录流水。
3. 接口不做幂等处理，客户端负责不重复提交。
4. 为了开发效率快，转账金额由前端传入并直接使用。
