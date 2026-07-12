---
slug: image-upload-beginner
title: 图片上传服务入门设计
difficulty: beginner
domain: media
sortOrder: 1
constraints:
  qps: "上传峰值 50 QPS，图片访问峰值 3,000 QPS"
  dataVolume: "每天 20 万张，平均 2MB"
  sla: "上传成功率 99.9%，图片访问 P95 < 200ms"
  teamSize: "3 名工程师"
  budget: "使用云厂商托管服务，避免自建存储集群"
trainingGuide:
  version: 1
  intro: "从一次上传和一次访问开始，理解对象存储、数据库与 CDN 分别负责什么。"
  solutionTemplate: |
    ## 需求与流程
    {{requirements}}

    ## 元数据和文件存储
    {{data}}

    ## 技术组件
    {{technology}}

    ## 安全与失败处理
    {{reliability}}

    ## 容量和成本
    {{capacity}}
  steps:
    - id: requirements
      title: 描述上传与访问
      capability: requirements
      question: "一张图片从用户选择文件到可以被访问，需要经过哪些关键动作？上传和访问链路有什么不同？"
      hints: ["分别画出上传和下载两条链路。", "上传包含校验、存储和记录地址；访问需要根据地址获取文件。", "访问远多于上传，应避免让每次图片访问都经过业务服务器。"]
      rubric: ["完整上传流程", "区分上传与访问", "识别访问流量特点"]
    - id: data
      title: 分开文件与元数据
      capability: data
      question: "图片二进制文件和文件名、大小、所有者等信息分别放在哪里？为什么？"
      hints: ["大文件和结构化记录适合不同存储。", "对象存储保存文件，数据库保存可查询的元数据和对象 key。", "数据库中不要直接保存大量图片二进制，以免备份和查询成本失控。"]
      rubric: ["对象存储保存文件", "数据库保存元数据", "解释分离原因"]
    - id: technology
      title: 选择访问方案
      capability: technology
      question: "业务服务器、对象存储和 CDN 各自承担什么职责？客户端是否可以直接上传到对象存储？"
      hints: ["业务服务器不适合长期转发所有文件流量。", "服务端签发有时效的上传凭证，客户端可直传对象存储。", "CDN 缓存并就近分发公开或已授权的图片。"]
      rubric: ["职责边界", "签名直传", "CDN价值"]
    - id: reliability
      title: 处理不安全与不一致
      capability: reliability
      question: "如何限制文件类型和大小？如果文件上传成功但元数据写入失败，系统如何发现并清理？"
      hints: ["客户端校验不能替代服务端或存储侧限制。", "限制签名凭证的大小、类型、路径和有效期。", "给临时对象设置生命周期，并用任务清理没有对应元数据的孤儿文件。"]
      rubric: ["服务端约束", "最小权限签名", "孤儿文件清理"]
    - id: capacity
      title: 估算存储增长
      capability: capacity
      question: "按每天 20 万张、平均 2MB，估算每天和每年的原图存储量；哪些手段能控制成本？"
      hints: ["先计算 20万 × 2MB。", "每天约 400GB，一年约 146TB（未计副本与缩略图）。", "生命周期分层、压缩/转码、CDN 缓存和限制重复上传都能降低成本。"]
      rubric: ["每天约400GB", "每年约146TB", "合理成本措施"]
---
产品需要支持用户上传头像和内容图片。用户量正在增长，图片访问远多于上传。系统必须限制不合法文件，并避免业务服务器被大文件传输占满。

这道题帮助初学者理解：对象存储不是数据库的替代品，CDN 也不是文件的源存储，每个组件都有明确职责。
