<template>
  <div class="grid grid-cols-1 gap-3 lg:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]">
    <div
      v-for="i in 3"
      :key="i"
      class="bg-surface-800 border-surface-400/10 rounded-lg border p-3"
      data-testid="kappa-loading-column"
    >
      <div class="flex items-center gap-2.5">
        <div class="bg-surface-700 h-8 w-8 shrink-0 rounded-full"></div>
        <div class="bg-surface-700 h-4 w-24 rounded"></div>
      </div>
      <div class="mt-3 space-y-1.5">
        <div v-for="j in 4" :key="j" class="bg-surface-700 h-12 w-full rounded-md"></div>
      </div>
    </div>
  </div>
</template>
