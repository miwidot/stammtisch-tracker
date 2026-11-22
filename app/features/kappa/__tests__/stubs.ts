/**
 * Stand-ins for the Nuxt UI and theme-aware components the Kappa pieces render. The real ones
 * need a running Nuxt app (app config, theme state), which a plain `mount` does not provide.
 * Attributes fall through, so aria-labels and data-testids stay assertable.
 */
export const kappaStubs = {
  UButton: {
    inheritAttrs: false,
    props: ['icon', 'color', 'variant', 'size', 'disabled'],
    emits: ['click'],
    template:
      '<button v-bind="$attrs" :disabled="disabled" :data-icon="icon" :data-color="color" @click="$emit(\'click\', $event)"><slot /></button>',
  },
  UBadge: {
    inheritAttrs: false,
    props: ['color', 'size', 'variant'],
    template: '<span v-bind="$attrs" :data-color="color"><slot /></span>',
  },
  UAlert: { props: ['title'], template: '<div data-testid="kappa-empty">{{ title }}</div>' },
  DashboardProgressBar: {
    props: ['percentage', 'color'],
    template:
      '<div data-testid="kappa-progress" :data-percentage="percentage" :data-color="color" />',
  },
  UIcon: true,
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
  AppTooltip: { props: ['text'], template: '<div :data-tooltip="text"><slot /></div>' },
};
