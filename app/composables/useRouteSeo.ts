import { useHead, useRoute, useRuntimeConfig } from '#imports';
import { applyIndexingPolicy, isIndexingAllowed } from '@/utils/indexingPolicy';
import { createRouteSeoHead } from '@/utils/routeSeo';
export const useRouteSeo = () => {
  const route = useRoute();
  // Fork: noindex, no canonical and no structured data unless indexing is switched on.
  const allowIndexing = isIndexingAllowed(useRuntimeConfig().public.allowIndexing);
  return useHead(() => applyIndexingPolicy(createRouteSeoHead(route.path), allowIndexing));
};
