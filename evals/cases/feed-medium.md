---
id: feed-medium
kind: medium
expectBlocking: false
title: 内容社区 Feed 流
techStack: Java + Redis Cluster + MySQL + RocketMQ
constraints:
  qps: "读 80000 / 写 2000"
  dataVolume: "日活 300 万，平均关注 200 人"
  teamSize: 8
businessContext: UGC 内容社区的关注流，要求近实时，日活 300 万。
---
## 方案

采用推拉结合：粉丝数超过 1 万的作者走拉模式，其余走推模式，发帖后通过 RocketMQ 异步写扩散到粉丝收件箱（Redis zset，保留最近 500 条）。读取时合并收件箱与关注大 V 的最新发布列表，按时间排序返回。

MySQL 按用户 ID 分 64 库保存全量关系与内容；Redis Cluster 承担收件箱与内容热点缓存，缓存未命中回源 MySQL。写扩散消费失败进重试队列，最多重试 3 次后进死信人工处理。

大 V 发帖的拉模式结果做 30 秒短缓存以扛读峰值。收件箱丢失（Redis 故障）时降级为纯拉模式，性能下降但功能可用。
