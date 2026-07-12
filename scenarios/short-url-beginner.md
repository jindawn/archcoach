---
slug: short-url-beginner
title: 短链接服务入门设计
difficulty: beginner
domain: web
sortOrder: 0
constraints:
  qps: "生成 20 QPS，跳转峰值 2,000 QPS"
  dataVolume: "每天新增 10 万条链接，保留 2 年"
  sla: "跳转 P95 < 100ms，可用性 99.9%"
  teamSize: "2 名后端工程师"
  budget: "优先使用简单、托管的基础设施"
trainingGuide:
  version: 1
  intro: "你不需要先知道标准架构。跟着五个问题，把业务需求逐步翻译成技术方案。"
  solutionTemplate: |
    ## 需求与核心链路
    {{requirements}}

    ## 数据与存储
    {{data}}

    ## 技术选型
    {{technology}}

    ## 失败与可靠性
    {{reliability}}

    ## 容量与成本
    {{capacity}}
  steps:
    - id: requirements
      title: 找出核心链路
      capability: requirements
      question: "用户生成短链接和访问短链接时，系统分别要完成哪些动作？哪个链路对速度更敏感？"
      hints:
        - "先把生成和跳转看成两条独立流程。"
        - "生成需要保存映射；跳转需要用短码找到原地址。"
        - "跳转量远高于生成量，所以读链路的延迟和可用性更重要。"
      rubric: ["区分生成与跳转链路", "识别读多写少", "说明跳转链路更敏感"]
    - id: data
      title: 设计最小数据模型
      capability: data
      question: "至少需要保存哪些字段？短码如何保证唯一，过期链接如何处理？"
      hints:
        - "从短码、原地址、创建时间和有效期开始。"
        - "数据库可对短码建立唯一约束，冲突时重新生成。"
        - "查询时校验过期时间，后台任务再清理数据。"
      rubric: ["核心字段", "唯一性约束", "过期策略"]
    - id: technology
      title: 选择组件
      capability: technology
      question: "两人团队应选择单体还是微服务？是否需要数据库和缓存？请说明每个组件解决的问题。"
      hints:
        - "团队小、业务边界简单时，先控制运维复杂度。"
        - "关系型数据库适合保存映射；缓存可加速热门短码。"
        - "推荐单体应用 + PostgreSQL/MySQL，并按实际热点引入 Redis。"
      rubric: ["选择简单架构", "说明数据库职责", "说明缓存不是无条件必需"]
    - id: reliability
      title: 考虑失败路径
      capability: reliability
      question: "缓存不可用、数据库短暂故障、链接不存在时，跳转接口分别应该怎样处理？"
      hints:
        - "区分可以降级的故障和无法继续的故障。"
        - "缓存失败可回源数据库；不存在的短码应返回明确的 404。"
        - "数据库不可用时可短暂依赖缓存命中，未命中则快速失败并告警。"
      rubric: ["缓存回源", "明确不存在响应", "数据库故障与告警"]
    - id: capacity
      title: 做数量级估算
      capability: capacity
      question: "按每天 10 万条、保留 2 年估算记录量；面对 2,000 QPS 跳转，你会如何控制首版成本？"
      hints:
        - "先用每天新增量乘以保留天数。"
        - "约 7,300 万条记录，需要索引但通常不需要立刻分库。"
        - "先用托管数据库、小规模应用实例和按需缓存，通过监控再扩容。"
      rubric: ["给出约7300万数量级", "不盲目分库", "渐进扩容"]
---
公司希望提供一个内部短链接服务。员工输入一个很长的网址，系统返回易于分享的短地址；访问短地址时，应快速跳转到原网址。链接可以设置有效期，管理员需要能够禁用恶意链接。

这是一个入门训练题。重点不是堆砌中间件，而是理解读写链路、数据模型、缓存价值和基本故障处理。
