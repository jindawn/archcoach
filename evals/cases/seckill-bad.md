---
id: seckill-bad
kind: bad
expectBlocking: true
title: 秒杀系统（缺陷方案）
techStack: PHP + MySQL
constraints:
  qps: 50000
  sla: "99.95%"
  teamSize: 5
businessContext: 电商双十一秒杀，200 SKU，单场 2 小时，峰值 QPS 5 万，不可超卖。
---
## 方案

1. 用户点击抢购后，后端直接 `SELECT stock FROM items WHERE id=?`，如果库存大于 0 就 `UPDATE items SET stock = stock - 1`，然后插入订单表。
2. 为了性能，读库存走从库，写走主库。
3. 应用部署 4 台服务器，Nginx 轮询。
4. 防止重复下单：前端按钮点击后置灰。
5. 如果活动流量太大数据库压力高，就临时加几台从库。
