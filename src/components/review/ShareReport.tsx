"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArtifactsPanel } from "./ArtifactsPanel";
import { ReportOverview } from "./ReportOverview";
import { RoleOpinions } from "./RoleOpinions";
import type { ReviewPayload } from "./types";

/**
 * Read-only report renderer for the public share page.
 * The clarify Q&A tab is intentionally omitted: answers may contain
 * internal details the sharer did not mean to publish.
 */
export function ShareReport({ data }: { data: ReviewPayload }) {
  return (
    <Tabs defaultValue="overview">
      <TabsList className="mb-6">
        <TabsTrigger value="overview">总览</TabsTrigger>
        <TabsTrigger value="opinions">评委意见</TabsTrigger>
        <TabsTrigger value="artifacts">评审产物</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <ReportOverview data={data} />
      </TabsContent>
      <TabsContent value="opinions">
        <RoleOpinions reviews={data.roleReviews} />
      </TabsContent>
      <TabsContent value="artifacts">
        <ArtifactsPanel artifacts={data.artifacts} submissionTitle={data.submission?.title ?? "评审"} />
      </TabsContent>
    </Tabs>
  );
}
